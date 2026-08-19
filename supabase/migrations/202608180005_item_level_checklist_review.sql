-- Roadshow Driver beta: item-level checklist review and persistent history

alter table public.checklist_responses
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

create or replace function public.guard_driver_contract_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid()=old.driver_id and not public.is_admin() then
    if current_setting('roadshow.checklist_submission',true)='true' then
      return new;
    end if;
    if (to_jsonb(new)-array['signature_name','signed_at','status','updated_at'])
      is distinct from
      (to_jsonb(old)-array['signature_name','signed_at','status','updated_at'])
      or new.status not in ('signed','in_progress') then
      raise exception 'Drivers may only sign or begin their assigned contract';
    end if;
  end if;
  return new;
end $$;

create or replace function public.submit_my_checklist(target_contract_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(
    select 1 from public.contract_checklists
    where contract_id=target_contract_id
  ) then
    raise exception 'This contract does not have a checklist yet';
  end if;
  if exists(
    select 1
    from public.contract_checklists cc
    join public.checklist_items i on i.section_id in (
      select id from public.checklist_sections where template_id=cc.template_id
    )
    left join public.checklist_responses r
      on r.contract_checklist_id=cc.id and r.item_id=i.id
    where cc.contract_id=target_contract_id
      and i.required
      and coalesce(r.completed,false)=false
  ) then
    raise exception 'Complete every required checklist item first';
  end if;

  perform set_config('roadshow.checklist_submission','true',true);
  update public.contracts
  set status='submitted',submitted_at=now(),updated_at=now()
  where id=target_contract_id
    and (driver_id=auth.uid() or public.is_contract_driver(id))
    and signed_at is not null;
  if not found then
    raise exception 'The lead driver must sign the contract before submission';
  end if;
end $$;
grant execute on function public.submit_my_checklist(uuid) to authenticated;

create or replace function public.admin_review_checklist_item(
  target_contract uuid,
  target_item uuid,
  target_status text,
  target_note text default null
)
returns void language plpgsql security definer set search_path=public as $$
declare
  checklist_id uuid;
  template_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if target_status not in ('approved','denied') then
    raise exception 'Review status must be approved or denied';
  end if;
  if target_status='denied' and length(trim(coalesce(target_note,'')))=0 then
    raise exception 'Add a note explaining what needs to be corrected';
  end if;

  select cc.id,cc.template_id into checklist_id,template_id
  from public.contract_checklists cc
  join public.contracts c on c.id=cc.contract_id
  where cc.contract_id=target_contract
    and c.status in ('submitted','under_review');
  if checklist_id is null then
    raise exception 'This checklist is not waiting for review';
  end if;

  if not exists(
    select 1
    from public.checklist_items i
    join public.checklist_sections s on s.id=i.section_id
    where i.id=target_item and s.template_id=template_id
  ) then
    raise exception 'This item is not part of the submitted checklist';
  end if;

  insert into public.checklist_responses(
    contract_checklist_id,item_id,completed,review_status,review_note,
    reviewed_by,reviewed_at
  ) values(
    checklist_id,target_item,false,target_status,nullif(trim(target_note),''),
    auth.uid(),now()
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
  checklist_id uuid;
  template_id uuid;
  pending_count integer;
  denied_count integer;
  final_status text;
  notification_kind text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select cc.id,cc.template_id into checklist_id,template_id
  from public.contract_checklists cc
  join public.contracts c on c.id=cc.contract_id
  where cc.contract_id=target_contract
    and c.status in ('submitted','under_review');
  if checklist_id is null then
    raise exception 'This checklist is not waiting for review';
  end if;

  select count(*) into pending_count
  from public.checklist_items i
  join public.checklist_sections s on s.id=i.section_id
  left join public.checklist_responses r
    on r.contract_checklist_id=checklist_id and r.item_id=i.id
  where s.template_id=template_id
    and coalesce(r.review_status,'pending')='pending';
  if pending_count>0 then
    raise exception 'Review every checklist item before finishing';
  end if;

  select count(*) into denied_count
  from public.checklist_items i
  join public.checklist_sections s on s.id=i.section_id
  join public.checklist_responses r
    on r.contract_checklist_id=checklist_id and r.item_id=i.id
  where s.template_id=template_id and r.review_status='denied';

  if denied_count>0 then
    final_status='in_progress';
    notification_kind='checklist_changes';
    update public.checklist_responses r
    set completed=false,completed_at=null
    from public.checklist_items i
    join public.checklist_sections s on s.id=i.section_id
    where r.contract_checklist_id=checklist_id
      and r.item_id=i.id
      and s.template_id=template_id
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

create or replace function public.set_my_checklist_item(
  target_checklist uuid,
  target_item uuid,
  new_completed boolean
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(
    select 1
    from public.contract_checklists cc
    join public.contracts c on c.id=cc.contract_id
    join public.checklist_items i on i.id=target_item
    join public.checklist_sections s
      on s.id=i.section_id and s.template_id=cc.template_id
    where cc.id=target_checklist
      and c.status not in ('submitted','under_review','approved')
      and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))
      and not exists(
        select 1 from public.checklist_responses existing_response
        where existing_response.contract_checklist_id=target_checklist
          and existing_response.item_id=target_item
          and existing_response.review_status='approved'
      )
  ) then
    raise exception 'This checklist is not currently editable';
  end if;

  insert into public.checklist_responses(
    contract_checklist_id,item_id,completed,completed_at
  ) values(
    target_checklist,target_item,new_completed,
    case when new_completed then now() else null end
  )
  on conflict(contract_checklist_id,item_id) do update set
    completed=excluded.completed,
    completed_at=excluded.completed_at,
    review_status=null,
    review_note=null,
    reviewed_by=null,
    reviewed_at=null;
end $$;
grant execute on function public.set_my_checklist_item(uuid,uuid,boolean) to authenticated;
