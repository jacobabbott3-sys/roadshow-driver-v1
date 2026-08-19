-- Roadshow Driver beta: review workflow and configurable device notifications

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  device_notifications boolean not null default false,
  assignment_alerts boolean not null default true,
  work_day_alerts boolean not null default true,
  message_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.notification_preferences(user_id)
select id from public.profiles
on conflict(user_id) do nothing;

create or replace function public.create_notification_preferences()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notification_preferences(user_id)
  values(new.id)
  on conflict(user_id) do nothing;
  return new;
end $$;

create trigger create_notification_preferences
after insert on public.profiles
for each row execute function public.create_notification_preferences();

alter table public.notification_preferences enable row level security;
create policy "notification preferences own read" on public.notification_preferences
for select using(user_id=auth.uid() or public.is_admin());
create policy "notification preferences own update" on public.notification_preferences
for update using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on public.notification_preferences to authenticated;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy "push subscriptions own read" on public.push_subscriptions
for select using(user_id=auth.uid());
create policy "push subscriptions own insert" on public.push_subscriptions
for insert with check(user_id=auth.uid());
create policy "push subscriptions own update" on public.push_subscriptions
for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "push subscriptions own delete" on public.push_subscriptions
for delete using(user_id=auth.uid());
grant select,insert,update,delete on public.push_subscriptions to authenticated;

create or replace function public.save_my_push_subscription(
  target_endpoint text,
  target_p256dh text,
  target_auth text,
  target_user_agent text default null
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from public.push_subscriptions where endpoint=target_endpoint;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent)
  values(auth.uid(),target_endpoint,target_p256dh,target_auth,target_user_agent);
end $$;
grant execute on function public.save_my_push_subscription(text,text,text,text) to authenticated;

create or replace function public.remove_my_push_subscription(target_endpoint text)
returns void language sql security definer set search_path=public as $$
  delete from public.push_subscriptions
  where user_id=auth.uid() and endpoint=target_endpoint
$$;
grant execute on function public.remove_my_push_subscription(text) to authenticated;

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

create or replace function public.notify_checklist_submission()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='submitted' and old.status is distinct from new.status then
    insert into public.notifications(recipient_id,title,body,link,kind,contract_id)
    select p.id,'Checklist ready for review',s.name||' has been submitted for review.',
      '/admin/checklists','checklist_review',new.id
    from public.profiles p
    join public.shows s on s.id=new.show_id
    where p.role='admin' and p.is_active
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger notify_checklist_submission
after update of status on public.contracts
for each row execute function public.notify_checklist_submission();

create or replace function public.create_due_work_notifications()
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_id,title,body,link,kind,contract_id)
  select assignment.driver_id,
    'Work scheduled today',
    case when assignment.kind='setup'
      then 'Your setup is scheduled for today.'
      else 'Your teardown is scheduled for today.' end,
    '/contracts/'||assignment.contract_id,
    'work_day',
    assignment.contract_id
  from (
    select c.id contract_id,c.kind,c.driver_id
    from public.contracts c
    where c.service_date=current_date and c.driver_id is not null
    union
    select c.id,c.kind,cd.driver_id
    from public.contracts c
    join public.contract_drivers cd on cd.contract_id=c.id
    where c.service_date=current_date
  ) assignment
  on conflict do nothing;
end $$;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
