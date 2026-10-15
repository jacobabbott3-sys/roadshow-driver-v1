begin;

create function roadshow_private.submit_my_checklist(target_contract_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_active_user() then raise exception 'An active account is required'; end if;
  if not exists(select 1 from public.contract_checklists where contract_id=target_contract_id) then raise exception 'This contract does not have a checklist yet'; end if;
  if exists(
    select 1 from public.contract_checklists cc
    join public.checklist_items i on i.section_id in (select id from public.checklist_sections where template_id=cc.template_id)
    left join public.checklist_responses r on r.contract_checklist_id=cc.id and r.item_id=i.id
    where cc.contract_id=target_contract_id and not i.archived and not exists(select 1 from public.checklist_sections archived_section where archived_section.id=i.section_id and archived_section.archived) and i.required and not coalesce(r.completed,false)
  ) then raise exception 'Complete every required checklist item first'; end if;
  update public.contracts set status='submitted',submitted_at=now(),updated_at=now()
  where id=target_contract_id and (driver_id=auth.uid() or public.is_contract_driver(id)) and signed_at is not null;
  if not found then raise exception 'The lead driver must sign the contract before submission'; end if;
end $$;

create function roadshow_private.admin_finalize_checklist_review(target_contract uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  selected_checklist_id uuid;
  selected_template_id uuid;
  pending_count integer;
  denied_count integer;
  final_status text;
  notification_kind text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select cc.id,cc.template_id
    into selected_checklist_id,selected_template_id
  from public.contract_checklists cc
  join public.contracts c on c.id=cc.contract_id
  where cc.contract_id=target_contract
    and c.status in ('submitted','under_review');
  if selected_checklist_id is null then
    raise exception 'This checklist is not waiting for review';
  end if;

  select count(*) into pending_count
  from public.checklist_items i
  join public.checklist_sections s on s.id=i.section_id
  left join public.checklist_responses r
    on r.contract_checklist_id=selected_checklist_id and r.item_id=i.id
  where s.template_id=selected_template_id and not s.archived and not i.archived
    and coalesce(r.review_status,'pending')='pending';
  if pending_count>0 then
    raise exception 'Review every checklist item before finishing';
  end if;

  select count(*) into denied_count
  from public.checklist_items i
  join public.checklist_sections s on s.id=i.section_id
  join public.checklist_responses r
    on r.contract_checklist_id=selected_checklist_id and r.item_id=i.id
  where s.template_id=selected_template_id and not s.archived and not i.archived and r.review_status='denied';

  if denied_count>0 then
    final_status='in_progress';
    notification_kind='checklist_changes';
    update public.checklist_responses r
    set completed=false,completed_at=null
    from public.checklist_items i
    join public.checklist_sections s on s.id=i.section_id
    where r.contract_checklist_id=selected_checklist_id
      and r.item_id=i.id
      and s.template_id=selected_template_id and not s.archived and not i.archived
      and r.review_status='denied';
  else
    final_status='approved';
    notification_kind='checklist_approved';
  end if;

  update public.contracts
  set status=final_status::public.contract_status,
    reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now(),
    admin_note=case when denied_count>0
      then denied_count||case when denied_count=1 then ' item needs correction' else ' items need correction' end
      else 'All checklist items approved' end
  where id=target_contract;

  delete from public.notifications n
  where n.contract_id=target_contract and n.kind=notification_kind
    and n.recipient_id in (
      select c.driver_id from public.contracts c
      where c.id=target_contract and c.driver_id is not null
      union
      select cd.driver_id from public.contract_drivers cd
      where cd.contract_id=target_contract
    );

  insert into public.notifications(recipient_id,title,body,link,kind,contract_id)
  select recipient.driver_id,
    case when denied_count>0 then 'Checklist needs changes' else 'Checklist approved' end,
    case when denied_count>0
      then denied_count||case when denied_count=1
        then ' checklist item was returned. Open the checklist to see the note.'
        else ' checklist items were returned. Open the checklist to see the notes.' end
      else 'Every checklist item was approved.' end,
    '/contracts/'||target_contract,notification_kind,target_contract
  from (
    select c.driver_id from public.contracts c
    where c.id=target_contract and c.driver_id is not null
    union
    select cd.driver_id from public.contract_drivers cd
    where cd.contract_id=target_contract
  ) recipient
  on conflict do nothing;

  return final_status;
end $$;

create function roadshow_private.admin_set_bonus_result(target_contract uuid,earned boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.contracts set
    status=case when earned then 'bonus_earned'::public.contract_status else 'bonus_not_earned'::public.contract_status end,
    updated_at=now()
  where id=target_contract and status in ('approved','bonus_earned','bonus_not_earned');
  if not found then raise exception 'Approve the checklist before recording the bonus'; end if;
end $$;

create function roadshow_private.set_my_checklist_item(target_checklist uuid,target_item uuid,new_completed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_active_user() then raise exception 'An active account is required'; end if;
  if not exists(
    select 1 from public.contract_checklists cc
    join public.contracts c on c.id=cc.contract_id
    join public.checklist_items i on i.id=target_item
    join public.checklist_sections s on s.id=i.section_id and s.template_id=cc.template_id
    where cc.id=target_checklist and not i.archived and not s.archived and c.status not in ('submitted','under_review','approved')
      and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))
      and not exists(select 1 from public.checklist_responses r where r.contract_checklist_id=target_checklist and r.item_id=target_item and r.review_status='approved')
  ) then raise exception 'This checklist is not currently editable'; end if;
  insert into public.checklist_responses(contract_checklist_id,item_id,completed,completed_at)
  values(target_checklist,target_item,new_completed,case when new_completed then now() else null end)
  on conflict(contract_checklist_id,item_id) do update set completed=excluded.completed,completed_at=excluded.completed_at,review_status=null,review_note=null,reviewed_by=null,reviewed_at=null;
end $$;

create function roadshow_private.admin_review_checklist_item(
  target_contract uuid,
  target_item uuid,
  target_status text,
  target_note text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare
  selected_checklist_id uuid;
  selected_template_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if target_status not in ('approved','denied') then
    raise exception 'Review status must be approved or denied';
  end if;
  if target_status='denied' and length(trim(coalesce(target_note,'')))=0 then
    raise exception 'Add a note explaining what needs to be corrected';
  end if;

  select cc.id,cc.template_id
    into selected_checklist_id,selected_template_id
  from public.contract_checklists cc
  join public.contracts c on c.id=cc.contract_id
  where cc.contract_id=target_contract
    and c.status in ('submitted','under_review');
  if selected_checklist_id is null then
    raise exception 'This checklist is not waiting for review';
  end if;

  if not exists(
    select 1
    from public.checklist_items i
    join public.checklist_sections s on s.id=i.section_id
    where i.id=target_item and s.template_id=selected_template_id and not s.archived and not i.archived
  ) then
    raise exception 'This item is not part of the submitted checklist';
  end if;

  if target_status='approved' and not exists(
    select 1 from public.checklist_responses r
    where r.contract_checklist_id=selected_checklist_id
      and r.item_id=target_item and r.completed
  ) then
    raise exception 'Only a completed checklist item can be approved';
  end if;

  insert into public.checklist_responses(
    contract_checklist_id,item_id,completed,review_status,review_note,
    reviewed_by,reviewed_at
  ) values(
    selected_checklist_id,target_item,false,target_status,
    nullif(trim(target_note),''),auth.uid(),now()
  )
  on conflict(contract_checklist_id,item_id) do update set
    review_status=excluded.review_status,
    review_note=excluded.review_note,
    reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at;

  update public.contracts
  set status='under_review',updated_at=now()
  where id=target_contract and status='submitted';
end $$;

create function roadshow_private.current_driver_acceptance(target_contract uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.contracts c join public.agreement_signatures sig on sig.version_id=c.current_agreement_id and sig.signer_role='driver'
 join public.agreement_assignment_periods p on p.id=sig.assignment_period_id and p.contract_id=c.id and p.driver_id=sig.signer_id and p.ended_at is null
 join public.profiles account on account.id=sig.signer_id and account.is_active
 where c.id=target_contract and (c.driver_id=sig.signer_id or exists(select 1 from public.contract_drivers d where d.contract_id=c.id and d.driver_id=sig.signer_id)))
$$;
create function roadshow_private.driver_acceptance_for_version(target_contract uuid,target_version uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.agreement_signatures sig
 join public.agreement_assignment_periods p on p.id=sig.assignment_period_id and p.contract_id=target_contract and p.driver_id=sig.signer_id and p.ended_at is null
 join public.profiles account on account.id=sig.signer_id and account.is_active
 where sig.version_id=target_version and sig.signer_role='driver' and (exists(select 1 from public.contracts c where c.id=target_contract and c.driver_id=sig.signer_id) or exists(select 1 from public.contract_drivers d where d.contract_id=target_contract and d.driver_id=sig.signer_id)))
$$;
create function roadshow_private.require_driver_acceptance(target_contract uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not roadshow_private.current_driver_acceptance(target_contract) then raise exception 'Current driver agreement acceptance is required'; end if;
end $$;
create function public.contract_acceptance_gate(target_contract uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_active_user() or (public.is_admin() or public.is_contract_driver(target_contract) or exists(select 1 from public.contracts c where c.id=target_contract and c.driver_id=auth.uid())) is not true then return false; end if;
 return roadshow_private.current_driver_acceptance(target_contract);
end $$;
create function roadshow_private.guard_operational_acceptance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if roadshow_private.in_agreement_change() then return new; end if;
 if tg_op='INSERT' then
  if new.status not in ('upcoming','available','in_progress') or new.submitted_at is not null or new.reviewed_at is not null or new.reviewed_by is not null then raise exception 'Current driver agreement acceptance is required'; end if;
  return new;
 end if;
 if new.status in ('signed','submitted','under_review','approved','bonus_earned','bonus_not_earned')
  and (new.status is distinct from old.status or new.submitted_at is distinct from old.submitted_at or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by) then
  if not roadshow_private.driver_acceptance_for_version(new.id,new.current_agreement_id) then raise exception 'Current driver agreement acceptance is required'; end if;
 end if;
 return new;
end $$;
create trigger agreement_operational_gate before insert or update on public.contracts for each row execute function roadshow_private.guard_operational_acceptance();

create or replace function public.submit_my_checklist(target_contract_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_active_user() or (public.is_contract_driver(target_contract_id) or exists(select 1 from public.contracts where id=target_contract_id and driver_id=auth.uid())) is not true then raise exception 'Active assigned account required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 perform 1 from public.contracts where id=target_contract_id for update;
 perform roadshow_private.require_driver_acceptance(target_contract_id);
 perform roadshow_private.begin_agreement_change();
 perform roadshow_private.submit_my_checklist(target_contract_id);
 perform roadshow_private.end_agreement_change();
end $$;
create or replace function public.admin_finalize_checklist_review(target_contract uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 perform 1 from public.contracts where id=target_contract for update;
 perform roadshow_private.require_driver_acceptance(target_contract);
 perform roadshow_private.begin_agreement_change();
 result:=roadshow_private.admin_finalize_checklist_review(target_contract);
 perform roadshow_private.end_agreement_change(); return result;
end $$;
create or replace function public.admin_set_bonus_result(target_contract uuid,earned boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 perform 1 from public.contracts where id=target_contract for update;
 perform roadshow_private.require_driver_acceptance(target_contract);
 perform roadshow_private.admin_set_bonus_result(target_contract,earned);
end $$;
create or replace function public.set_my_checklist_item(target_checklist uuid,target_item uuid,new_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 perform roadshow_private.begin_agreement_change();
 perform roadshow_private.set_my_checklist_item(target_checklist,target_item,new_completed);
 perform roadshow_private.end_agreement_change();
end $$;
create or replace function public.admin_review_checklist_item(target_contract uuid,target_item uuid,target_status text,target_note text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 perform roadshow_private.require_driver_acceptance(target_contract);
 perform roadshow_private.begin_agreement_change();
 perform roadshow_private.admin_review_checklist_item(target_contract,target_item,target_status,target_note);
 perform roadshow_private.end_agreement_change();
end $$;
-- Browser writes cannot forge review decisions or bypass editable-draft rules.
-- Existing application response writes already use the guarded RPCs above.
create function roadshow_private.guard_checklist_response_write() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not roadshow_private.in_agreement_change() then raise exception 'Use checklist review and draft RPCs'; end if;
 return coalesce(new,old);
end $$;
create trigger agreement_response_guard before insert or update or delete on public.checklist_responses
 for each row execute function roadshow_private.guard_checklist_response_write();
revoke all on all functions in schema roadshow_private from public,anon,authenticated;
revoke all on function public.contract_acceptance_gate(uuid) from public,anon;
grant execute on function public.contract_acceptance_gate(uuid) to authenticated;
commit;
