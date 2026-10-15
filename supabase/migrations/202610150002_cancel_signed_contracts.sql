-- Cancel (instead of delete) contracts that carry agreement evidence.
-- Signed versions, signatures, timestamps, assignment periods and history are never removed.
begin;

alter table public.contracts
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id),
  add column cancel_reason text;

-- Drivers no longer see cancelled contracts; admins keep full visibility.
create policy contracts_hide_cancelled on public.contracts as restrictive for select to authenticated
  using (cancelled_at is null or public.is_admin());

-- Mirror of the contract flag so show listings (driver availability etc.) can hide cancelled work.
alter table public.shows add column cancelled_at timestamptz;
create policy shows_hide_cancelled on public.shows as restrictive for select to authenticated
  using (cancelled_at is null or public.is_admin());

create function roadshow_private.guard_cancelled_contract() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if roadshow_private.in_agreement_change() then return new; end if;
 if old.cancelled_at is not null then raise exception 'This contract is cancelled and can no longer change'; end if;
 if (new.cancelled_at,new.cancelled_by,new.cancel_reason) is distinct from (old.cancelled_at,old.cancelled_by,old.cancel_reason) then
  raise exception 'Use the reviewed cancellation action'; end if;
 return new;
end $$;
create trigger agreement_cancelled_guard before update on public.contracts for each row execute function roadshow_private.guard_cancelled_contract();

create function roadshow_private.guard_cancelled_signature() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.agreement_versions v join public.contracts c on c.id=v.contract_id where v.id=new.version_id and c.cancelled_at is not null) then
  raise exception 'This contract is cancelled and cannot be signed'; end if;
 return new;
end $$;
create trigger agreement_cancelled_signature_guard before insert on public.agreement_signatures for each row execute function roadshow_private.guard_cancelled_signature();

create function public.admin_cancel_contract(target_contract uuid, cancel_note text default null) returns text
language plpgsql security definer set search_path='' as $$
declare c public.contracts;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 select * into c from public.contracts where id=target_contract for update;
 if c.id is null then raise exception 'Contract unavailable'; end if;
 if c.cancelled_at is not null then
  perform roadshow_private.begin_agreement_change();
  update public.agreement_assignment_periods set ended_at=now() where contract_id=c.id and ended_at is null;
  perform roadshow_private.end_agreement_change();
  return 'cancelled';
 end if;
 if not (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null
   or exists(select 1 from public.agreement_versions where contract_id=c.id)) then
  raise exception 'No agreement evidence exists; delete this work instead'; end if;
 perform roadshow_private.begin_agreement_change();
 update public.contracts set cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=nullif(trim(coalesce(cancel_note,'')),''),updated_at=now() where id=c.id;
 update public.agreement_assignment_periods set ended_at=now() where contract_id=c.id and ended_at is null;
 update public.shows set cancelled_at=now() where id=c.show_id and cancelled_at is null;
 insert into public.notifications(recipient_id,title,body,link,kind,contract_id,agreement_notice_key)
 select p.id,'Assignment cancelled','This assignment was cancelled. Any agreement you accepted remains in your agreement history.',
  '/agreements','agreement_removed',null::uuid,'cancelled:'||c.id::text
 from public.profiles p
 where p.is_active and (p.id=c.driver_id or exists(select 1 from public.contract_drivers d where d.contract_id=c.id and d.driver_id=p.id))
 on conflict do nothing;
 perform roadshow_private.end_agreement_change();
 return 'cancelled';
end $$;

create function public.admin_delete_or_cancel_show(target_show uuid) returns text
language plpgsql security definer set search_path='' as $$
declare c record; result text:='deleted';
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 if not exists(select 1 from public.shows where id=target_show) then raise exception 'Show unavailable'; end if;
 for c in select id from public.contracts where show_id=target_show
   and (current_agreement_id is not null or signed_at is not null or admin_signed_at is not null
     or exists(select 1 from public.agreement_versions v where v.contract_id=contracts.id)) loop
  perform public.admin_cancel_contract(c.id,null); result:='cancelled';
 end loop;
 if result='deleted' then delete from public.shows where id=target_show; end if;
 return result;
end $$;

create or replace function roadshow_private.admin_replace_opportunity_assignments(
  target_release_item uuid,
  target_show_ids uuid[],
  target_driver_ids uuid[],
  target_external_names text[]
) returns void language plpgsql security definer set search_path='' as $$
declare
  clean_show_ids uuid[];
  clean_driver_ids uuid[];
  clean_external_names text[];
  target_contract uuid;
  target_show uuid;
  has_assignees boolean;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select array_agg(distinct value order by value) into clean_show_ids
    from unnest(coalesce(target_show_ids,array[]::uuid[])) value;
  select array_agg(value order by first_position) into clean_driver_ids
  from (
    select distinct on (value) value,ordinality first_position
    from unnest(coalesce(target_driver_ids,array[]::uuid[])) with ordinality input(value,ordinality)
    order by value,ordinality
  ) ordered_drivers;
  select array_agg(name order by first_position) into clean_external_names
  from (
    select distinct on (lower(trim(value))) ordinality first_position,trim(value) name
    from unnest(coalesce(target_external_names,array[]::text[])) with ordinality input(value,ordinality)
    where length(trim(value))>0
    order by lower(trim(value)),ordinality
  ) names;
  has_assignees:=coalesce(cardinality(clean_driver_ids),0)+coalesce(cardinality(clean_external_names),0)>0;

  if coalesce(cardinality(clean_show_ids),0)=0 then raise exception 'Choose at least one contract'; end if;
  if exists(select 1 from unnest(coalesce(clean_external_names,array[]::text[])) value where char_length(value)>120) then
    raise exception 'External driver names must be 120 characters or fewer';
  end if;
  if coalesce(cardinality(clean_driver_ids),0)>0 and exists(
    select 1 from unnest(clean_driver_ids) requested(id)
    left join public.profiles p on p.id=requested.id and p.is_active
    where p.id is null
  ) then raise exception 'Every app user must have an active account'; end if;

  if target_release_item is not null then
    perform 1 from public.availability_release_items
      where id=target_release_item and status in ('open','assigned') for update;
    if not found then raise exception 'This contract has been withdrawn or removed'; end if;
    if exists(
      (select show_id from public.availability_release_item_shows where release_item_id=target_release_item
       except select unnest(clean_show_ids))
      union all
      (select unnest(clean_show_ids)
       except select show_id from public.availability_release_item_shows where release_item_id=target_release_item)
    ) then raise exception 'The assignment no longer matches this contract'; end if;
  end if;

  foreach target_show in array clean_show_ids loop
    select id into target_contract from public.contracts
      where show_id=target_show order by created_at desc limit 1 for update;
    if target_contract is null then raise exception 'A selected show does not have a contract'; end if;
    -- Cancelled contracts keep their evidence and never receive new assignments.
    if exists(select 1 from public.contracts where id=target_contract and cancelled_at is not null) then continue; end if;

    update public.contracts set driver_id=clean_driver_ids[1],updated_at=now()
      where id=target_contract;
    delete from public.contract_drivers where contract_id=target_contract and not (driver_id=any(coalesce(clean_driver_ids,array[]::uuid[])));
    insert into public.contract_drivers(contract_id,driver_id,is_trainee)
      select target_contract,value,ordinality>1
      from unnest(coalesce(clean_driver_ids,array[]::uuid[])) with ordinality values_list(value,ordinality) on conflict(contract_id,driver_id) do update set is_trainee=excluded.is_trainee;

    delete from public.contract_external_assignees where contract_id=target_contract;
    insert into public.contract_external_assignees(contract_id,display_name,position,created_by)
      select target_contract,value,ordinality-1,auth.uid()
      from unnest(coalesce(clean_external_names,array[]::text[])) with ordinality values_list(value,ordinality);
  end loop;

  if target_release_item is not null then
    update public.availability_release_items set
      status=case when has_assignees then 'assigned' else 'open' end,
      closed_at=case when has_assignees then clock_timestamp() else null end,
      closed_by=case when has_assignees then auth.uid() else null end,
      updated_at=clock_timestamp()
    where id=target_release_item;
  end if;
end $$;

create or replace function roadshow_private.sync_agreement_periods(target_contract uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not roadshow_private.in_agreement_change() then raise exception 'Agreement context required'; end if;
 -- Cancelled contracts never hold open assignment periods, even if roster rows remain.
 if exists(select 1 from public.contracts c where c.id=target_contract and c.cancelled_at is not null) then
  update public.agreement_assignment_periods set ended_at=clock_timestamp() where contract_id=target_contract and ended_at is null;
  return;
 end if;
 update public.agreement_assignment_periods p set ended_at=clock_timestamp()
 where p.contract_id=target_contract and p.ended_at is null and not exists(
  select 1 from public.contract_drivers d where d.contract_id=target_contract and d.driver_id=p.driver_id
 ) and not exists(select 1 from public.contracts c where c.id=target_contract and c.driver_id=p.driver_id);
 insert into public.agreement_assignment_periods(contract_id,driver_id)
 select target_contract,driver_id from (
  select driver_id from public.contract_drivers where contract_id=target_contract
  union select driver_id from public.contracts where id=target_contract and driver_id is not null
 ) roster where not exists(select 1 from public.agreement_assignment_periods p where p.contract_id=target_contract and p.driver_id=roster.driver_id and p.ended_at is null);
end $$;

revoke all on function public.admin_cancel_contract(uuid,text),public.admin_delete_or_cancel_show(uuid) from public,anon;
grant execute on function public.admin_cancel_contract(uuid,text),public.admin_delete_or_cancel_show(uuid) to authenticated;
commit;
