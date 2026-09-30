-- Beta 5A reliability: active-account enforcement and final-admin protection.

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and is_active)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_active_user() and exists(
    select 1 from public.profiles where id=auth.uid() and role='admin'
  )
$$;

create or replace function public.is_contract_driver(target_contract uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_active_user() and exists(
    select 1 from public.contract_drivers
    where contract_id=target_contract and driver_id=auth.uid()
  )
$$;

create or replace function public.is_chat_member(target_thread uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_active_user() and exists(
    select 1 from public.chat_thread_members
    where thread_id=target_thread and user_id=auth.uid()
  )
$$;

create or replace function public.admin_update_user(
  target_user uuid,new_role public.app_role,new_active boolean
) returns void language plpgsql security definer set search_path=public as $$
declare
  target_was_active_admin boolean;
  active_admin_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if target_user=auth.uid() and not new_active then
    raise exception 'You cannot deactivate your own account';
  end if;

  -- Serialize every decision that can reduce the active-admin set.
  perform id from public.profiles where role='admin' and is_active for update;
  select role='admin' and is_active into target_was_active_admin
  from public.profiles where id=target_user;
  if target_was_active_admin and (new_role<>'admin' or not new_active) then
    select count(*) into active_admin_count
    from public.profiles where role='admin' and is_active;
    if active_admin_count<=1 then
      raise exception 'At least one active administrator is required';
    end if;
  end if;

  update public.profiles
  set role=new_role,is_active=new_active,updated_at=now()
  where id=target_user;
  if not found then raise exception 'User not found'; end if;
end $$;

-- An inactive user can read their own profile so the client can explain the block.
drop policy if exists "active team directory read" on public.profiles;
create policy "active team directory read" on public.profiles for select to authenticated
using(id=auth.uid() or (public.is_active_user() and (is_active or public.is_admin())));
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated
using(id=auth.uid() and public.is_active_user())
with check(id=auth.uid() and public.is_active_user());

drop policy if exists "shows published or assigned read" on public.shows;
create policy "shows published or assigned read" on public.shows for select to authenticated using(
  public.is_active_user() and (
    public.is_admin()
    or exists(select 1 from public.availability_release_item_shows ris join public.availability_release_items ri on ri.id=ris.release_item_id where ris.show_id=shows.id and ri.status in ('open','assigned'))
    or exists(select 1 from public.contracts c where c.show_id=shows.id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id)))
  )
);

drop policy if exists "contracts assigned read" on public.contracts;
create policy "contracts assigned read" on public.contracts for select to authenticated using(
  public.is_active_user() and (driver_id=auth.uid() or public.is_contract_driver(id) or public.is_admin())
);
drop policy if exists "drivers sign assigned contracts" on public.contracts;
create policy "drivers sign assigned contracts" on public.contracts for update to authenticated
using(public.is_active_user() and (driver_id=auth.uid() or public.is_contract_driver(id)))
with check(public.is_active_user() and (driver_id=auth.uid() or public.is_contract_driver(id)));

drop policy if exists "contract checklists assigned read" on public.contract_checklists;
create policy "contract checklists assigned read" on public.contract_checklists for select to authenticated using(
  public.is_active_user() and (public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))))
);
drop policy if exists "responses assigned manage" on public.checklist_responses;
create policy "responses assigned manage" on public.checklist_responses for all to authenticated using(
  public.is_active_user() and (public.is_admin() or exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.id=contract_checklist_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))))
) with check(
  public.is_active_user() and (public.is_admin() or exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.id=contract_checklist_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))))
);
drop policy if exists "photos assigned read" on public.photos;
create policy "photos assigned read" on public.photos for select to authenticated using(
  public.is_active_user() and (public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))))
);
drop policy if exists "photos assigned insert" on public.photos;
create policy "photos assigned insert" on public.photos for insert to authenticated with check(
  public.is_active_user() and uploaded_by=auth.uid() and exists(select 1 from public.contracts c where c.id=contract_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id)))
);

drop policy if exists "availability own manage" on public.availability;
create policy "availability own manage" on public.availability for all to authenticated
using(public.is_active_user() and (driver_id=auth.uid() or public.is_admin()))
with check(public.is_active_user() and (driver_id=auth.uid() or public.is_admin()));
drop policy if exists "resources published read" on public.resources;
create policy "resources published read" on public.resources for select to authenticated
using(public.is_active_user() and (published or public.is_admin()));
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select to authenticated
using(public.is_active_user() and (recipient_id=auth.uid() or public.is_admin()));
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update to authenticated
using(public.is_active_user() and recipient_id=auth.uid())
with check(public.is_active_user() and recipient_id=auth.uid());

drop policy if exists "notification preferences own read" on public.notification_preferences;
create policy "notification preferences own read" on public.notification_preferences for select to authenticated
using(public.is_active_user() and (user_id=auth.uid() or public.is_admin()));
drop policy if exists "notification preferences own update" on public.notification_preferences;
create policy "notification preferences own update" on public.notification_preferences for update to authenticated
using(public.is_active_user() and user_id=auth.uid()) with check(public.is_active_user() and user_id=auth.uid());
drop policy if exists "notification preferences own insert" on public.notification_preferences;
create policy "notification preferences own insert" on public.notification_preferences for insert to authenticated
with check(public.is_active_user() and user_id=auth.uid());
grant insert on public.notification_preferences to authenticated;

drop policy if exists "push subscriptions own read" on public.push_subscriptions;
create policy "push subscriptions own read" on public.push_subscriptions for select to authenticated using(public.is_active_user() and user_id=auth.uid());
drop policy if exists "push subscriptions own insert" on public.push_subscriptions;
create policy "push subscriptions own insert" on public.push_subscriptions for insert to authenticated with check(public.is_active_user() and user_id=auth.uid());
drop policy if exists "push subscriptions own update" on public.push_subscriptions;
create policy "push subscriptions own update" on public.push_subscriptions for update to authenticated using(public.is_active_user() and user_id=auth.uid()) with check(public.is_active_user() and user_id=auth.uid());
drop policy if exists "push subscriptions own delete" on public.push_subscriptions;
create policy "push subscriptions own delete" on public.push_subscriptions for delete to authenticated using(public.is_active_user() and user_id=auth.uid());

drop policy if exists "chat members read threads" on public.chat_threads;
create policy "chat members read threads" on public.chat_threads for select to authenticated using(public.is_chat_member(id));
drop policy if exists "chat members read membership" on public.chat_thread_members;
create policy "chat members read membership" on public.chat_thread_members for select to authenticated using(public.is_chat_member(thread_id));
drop policy if exists "chat members read messages" on public.chat_messages;
create policy "chat members read messages" on public.chat_messages for select to authenticated using(public.is_chat_member(thread_id));

drop policy if exists "drivers submit feedback" on public.feedback;
create policy "drivers submit feedback" on public.feedback for insert to authenticated with check(public.is_active_user() and submitted_by=auth.uid());
drop policy if exists "drivers read own feedback" on public.feedback;
create policy "drivers read own feedback" on public.feedback for select to authenticated using(public.is_active_user() and (submitted_by=auth.uid() or public.is_admin()));

drop policy if exists "contract drivers own read" on public.contract_drivers;
create policy "contract drivers own read" on public.contract_drivers for select to authenticated using(public.is_active_user() and (driver_id=auth.uid() or public.is_admin()));
drop policy if exists "message participants read" on public.messages;
create policy "message participants read" on public.messages for select to authenticated using(public.is_active_user() and (sender_id=auth.uid() or recipient_id=auth.uid() or public.is_admin()));
drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read" on public.messages for update to authenticated using(public.is_active_user() and recipient_id=auth.uid()) with check(public.is_active_user() and recipient_id=auth.uid());

drop policy if exists "assigned toolbag read" on public.toolbags;
create policy "assigned toolbag read" on public.toolbags for select to authenticated using(public.is_active_user() and (assigned_to=auth.uid() or public.is_admin()));
drop policy if exists "assigned toolbag items read" on public.toolbag_items;
create policy "assigned toolbag items read" on public.toolbag_items for select to authenticated using(public.is_active_user() and (public.is_admin() or exists(select 1 from public.toolbags t where t.id=toolbag_id and t.assigned_to=auth.uid())));
drop policy if exists "toolbag reports own insert" on public.toolbag_reports;
create policy "toolbag reports own insert" on public.toolbag_reports for insert to authenticated with check(public.is_active_user() and reported_by=auth.uid() and exists(select 1 from public.toolbags t where t.id=toolbag_id and t.assigned_to=auth.uid()));
drop policy if exists "toolbag reports own read" on public.toolbag_reports;
create policy "toolbag reports own read" on public.toolbag_reports for select to authenticated using(public.is_active_user() and (reported_by=auth.uid() or public.is_admin()));

-- Public-to-authenticated catalog policies also require an active account.
drop policy if exists "templates authenticated read" on public.checklist_templates;
create policy "templates authenticated read" on public.checklist_templates for select to authenticated using(public.is_active_user());
drop policy if exists "sections authenticated read" on public.checklist_sections;
create policy "sections authenticated read" on public.checklist_sections for select to authenticated using(public.is_active_user());
drop policy if exists "items authenticated read" on public.checklist_items;
create policy "items authenticated read" on public.checklist_items for select to authenticated using(public.is_active_user());
drop policy if exists "show checklist authenticated read" on public.show_checklist_templates;
create policy "show checklist authenticated read" on public.show_checklist_templates for select to authenticated using(public.is_active_user());
drop policy if exists "contract templates authenticated read" on public.contract_templates;
create policy "contract templates authenticated read" on public.contract_templates for select to authenticated using(public.is_active_user() and (active or public.is_admin()));
drop policy if exists "show links authenticated read" on public.show_links;
create policy "show links authenticated read" on public.show_links for select to authenticated using(public.is_active_user());
drop policy if exists "toolbag templates authenticated read" on public.toolbag_templates;
create policy "toolbag templates authenticated read" on public.toolbag_templates for select to authenticated using(public.is_active_user());
drop policy if exists "toolbag template items authenticated read" on public.toolbag_template_items;
create policy "toolbag template items authenticated read" on public.toolbag_template_items for select to authenticated using(public.is_active_user());

-- Storage access follows the same active-profile rule.
drop policy if exists "drivers upload own roadshow photos" on storage.objects;
create policy "drivers upload own roadshow photos" on storage.objects for insert to authenticated
with check(public.is_active_user() and bucket_id='roadshow-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "drivers read own roadshow photos" on storage.objects;
create policy "drivers read own roadshow photos" on storage.objects for select to authenticated
using(public.is_active_user() and bucket_id='roadshow-photos' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
drop policy if exists "drivers delete own roadshow photos" on storage.objects;
create policy "drivers delete own roadshow photos" on storage.objects for delete to authenticated
using(public.is_active_user() and bucket_id='roadshow-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "authenticated read resource files" on storage.objects;
create policy "authenticated read resource files" on storage.objects for select to authenticated
using(public.is_active_user() and bucket_id='resources');

grant execute on function public.is_active_user() to authenticated;
grant execute on function public.admin_update_user(uuid,public.app_role,boolean) to authenticated;

create or replace function public.admin_save_show_contract(target_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  result_show uuid:=nullif(target_payload->>'show_id','')::uuid;
  result_contract uuid:=nullif(target_payload->>'contract_id','')::uuid;
  template_id uuid:=nullif(target_payload->>'template_id','')::uuid;
  driver_ids uuid[];
  external_names text[];
  contract_kind public.contract_kind:=(target_payload->>'kind')::public.contract_kind;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if length(trim(coalesce(target_payload->>'name','')))=0 then raise exception 'Show name is required'; end if;
  if (target_payload->>'starts_on')::date>(target_payload->>'ends_on')::date then raise exception 'Show end date must be on or after its start date'; end if;

  if result_show is null then
    insert into public.shows(name,starts_on,ends_on,city,state,address,bin_count,meals_included,lodging_included,details_unlock_at,event_type,per_diem,lodging_name,lodging_address,lodging_phone,lodging_confirmation,lodging_check_in,lodging_check_out,lodging_notes)
    values(trim(target_payload->>'name'),(target_payload->>'starts_on')::date,(target_payload->>'ends_on')::date,trim(target_payload->>'city'),nullif(trim(target_payload->>'state'),''),nullif(trim(target_payload->>'address'),''),nullif(target_payload->>'bin_count','')::integer,false,coalesce((target_payload->>'lodging_included')::boolean,false),((target_payload->>'starts_on')::date-3)::timestamptz,'show',nullif(target_payload->>'per_diem','')::numeric,nullif(trim(target_payload->>'lodging_name'),''),nullif(trim(target_payload->>'lodging_address'),''),nullif(trim(target_payload->>'lodging_phone'),''),nullif(trim(target_payload->>'lodging_confirmation'),''),nullif(target_payload->>'lodging_check_in','')::date,nullif(target_payload->>'lodging_check_out','')::date,nullif(trim(target_payload->>'lodging_notes'),''))
    returning id into result_show;
  else
    update public.shows set name=trim(target_payload->>'name'),starts_on=(target_payload->>'starts_on')::date,ends_on=(target_payload->>'ends_on')::date,city=trim(target_payload->>'city'),state=nullif(trim(target_payload->>'state'),''),address=nullif(trim(target_payload->>'address'),''),bin_count=nullif(target_payload->>'bin_count','')::integer,lodging_included=coalesce((target_payload->>'lodging_included')::boolean,false),per_diem=nullif(target_payload->>'per_diem','')::numeric,lodging_name=nullif(trim(target_payload->>'lodging_name'),''),lodging_address=nullif(trim(target_payload->>'lodging_address'),''),lodging_phone=nullif(trim(target_payload->>'lodging_phone'),''),lodging_confirmation=nullif(trim(target_payload->>'lodging_confirmation'),''),lodging_check_in=nullif(target_payload->>'lodging_check_in','')::date,lodging_check_out=nullif(target_payload->>'lodging_check_out','')::date,lodging_notes=nullif(trim(target_payload->>'lodging_notes'),'' ) where id=result_show and event_type='show';
    if not found then raise exception 'Show not found'; end if;
  end if;

  if result_contract is null then select id into result_contract from public.contracts where show_id=result_show order by created_at desc limit 1; end if;
  if result_contract is null then
    insert into public.contracts(show_id,kind,status,service_date,service_time,contract_pay,bonus_pay,terms)
    values(result_show,contract_kind,'available',(target_payload->>'service_date')::date,nullif(target_payload->>'service_time','')::time,nullif(target_payload->>'contract_pay','')::numeric,nullif(target_payload->>'bonus_pay','')::numeric,nullif(target_payload->>'terms','')) returning id into result_contract;
  else
    update public.contracts set kind=contract_kind,service_date=(target_payload->>'service_date')::date,service_time=nullif(target_payload->>'service_time','')::time,contract_pay=nullif(target_payload->>'contract_pay','')::numeric,bonus_pay=nullif(target_payload->>'bonus_pay','')::numeric,terms=nullif(target_payload->>'terms',''),updated_at=now() where id=result_contract and show_id=result_show;
    if not found then raise exception 'Contract not found'; end if;
  end if;

  select coalesce(array_agg(value::uuid order by ordinality),array[]::uuid[]) into driver_ids from jsonb_array_elements_text(coalesce(target_payload->'driver_ids','[]'::jsonb)) with ordinality input(value,ordinality);
  select coalesce(array_agg(value order by ordinality),array[]::text[]) into external_names from jsonb_array_elements_text(coalesce(target_payload->'external_names','[]'::jsonb)) with ordinality input(value,ordinality);
  perform public.admin_replace_opportunity_assignments(null,array[result_show],driver_ids,external_names);

  if template_id is not null then
    if not exists(select 1 from public.checklist_templates where id=template_id and active and kind=contract_kind) then raise exception 'The selected checklist template is unavailable or has the wrong contract type'; end if;
    insert into public.show_checklist_templates(show_id,kind,template_id) values(result_show,contract_kind,template_id) on conflict(show_id,kind) do update set template_id=excluded.template_id;
    perform public.admin_assign_checklist(result_contract,template_id);
  else
    delete from public.show_checklist_templates where show_id=result_show and kind=contract_kind;
    delete from public.contract_checklists where contract_id=result_contract;
  end if;
  return result_contract;
end $$;

create or replace function public.admin_save_signing(target_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  result_show uuid:=nullif(target_payload->>'show_id','')::uuid;
  result_contract uuid:=nullif(target_payload->>'contract_id','')::uuid;
  template_id uuid:=nullif(target_payload->>'template_id','')::uuid;
  signing_time timestamptz:=(target_payload->>'signing_at')::timestamptz;
  setup_time timestamptz:=(target_payload->>'setup_at')::timestamptz;
  driver_ids uuid[];
  external_names text[];
  linked_ids uuid[];
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if length(trim(coalesce(target_payload->>'artist','')))=0 then raise exception 'Artist is required'; end if;
  if setup_time>signing_time then raise exception 'Setup time must be before the signing'; end if;
  if result_show is null then
    insert into public.shows(name,starts_on,ends_on,city,state,address,event_type,artist,venue_name,signing_at,setup_at,bin_count,meals_included,lodging_included)
    values(trim(target_payload->>'artist')||' signing',signing_time::date,signing_time::date,trim(target_payload->>'city'),nullif(trim(target_payload->>'state'),''),nullif(trim(target_payload->>'address'),''),'signing',trim(target_payload->>'artist'),trim(target_payload->>'venue_name'),signing_time,setup_time,null,false,false) returning id into result_show;
  else
    update public.shows set name=trim(target_payload->>'artist')||' signing',starts_on=signing_time::date,ends_on=signing_time::date,city=trim(target_payload->>'city'),state=nullif(trim(target_payload->>'state'),''),address=nullif(trim(target_payload->>'address'),''),artist=trim(target_payload->>'artist'),venue_name=trim(target_payload->>'venue_name'),signing_at=signing_time,setup_at=setup_time where id=result_show and event_type='signing';
    if not found then raise exception 'Signing not found'; end if;
  end if;
  if result_contract is null then select id into result_contract from public.contracts where show_id=result_show order by created_at desc limit 1; end if;
  if result_contract is null then insert into public.contracts(show_id,kind,status,service_date,service_time) values(result_show,'setup','available',setup_time::date,setup_time::time) returning id into result_contract;
  else update public.contracts set kind='setup',service_date=setup_time::date,service_time=setup_time::time,updated_at=now() where id=result_contract and show_id=result_show; end if;

  select coalesce(array_agg(value::uuid order by ordinality),array[]::uuid[]) into driver_ids from jsonb_array_elements_text(coalesce(target_payload->'driver_ids','[]'::jsonb)) with ordinality input(value,ordinality);
  select coalesce(array_agg(value order by ordinality),array[]::text[]) into external_names from jsonb_array_elements_text(coalesce(target_payload->'external_names','[]'::jsonb)) with ordinality input(value,ordinality);
  perform public.admin_replace_opportunity_assignments(null,array[result_show],driver_ids,external_names);
  if template_id is not null then
    if not exists(select 1 from public.checklist_templates where id=template_id and active) then raise exception 'The selected checklist template is unavailable'; end if;
    perform public.admin_assign_checklist(result_contract,template_id);
  else delete from public.contract_checklists where contract_id=result_contract;
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[]) into linked_ids from jsonb_array_elements_text(coalesce(target_payload->'linked_show_ids','[]'::jsonb)) input(value);
  if exists(select 1 from unnest(linked_ids) requested(id) left join public.shows s on s.id=requested.id and s.event_type='signing' where s.id is null or requested.id=result_show) then raise exception 'Every linked signing must still exist'; end if;
  delete from public.show_links where show_id=result_show or linked_show_id=result_show;
  insert into public.show_links(show_id,linked_show_id)
  select least(result_show,id),greatest(result_show,id) from unnest(linked_ids) id on conflict do nothing;
  return result_contract;
end $$;

grant execute on function public.admin_save_show_contract(jsonb) to authenticated;
grant execute on function public.admin_save_signing(jsonb) to authenticated;

create or replace function public.sign_my_contract(contract_id uuid,signer_name text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_user() then raise exception 'An active account is required'; end if;
  if length(trim(signer_name))<2 then raise exception 'A full legal name is required'; end if;
  update public.contracts set signature_name=trim(signer_name),signed_at=now(),status='signed',updated_at=now()
  where id=contract_id and (driver_id=auth.uid() or public.is_contract_driver(id)) and signed_at is null;
  if not found then raise exception 'Contract is unavailable or already signed'; end if;
end $$;

create or replace function public.set_my_checklist_item(target_checklist uuid,target_item uuid,new_completed boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_user() then raise exception 'An active account is required'; end if;
  if not exists(
    select 1 from public.contract_checklists cc
    join public.contracts c on c.id=cc.contract_id
    join public.checklist_items i on i.id=target_item
    join public.checklist_sections s on s.id=i.section_id and s.template_id=cc.template_id
    where cc.id=target_checklist and c.status not in ('submitted','under_review','approved')
      and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))
      and not exists(select 1 from public.checklist_responses r where r.contract_checklist_id=target_checklist and r.item_id=target_item and r.review_status='approved')
  ) then raise exception 'This checklist is not currently editable'; end if;
  insert into public.checklist_responses(contract_checklist_id,item_id,completed,completed_at)
  values(target_checklist,target_item,new_completed,case when new_completed then now() else null end)
  on conflict(contract_checklist_id,item_id) do update set completed=excluded.completed,completed_at=excluded.completed_at,review_status=null,review_note=null,reviewed_by=null,reviewed_at=null;
end $$;

create or replace function public.submit_my_checklist(target_contract_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_user() then raise exception 'An active account is required'; end if;
  if not exists(select 1 from public.contract_checklists where contract_id=target_contract_id) then raise exception 'This contract does not have a checklist yet'; end if;
  if exists(
    select 1 from public.contract_checklists cc
    join public.checklist_items i on i.section_id in (select id from public.checklist_sections where template_id=cc.template_id)
    left join public.checklist_responses r on r.contract_checklist_id=cc.id and r.item_id=i.id
    where cc.contract_id=target_contract_id and i.required and not coalesce(r.completed,false)
  ) then raise exception 'Complete every required checklist item first'; end if;
  update public.contracts set status='submitted',submitted_at=now(),updated_at=now()
  where id=target_contract_id and (driver_id=auth.uid() or public.is_contract_driver(id)) and signed_at is not null;
  if not found then raise exception 'The lead driver must sign the contract before submission'; end if;
end $$;

create or replace function public.mark_chat_thread_read(target_thread uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_chat_member(target_thread) then raise exception 'You are not part of this chat'; end if;
  update public.chat_thread_members set read_at=now() where thread_id=target_thread and user_id=auth.uid();
end $$;

create or replace function public.save_my_push_subscription(target_endpoint text,target_p256dh text,target_auth text,target_user_agent text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_user() then raise exception 'An active account is required'; end if;
  delete from public.push_subscriptions where endpoint=target_endpoint;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent)
  values(auth.uid(),target_endpoint,target_p256dh,target_auth,target_user_agent);
end $$;
