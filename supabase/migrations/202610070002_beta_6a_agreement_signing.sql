begin;
alter table public.contracts add column agreement_legacy_missing boolean not null default false;
create table public.agreement_legacy_evidence(
 contract_id uuid primary key references public.contracts(id) on delete restrict,
 signature_name text,signed_at timestamptz,admin_signature_name text,admin_signed_at timestamptz,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table public.agreement_legacy_evidence enable row level security;
revoke all on public.agreement_legacy_evidence from public,anon,authenticated;
create trigger agreement_legacy_immutable before update or delete on public.agreement_legacy_evidence for each row execute function roadshow_private.immutable_agreement();
create or replace function public.guard_driver_contract_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if roadshow_private.in_agreement_change() then return new; end if;
 if not public.is_admin() and auth.uid() is not null and
  ((to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) or new.status not in ('signed','in_progress')) then
  raise exception 'Drivers may only begin assigned work through current acceptance';
 end if;
 return new;
end $$;

create function roadshow_private.sync_agreement_periods(target_contract uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not roadshow_private.in_agreement_change() then raise exception 'Agreement context required'; end if;
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

create function roadshow_private.issue_agreement(target_contract uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if not roadshow_private.in_agreement_change() then raise exception 'Agreement context required'; end if;
 insert into public.agreement_legacy_evidence(contract_id,signature_name,signed_at,admin_signature_name,admin_signed_at)
 select id,signature_name,signed_at,admin_signature_name,admin_signed_at from public.contracts
 where id=target_contract and current_agreement_id is null and (signed_at is not null or admin_signed_at is not null)
 on conflict(contract_id) do nothing;
 insert into public.agreement_versions(contract_id,version_number,content,created_by)
 select c.id,coalesce((select max(v.version_number) from public.agreement_versions v where v.contract_id=c.id),0)+1,
 public.agreement_content(c.id),auth.uid() from public.contracts c where c.id=target_contract returning id into result_id;
 if result_id is null then raise exception 'Contract unavailable'; end if;
 update public.contracts set agreement_legacy_missing=agreement_legacy_missing or
  (current_agreement_id is null and (signed_at is not null or admin_signed_at is not null)),
  current_agreement_id=result_id,signed_at=null,signature_name=null,admin_signed_at=null,admin_signature_name=null,
  status=case when status='signed' then 'available'::public.contract_status else status end,updated_at=clock_timestamp()
 where id=target_contract;
 perform roadshow_private.sync_agreement_periods(target_contract);
 return result_id;
end $$;

create function public.get_contract_agreement(target_contract uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.contracts; result jsonb;
begin
 if not public.is_active_user() then raise exception 'An active account is required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 select * into c from public.contracts where id=target_contract for update;
 if c.id is null or (public.is_admin() or c.driver_id=auth.uid() or public.is_contract_driver(c.id)) is not true then raise exception 'Assigned contract access required'; end if;
 if c.current_agreement_id is null then
  perform roadshow_private.begin_agreement_change();
  c.current_agreement_id:=roadshow_private.issue_agreement(c.id);
  perform roadshow_private.end_agreement_change();
 end if;
 select jsonb_build_object('version',to_jsonb(v),'legacy_missing',ct.agreement_legacy_missing,
  'legacy_evidence',(select to_jsonb(e) from public.agreement_legacy_evidence e where e.contract_id=ct.id),
  'signatures',coalesce((select jsonb_agg(to_jsonb(sig) order by sig.signer_role) from public.agreement_signatures sig where sig.version_id=v.id),'[]'::jsonb))
 into result from public.agreement_versions v join public.contracts ct on ct.id=v.contract_id where v.id=c.current_agreement_id;
 return result;
end $$;

create function public.accept_contract_agreement(target_contract uuid,expected_version uuid,acceptance_role text,legal_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.contracts; prior public.agreement_signatures; period_id uuid; result_id uuid;
begin
 if not public.is_active_user() then raise exception 'An active account is required'; end if;
 if acceptance_role is null or acceptance_role not in ('driver','admin') or length(trim(coalesce(legal_name,'')))<2 then raise exception 'Choose a signing role and full legal name'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 select * into c from public.contracts where id=target_contract for update;
 if c.id is null then raise exception 'Contract unavailable'; end if;
 if acceptance_role='admin' then
  if not public.is_admin() then raise exception 'Admin access required'; end if;
 elsif (c.driver_id=auth.uid() or public.is_contract_driver(c.id)) is not true then raise exception 'An assigned account is required'; end if;
 if c.current_agreement_id is null or expected_version is distinct from c.current_agreement_id then raise exception 'Stale agreement: review the current version'; end if;
 if public.agreement_content(c.id) is distinct from (select content from public.agreement_versions where id=expected_version) then raise exception 'Agreement changed: review is required'; end if;
 select * into prior from public.agreement_signatures where version_id=expected_version and signer_role=acceptance_role;
 if prior.id is not null then
  if prior.signer_id=auth.uid() and prior.signer_name=trim(legal_name) then return prior.id; end if;
  raise exception 'This version already has acceptance for this role';
 end if;
 perform roadshow_private.begin_agreement_change();
 perform roadshow_private.sync_agreement_periods(c.id);
 if acceptance_role='driver' then
  select id into period_id from public.agreement_assignment_periods where contract_id=c.id and driver_id=auth.uid() and ended_at is null;
 end if;
 insert into public.agreement_signatures(version_id,signer_id,signer_role,assignment_period_id,signer_name)
 values(expected_version,auth.uid(),acceptance_role,period_id,trim(legal_name)) returning id into result_id;
 if acceptance_role='driver' then
  update public.contracts set signed_at=(select signed_at from public.agreement_signatures where id=result_id),signature_name=trim(legal_name),
   status=case when status in ('available','upcoming') then 'signed'::public.contract_status else status end where id=c.id;
 else
  update public.contracts set admin_signed_at=(select signed_at from public.agreement_signatures where id=result_id),admin_signature_name=trim(legal_name) where id=c.id;
 end if;
 perform roadshow_private.end_agreement_change();
 return result_id;
end $$;

create function public.get_my_agreement_history() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_active_user() then raise exception 'An active account is required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('version',to_jsonb(v),'signatures',
  (select jsonb_agg(to_jsonb(s) order by s.signer_role) from public.agreement_signatures s where s.version_id=v.id)) order by v.created_at desc),'[]'::jsonb)
 into result from public.agreement_versions v where exists(select 1 from public.agreement_signatures own where own.version_id=v.id and own.signer_id=auth.uid());
 return result;
end $$;

-- Old clients cannot accept text they have not reviewed via a version ID.
create or replace function public.sign_my_contract(contract_id uuid,signer_name text) returns void
language plpgsql security definer set search_path='' as $$
begin raise exception 'Review the current agreement in the updated app before signing'; end $$;

create function roadshow_private.guard_signature_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not roadshow_private.in_agreement_change() or new.signer_id is distinct from auth.uid()
  or not public.is_active_user() then raise exception 'Authorized agreement acceptance required'; end if;
 if new.signer_role='admin' and not public.is_admin() then raise exception 'Admin acceptance required'; end if;
 if new.signer_role='driver' and not exists(select 1 from public.agreement_assignment_periods p
  join public.agreement_versions v on v.contract_id=p.contract_id where v.id=new.version_id
  and p.id=new.assignment_period_id and p.driver_id=new.signer_id and p.ended_at is null
  and (public.is_contract_driver(p.contract_id) or exists(select 1 from public.contracts c where c.id=p.contract_id and c.driver_id=auth.uid()))) then raise exception 'Current assignment acceptance required'; end if;
 return new;
end $$;
create trigger agreement_signature_insert before insert on public.agreement_signatures for each row execute function roadshow_private.guard_signature_insert();
revoke all on all functions in schema roadshow_private from public,anon,authenticated;
revoke all on function public.get_contract_agreement(uuid),public.accept_contract_agreement(uuid,uuid,text,text),public.get_my_agreement_history(),public.sign_my_contract(uuid,text) from public,anon;
grant execute on function public.get_contract_agreement(uuid),public.accept_contract_agreement(uuid,uuid,text,text),public.get_my_agreement_history(),public.sign_my_contract(uuid,text) to authenticated;
commit;
