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
