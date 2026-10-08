-- Review artifact only. Do not apply to the shared backend without rollout approval.
begin;
create schema if not exists roadshow_private;
revoke all on schema roadshow_private from public,anon,authenticated;
create table roadshow_private.agreement_context(
 backend_pid integer not null,transaction_id bigint not null,
 primary key(backend_pid,transaction_id)
);
revoke all on roadshow_private.agreement_context from public,anon,authenticated;

create table public.agreement_versions(
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete restrict,
 version_number integer not null check(version_number>0),
 content jsonb not null check(jsonb_typeof(content)='object'),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 unique(contract_id,version_number),unique(id,contract_id)
);
create table public.agreement_assignment_periods(
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete restrict,
 driver_id uuid not null references public.profiles(id) on delete restrict,
 started_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz,
 check(ended_at is null or ended_at>=started_at)
);
create unique index agreement_one_current_period on public.agreement_assignment_periods(contract_id,driver_id) where ended_at is null;
create table public.agreement_signatures(
 id uuid primary key default gen_random_uuid(),
 version_id uuid not null references public.agreement_versions(id) on delete restrict,
 signer_id uuid not null references public.profiles(id) on delete restrict,
 signer_role text not null check(signer_role in ('driver','admin')),
 assignment_period_id uuid references public.agreement_assignment_periods(id) on delete restrict,
 signer_name text not null check(length(trim(signer_name))>=2),
 signed_at timestamptz not null default clock_timestamp(),
 check((signer_role='driver')=(assignment_period_id is not null)),
 unique(version_id,signer_role)
);
create index agreement_signatures_recipient on public.agreement_signatures(signer_id,version_id);
alter table public.contracts add column current_agreement_id uuid references public.agreement_versions(id) on delete restrict;
alter table public.contracts add constraint agreement_current_contract_binding foreign key(current_agreement_id,id) references public.agreement_versions(id,contract_id);

create function roadshow_private.in_agreement_change() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from roadshow_private.agreement_context
 where backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.txid_current())
$$;
create function roadshow_private.begin_agreement_change() returns void
language sql security definer set search_path='' as $$
 insert into roadshow_private.agreement_context values(pg_catalog.pg_backend_pid(),pg_catalog.txid_current()) on conflict do nothing
$$;
create function roadshow_private.end_agreement_change() returns void
language sql security definer set search_path='' as $$
 delete from roadshow_private.agreement_context where backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.txid_current()
$$;
revoke all on all functions in schema roadshow_private from public,anon,authenticated;

create function roadshow_private.immutable_agreement() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Agreement evidence is immutable'; end $$;
create trigger agreement_versions_immutable before update or delete on public.agreement_versions for each row execute function roadshow_private.immutable_agreement();
create trigger agreement_signatures_immutable before update or delete on public.agreement_signatures for each row execute function roadshow_private.immutable_agreement();
create function roadshow_private.signature_period_binding() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.signer_role='driver' and not exists(select 1 from public.agreement_assignment_periods p join public.agreement_versions v on v.contract_id=p.contract_id
  where p.id=new.assignment_period_id and v.id=new.version_id and p.driver_id=new.signer_id and p.ended_at is null) then
  raise exception 'Agreement signature assignment binding is invalid';
 end if;
 return new;
end $$;
create trigger agreement_signature_period_binding before insert on public.agreement_signatures for each row execute function roadshow_private.signature_period_binding();
create function roadshow_private.guard_assignment_period() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Assignment evidence is immutable'; end if;
 if not roadshow_private.in_agreement_change() or old.ended_at is not null or new.ended_at is null
  or (to_jsonb(new)-'ended_at') is distinct from (to_jsonb(old)-'ended_at') then
  raise exception 'Assignment evidence is immutable except authorized closure';
 end if;
 return new;
end $$;
create trigger agreement_period_guard before update or delete on public.agreement_assignment_periods for each row execute function roadshow_private.guard_assignment_period();

create function public.agreement_content(target_contract uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'contract',jsonb_build_object('kind',c.kind,'service_date',c.service_date,'service_time',c.service_time,
   'contract_pay',c.contract_pay,'bonus_pay',c.bonus_pay,'terms',c.terms,'document_path',c.document_path),
  'work',jsonb_build_object('id',s.id,'name',s.name,'event_type',s.event_type,'artist',s.artist,
   'venue_name',s.venue_name,'starts_on',s.starts_on,'ends_on',s.ends_on,'city',s.city,'state',s.state,
   'address',s.address,'bin_count',s.bin_count,'signing_at',s.signing_at,'setup_at',s.setup_at,
   'per_diem',s.per_diem,'meals_included',s.meals_included,'lodging_included',s.lodging_included),
  'linked_show_ids',coalesce((select jsonb_agg(other_id order by other_id) from
   (select case when l.show_id=s.id then l.linked_show_id else l.show_id end other_id from public.show_links l where l.show_id=s.id or l.linked_show_id=s.id) linked),'[]'::jsonb),
  'checklist',coalesce((select jsonb_agg(jsonb_build_object('id',sec.id,'title',sec.title,'position',sec.position,
   'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'instructions',i.instructions,
   'required',i.required,'photo_required',i.photo_required,'position',i.position) order by i.position,i.id)
   from public.checklist_items i where i.section_id=sec.id),'[]'::jsonb)) order by sec.position,sec.id)
   from public.contract_checklists cc join public.checklist_sections sec on sec.template_id=cc.template_id where cc.contract_id=c.id),'[]'::jsonb)
 ) from public.contracts c join public.shows s on s.id=c.show_id where c.id=target_contract
$$;
revoke all on function public.agreement_content(uuid) from public,anon,authenticated;

create function roadshow_private.guard_agreement_contract() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.current_agreement_id is not null or new.signed_at is not null or new.signature_name is not null or new.admin_signed_at is not null or new.admin_signature_name is not null then
   raise exception 'Agreement acceptance cannot be supplied on contract creation';
  end if;
  return new;
 end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.agreement_versions where contract_id=old.id) then raise exception 'Agreement evidence prevents contract deletion'; end if;
  return old;
 end if;
 if not roadshow_private.in_agreement_change() then
  if (new.current_agreement_id,new.signed_at,new.signature_name,new.admin_signed_at,new.admin_signature_name)
   is distinct from (old.current_agreement_id,old.signed_at,old.signature_name,old.admin_signed_at,old.admin_signature_name) then
   raise exception 'Use reviewed agreement acceptance APIs';
  end if;
  if old.current_agreement_id is not null or old.signed_at is not null or old.admin_signed_at is not null then
   if (new.show_id,new.driver_id,new.kind,new.service_date,new.service_time,new.contract_pay,new.bonus_pay,new.terms,new.document_path)
    is distinct from (old.show_id,old.driver_id,old.kind,old.service_date,old.service_time,old.contract_pay,old.bonus_pay,old.terms,old.document_path) then
    raise exception 'Agreement changes require review and confirmation';
   end if;
  end if;
 end if;
 return new;
end $$;
create trigger agreement_contract_guard before insert or update or delete on public.contracts for each row execute function roadshow_private.guard_agreement_contract();

create function roadshow_private.guard_agreement_show() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not roadshow_private.in_agreement_change() and exists(select 1 from public.contracts c where c.show_id=old.id and (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null))
  and (to_jsonb(new)-array['lodging_name','lodging_address','lodging_phone','lodging_confirmation','lodging_check_in','lodging_check_out','lodging_notes','details_unlock_at'])
   is distinct from (to_jsonb(old)-array['lodging_name','lodging_address','lodging_phone','lodging_confirmation','lodging_check_in','lodging_check_out','lodging_notes','details_unlock_at']) then
  raise exception 'Agreement work changes require review and confirmation';
 end if;
 return new;
end $$;
create trigger agreement_show_guard before update on public.shows for each row execute function roadshow_private.guard_agreement_show();

alter table public.agreement_versions enable row level security;
alter table public.agreement_assignment_periods enable row level security;
alter table public.agreement_signatures enable row level security;
revoke all on public.agreement_versions,public.agreement_assignment_periods,public.agreement_signatures from public,anon,authenticated;
grant select on public.agreement_versions,public.agreement_assignment_periods,public.agreement_signatures to authenticated;
create policy agreement_current_versions on public.agreement_versions for select to authenticated using(
 public.is_active_user() and (public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and c.current_agreement_id=agreement_versions.id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))))
);
create policy agreement_own_signatures on public.agreement_signatures for select to authenticated using(public.is_active_user() and (signer_id=auth.uid() or public.is_admin()));
create policy agreement_own_periods on public.agreement_assignment_periods for select to authenticated using(public.is_active_user() and (driver_id=auth.uid() or public.is_admin()));
revoke all on all functions in schema roadshow_private from public,anon,authenticated;
commit;
