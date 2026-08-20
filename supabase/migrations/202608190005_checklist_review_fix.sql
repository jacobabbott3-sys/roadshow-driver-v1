-- Roadshow Driver: remove PL/pgSQL naming collisions from checklist review

create or replace function public.admin_review_checklist_item(
  target_contract uuid,
  target_item uuid,
  target_status text,
  target_note text default null
)
returns void language plpgsql security definer set search_path=public as $$
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
    where i.id=target_item and s.template_id=selected_template_id
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

grant execute on function public.admin_review_checklist_item(uuid,uuid,text,text) to authenticated;

create or replace function public.admin_finalize_checklist_review(target_contract uuid)
returns text language plpgsql security definer set search_path=public as $$
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
  where s.template_id=selected_template_id
    and coalesce(r.review_status,'pending')='pending';
  if pending_count>0 then
    raise exception 'Review every checklist item before finishing';
  end if;

  select count(*) into denied_count
  from public.checklist_items i
  join public.checklist_sections s on s.id=i.section_id
  join public.checklist_responses r
    on r.contract_checklist_id=selected_checklist_id and r.item_id=i.id
  where s.template_id=selected_template_id and r.review_status='denied';

  if denied_count>0 then
    final_status='in_progress';
    notification_kind='checklist_changes';
    update public.checklist_responses r
    set completed=false,completed_at=null
    from public.checklist_items i
    join public.checklist_sections s on s.id=i.section_id
    where r.contract_checklist_id=selected_checklist_id
      and r.item_id=i.id
      and s.template_id=selected_template_id
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

grant execute on function public.admin_finalize_checklist_review(uuid) to authenticated;
