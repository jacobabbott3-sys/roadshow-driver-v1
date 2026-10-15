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
 if c.cancelled_at is not null then return 'cancelled'; end if;
 if not (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null
   or exists(select 1 from public.agreement_versions where contract_id=c.id)) then
  raise exception 'No agreement evidence exists; delete this work instead'; end if;
 perform roadshow_private.begin_agreement_change();
 update public.contracts set cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=nullif(trim(coalesce(cancel_note,'')),''),updated_at=now() where id=c.id;
 update public.agreement_assignment_periods set ended_at=now() where contract_id=c.id and ended_at is null;
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

revoke all on function public.admin_cancel_contract(uuid,text),public.admin_delete_or_cancel_show(uuid) from public,anon;
grant execute on function public.admin_cancel_contract(uuid,text),public.admin_delete_or_cancel_show(uuid) to authenticated;
commit;
