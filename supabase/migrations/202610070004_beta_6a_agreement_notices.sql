begin;
alter table public.notifications add column agreement_notice_key text;
create unique index agreement_notice_dedupe on public.notifications(recipient_id,agreement_notice_key) where agreement_notice_key is not null;
create policy agreement_notices_recipient_only on public.notifications as restrictive for select to authenticated using(
 public.is_active_user() and (kind not in ('agreement_removed','agreement_revision') or recipient_id=auth.uid())
);
create function roadshow_private.notify_agreement_removal() returns trigger
language plpgsql security definer set search_path='' as $$
declare period_id uuid;
begin
 if not exists(select 1 from public.profiles where id=old.driver_id and is_active) then return old; end if;
 if not exists(select 1 from public.contracts where id=old.contract_id and (current_agreement_id is not null or signed_at is not null or admin_signed_at is not null)) then return old; end if;
 select id into period_id from public.agreement_assignment_periods where contract_id=old.contract_id and driver_id=old.driver_id and ended_at is null;
 insert into public.notifications(recipient_id,title,body,link,kind,contract_id,agreement_notice_key)
 values(old.driver_id,'Assignment removed','You have been removed from this assignment. Any agreement you previously accepted remains in your agreement history.',
 '/agreements','agreement_removed',null,'removed:'||coalesce(period_id::text,old.contract_id::text)) on conflict do nothing;
 return old;
end $$;
create trigger agreement_removal_notice after delete on public.contract_drivers for each row execute function roadshow_private.notify_agreement_removal();
create function roadshow_private.notify_legacy_lead_removal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.driver_id is not null and old.driver_id is distinct from new.driver_id
  and (old.current_agreement_id is not null or old.signed_at is not null or old.admin_signed_at is not null)
  and not exists(select 1 from public.contract_drivers where contract_id=old.id and driver_id=old.driver_id)
  and exists(select 1 from public.profiles where id=old.driver_id and is_active) then
  insert into public.notifications(recipient_id,title,body,link,kind,contract_id,agreement_notice_key)
  values(old.driver_id,'Assignment removed','You have been removed from this assignment. Your existing agreement history remains available.',
   '/agreements','agreement_removed',null,'removed:'||coalesce((select id::text from public.agreement_assignment_periods where contract_id=old.id and driver_id=old.driver_id and ended_at is null),old.id::text)) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger agreement_legacy_lead_notice after update of driver_id on public.contracts for each row execute function roadshow_private.notify_legacy_lead_removal();

create function roadshow_private.notify_agreement_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior_version uuid;
begin
 select id into prior_version from public.agreement_versions where contract_id=new.contract_id and version_number<new.version_number order by version_number desc limit 1;
 if prior_version is null then return new; end if;
 insert into public.notifications(recipient_id,title,body,link,kind,contract_id,agreement_notice_key)
 select distinct sig.signer_id,'Agreement revised','A revised agreement requires fresh driver and admin acceptance. Your previous accepted copy remains in your agreement history.',
 '/agreements','agreement_revision',null::uuid,'revision:'||new.id::text
 from public.agreement_signatures sig join public.profiles p on p.id=sig.signer_id and p.is_active
 where sig.version_id=prior_version and (sig.signer_role='admin' or exists(select 1 from public.contract_drivers d where d.contract_id=new.contract_id and d.driver_id=sig.signer_id)
 or exists(select 1 from public.contracts c where c.id=new.contract_id and c.driver_id=sig.signer_id)) on conflict do nothing;
 return new;
end $$;
create trigger agreement_revision_notice after insert on public.agreement_versions for each row execute function roadshow_private.notify_agreement_revision();
revoke all on all functions in schema roadshow_private from public,anon,authenticated;
commit;
