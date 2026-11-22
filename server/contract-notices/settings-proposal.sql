-- UNAPPLIED. Review separately and verify the exact beta project, only after
-- checking privileges, existing schema and current notice tables. No real mail.
begin;
create table public.contract_notice_settings (
  singleton boolean primary key default true check (singleton),
  recipients text[] not null check (cardinality(recipients) between 1 and 7),
  revision integer not null check (revision >= 0)
);
insert into public.contract_notice_settings (recipients, revision)
values (array['accounting@havenlight.com'], 0);
create table public.contract_notice_settings_audit (
  revision integer primary key,
  actor_id uuid not null,
  recipient_count integer not null,
  changed_at timestamptz not null default now()
);
alter table public.contract_notice_settings enable row level security;
alter table public.contract_notice_settings_audit enable row level security;
revoke all on public.contract_notice_settings, public.contract_notice_settings_audit from public, anon, authenticated, service_role;
grant select on public.contract_notice_settings to service_role;
create function public.save_contract_notice_settings(expected_revision integer, new_recipients text[], actor uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare saved_revision integer;
begin
  if not exists (select 1 from public.profiles p where p.id=actor and p.is_active and p.role='admin' for share) then
    raise exception 'Active administrator required';
  end if;
  update public.contract_notice_settings as s
    set recipients=new_recipients, revision=s.revision+1
    where singleton and s.revision=expected_revision returning s.revision into saved_revision;
  if found then
    insert into public.contract_notice_settings_audit (revision, actor_id, recipient_count)
      values (saved_revision, actor, cardinality(new_recipients));
  end if;
  return saved_revision;
end;
$$;
revoke all on function public.save_contract_notice_settings(integer,text[],uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_contract_notice_settings(integer,text[],uuid) to service_role;
commit;
