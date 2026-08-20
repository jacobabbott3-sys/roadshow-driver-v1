-- Roadshow Driver beta: appearance, group chat, signings, templates, and travel details

alter table public.profiles
  add column if not exists theme_preference text not null default 'light'
    check(theme_preference in ('light','dark','system')),
  add column if not exists color_scheme text not null default 'forest'
    check(color_scheme in ('forest','blue','purple','rust'));

grant update(full_name,avatar_url,phone,updated_at,theme_preference,color_scheme)
on public.profiles to authenticated;

drop policy if exists "profiles own read" on public.profiles;
create policy "active team directory read" on public.profiles
for select to authenticated
using(is_active or id=auth.uid() or public.is_admin());

alter table public.shows
  add column if not exists event_type text not null default 'show'
    check(event_type in ('show','signing')),
  add column if not exists artist text,
  add column if not exists venue_name text,
  add column if not exists signing_at timestamptz,
  add column if not exists setup_at timestamptz,
  add column if not exists per_diem numeric(10,2) check(per_diem>=0),
  add column if not exists lodging_name text,
  add column if not exists lodging_address text,
  add column if not exists lodging_phone text,
  add column if not exists lodging_confirmation text,
  add column if not exists lodging_check_in date,
  add column if not exists lodging_check_out date,
  add column if not exists lodging_notes text;

alter table public.contracts
  add column if not exists service_time time;

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind public.contract_kind not null,
  contract_pay numeric(10,2) check(contract_pay>=0),
  bonus_pay numeric(10,2) check(bonus_pay>=0),
  terms text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contract_templates enable row level security;
create policy "contract templates authenticated read" on public.contract_templates
for select to authenticated using(active or public.is_admin());
create policy "contract templates admin manage" on public.contract_templates
for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.admin_replace_toolbag_template(
  target_template uuid,target_name text,target_items jsonb
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.toolbag_templates set name=trim(target_name) where id=target_template;
  delete from public.toolbag_template_items where template_id=target_template;
  insert into public.toolbag_template_items(template_id,name,quantity,position)
  select target_template,trim(item->>'name'),coalesce((item->>'quantity')::integer,1),ordinality-1
  from jsonb_array_elements(target_items) with ordinality as values_list(item,ordinality)
  where length(trim(item->>'name'))>0;
end $$;
grant execute on function public.admin_replace_toolbag_template(uuid,text,jsonb) to authenticated;

create table public.show_links (
  show_id uuid not null references public.shows(id) on delete cascade,
  linked_show_id uuid not null references public.shows(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(show_id,linked_show_id),
  check(show_id<linked_show_id)
);
alter table public.show_links enable row level security;
create policy "show links authenticated read" on public.show_links
for select to authenticated using(true);
create policy "show links admin manage" on public.show_links
for all to authenticated using(public.is_admin()) with check(public.is_admin());

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Team chat',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  read_at timestamptz,
  primary key(thread_id,user_id)
);
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check(length(trim(body))>0),
  created_at timestamptz not null default now()
);
create index chat_threads_updated_idx on public.chat_threads(updated_at desc);
create index chat_messages_thread_idx on public.chat_messages(thread_id,created_at);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.is_chat_member(target_thread uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.chat_thread_members
    where thread_id=target_thread and user_id=auth.uid()
  )
$$;

create policy "chat members read threads" on public.chat_threads
for select to authenticated using(public.is_chat_member(id));
create policy "chat members read membership" on public.chat_thread_members
for select to authenticated using(public.is_chat_member(thread_id));
create policy "chat members read messages" on public.chat_messages
for select to authenticated using(public.is_chat_member(thread_id));

create or replace function public.create_chat_thread(
  target_recipients uuid[],target_subject text,target_body text
) returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
    raise exception 'An active account is required';
  end if;
  if length(trim(coalesce(target_body,'')))=0 then raise exception 'Write a message first'; end if;
  if not exists(
    select 1 from public.profiles
    where id=any(target_recipients) and is_active and id<>auth.uid()
  ) then raise exception 'Choose at least one recipient'; end if;

  insert into public.chat_threads(subject,created_by)
  values(coalesce(nullif(trim(target_subject),''),'Team chat'),auth.uid())
  returning id into result_id;
  insert into public.chat_thread_members(thread_id,user_id,read_at)
  values(result_id,auth.uid(),now());
  insert into public.chat_thread_members(thread_id,user_id)
  select result_id,id from public.profiles
  where id=any(target_recipients) and is_active and id<>auth.uid()
  on conflict do nothing;
  insert into public.chat_messages(thread_id,sender_id,body)
  values(result_id,auth.uid(),trim(target_body));
  update public.chat_thread_members set read_at=now()
  where thread_id=result_id and user_id=auth.uid();
  return result_id;
end $$;
grant execute on function public.create_chat_thread(uuid[],text,text) to authenticated;

create or replace function public.send_chat_message(target_thread uuid,target_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid;
begin
  if not public.is_chat_member(target_thread) then raise exception 'You are not part of this chat'; end if;
  if length(trim(coalesce(target_body,'')))=0 then raise exception 'Write a message first'; end if;
  insert into public.chat_messages(thread_id,sender_id,body)
  values(target_thread,auth.uid(),trim(target_body)) returning id into result_id;
  update public.chat_threads set updated_at=now() where id=target_thread;
  update public.chat_thread_members set read_at=now()
  where thread_id=target_thread and user_id=auth.uid();
  return result_id;
end $$;
grant execute on function public.send_chat_message(uuid,text) to authenticated;

create or replace function public.mark_chat_thread_read(target_thread uuid)
returns void language sql security definer set search_path=public as $$
  update public.chat_thread_members set read_at=now()
  where thread_id=target_thread and user_id=auth.uid()
$$;
grant execute on function public.mark_chat_thread_read(uuid) to authenticated;

create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.created_at < now()-interval '5 minutes' then return new; end if;
  insert into public.notifications(recipient_id,title,body,link,kind)
  select member.user_id,thread.subject,left(new.body,180),
    '/chat?thread='||new.thread_id,'message'
  from public.chat_thread_members member
  join public.chat_threads thread on thread.id=new.thread_id
  where member.thread_id=new.thread_id and member.user_id<>new.sender_id;
  return new;
end $$;
create trigger notify_chat_message after insert on public.chat_messages
for each row execute function public.notify_chat_message();

do $$
declare old_message record; migrated_thread uuid;
begin
  for old_message in select * from public.messages order by created_at loop
    insert into public.chat_threads(subject,created_by,created_at,updated_at)
    values(old_message.subject,old_message.sender_id,old_message.created_at,old_message.created_at)
    returning id into migrated_thread;
    insert into public.chat_thread_members(thread_id,user_id,read_at)
    values
      (migrated_thread,old_message.sender_id,old_message.created_at),
      (migrated_thread,old_message.recipient_id,old_message.read_at)
    on conflict do nothing;
    insert into public.chat_messages(thread_id,sender_id,body,created_at)
    values(migrated_thread,old_message.sender_id,old_message.body,old_message.created_at);
  end loop;
end $$;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages'
  ) then alter publication supabase_realtime add table public.chat_messages; end if;
end $$;

create or replace function public.get_public_show_assignments()
returns table(show_id uuid,assignees jsonb)
language sql stable security definer set search_path=public as $$
  with assigned as (
    select c.show_id,cd.driver_id
    from public.contracts c join public.contract_drivers cd on cd.contract_id=c.id
    union
    select c.show_id,c.driver_id from public.contracts c where c.driver_id is not null
  )
  select assigned.show_id,
    jsonb_agg(distinct jsonb_build_object(
      'id',p.id,'full_name',p.full_name,'role',p.role
    ))
  from assigned join public.profiles p on p.id=assigned.driver_id and p.is_active
  where auth.uid() is not null
  group by assigned.show_id
$$;
grant execute on function public.get_public_show_assignments() to authenticated;

create table public.app_settings (
  id boolean primary key default true check(id),
  contract_email_recipient text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.app_settings(id) values(true) on conflict do nothing;
alter table public.app_settings enable row level security;
create policy "app settings admin manage" on public.app_settings
for all to authenticated using(public.is_admin()) with check(public.is_admin());

create table public.contract_email_queue (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  recipient_email text not null,
  event_type text not null default 'signed',
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(contract_id,event_type)
);
alter table public.contract_email_queue enable row level security;
create policy "contract email queue admin read" on public.contract_email_queue
for select to authenticated using(public.is_admin());

create or replace function public.queue_signed_contract_email()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_email text;
begin
  if new.signed_at is not null and new.admin_signed_at is not null
    and (old.signed_at is null or old.admin_signed_at is null) then
    select contract_email_recipient into target_email from public.app_settings where id=true;
    if nullif(trim(coalesce(target_email,'')),'') is not null then
      insert into public.contract_email_queue(contract_id,recipient_email)
      values(new.id,target_email) on conflict do nothing;
    end if;
  end if;
  if new.status='bonus_earned' and old.status is distinct from new.status then
    select contract_email_recipient into target_email from public.app_settings where id=true;
    if nullif(trim(coalesce(target_email,'')),'') is not null then
      insert into public.contract_email_queue(contract_id,recipient_email,event_type)
      values(new.id,target_email,'bonus_earned') on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger queue_signed_contract_email
after update of signed_at,admin_signed_at,status on public.contracts
for each row execute function public.queue_signed_contract_email();

create or replace function public.admin_set_bonus_result(target_contract uuid,earned boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.contracts set
    status=case when earned then 'bonus_earned'::public.contract_status else 'bonus_not_earned'::public.contract_status end,
    updated_at=now()
  where id=target_contract and status in ('approved','bonus_earned','bonus_not_earned');
  if not found then raise exception 'Approve the checklist before recording the bonus'; end if;
end $$;
grant execute on function public.admin_set_bonus_result(uuid,boolean) to authenticated;

create or replace function public.set_my_checklist_item(
  target_checklist uuid,target_item uuid,new_completed boolean
) returns void language plpgsql security definer set search_path=public as $$
declare target_contract uuid; target_event_type text;
begin
  select c.id,s.event_type into target_contract,target_event_type
  from public.contract_checklists cc
  join public.contracts c on c.id=cc.contract_id
  join public.shows s on s.id=c.show_id
  join public.checklist_items i on i.id=target_item
  join public.checklist_sections section
    on section.id=i.section_id and section.template_id=cc.template_id
  where cc.id=target_checklist
    and (c.driver_id=auth.uid() or public.is_contract_driver(c.id));
  if target_contract is null then raise exception 'This checklist is not assigned to you'; end if;

  if target_event_type<>'signing' and not exists(
    select 1 from public.contracts c
    where c.id=target_contract
      and c.status not in ('submitted','under_review','approved')
      and not exists(
        select 1 from public.checklist_responses existing_response
        where existing_response.contract_checklist_id=target_checklist
          and existing_response.item_id=target_item
          and existing_response.review_status='approved'
      )
  ) then raise exception 'This checklist is not currently editable'; end if;

  insert into public.checklist_responses(contract_checklist_id,item_id,completed,completed_at)
  values(target_checklist,target_item,new_completed,case when new_completed then now() else null end)
  on conflict(contract_checklist_id,item_id) do update set
    completed=excluded.completed,completed_at=excluded.completed_at,
    review_status=null,review_note=null,reviewed_by=null,reviewed_at=null;

  if target_event_type='signing' then
    perform set_config('roadshow.checklist_submission','true',true);
    update public.contracts set
      status=case when exists(
        select 1 from public.contract_checklists cc
        join public.checklist_sections section on section.template_id=cc.template_id
        join public.checklist_items item on item.section_id=section.id and item.required
        left join public.checklist_responses response
          on response.contract_checklist_id=cc.id and response.item_id=item.id
        where cc.id=target_checklist and coalesce(response.completed,false)=false
      ) then 'in_progress'::public.contract_status else 'approved'::public.contract_status end,
      updated_at=now()
    where id=target_contract;
  end if;
end $$;
grant execute on function public.set_my_checklist_item(uuid,uuid,boolean) to authenticated;
