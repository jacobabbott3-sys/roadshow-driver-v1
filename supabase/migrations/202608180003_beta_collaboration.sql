-- Roadshow Driver beta: collaboration, messaging, templates, and dual signatures
alter table public.contracts add column if not exists admin_signed_at timestamptz;
alter table public.contracts add column if not exists admin_signature_name text;
alter table public.toolbag_items add column if not exists quantity integer not null default 1 check(quantity>0);

alter table public.feedback drop constraint if exists feedback_category_check;
alter table public.feedback add constraint feedback_category_check check(category in ('app','general'));

create table public.contract_drivers (
  contract_id uuid not null references public.contracts(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  is_trainee boolean not null default false,
  primary key(contract_id,driver_id)
);
insert into public.contract_drivers(contract_id,driver_id) select id,driver_id from public.contracts where driver_id is not null on conflict do nothing;
alter table public.contract_drivers enable row level security;
create policy "contract drivers own read" on public.contract_drivers for select using(driver_id=auth.uid() or public.is_admin());
create policy "contract drivers admin manage" on public.contract_drivers for all using(public.is_admin()) with check(public.is_admin());
create or replace function public.is_contract_driver(target_contract uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.contract_drivers where contract_id=target_contract and driver_id=auth.uid()) $$;
create or replace function public.set_my_checklist_item(target_checklist uuid,target_item uuid,new_completed boolean) returns void language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id join public.checklist_items i on i.id=target_item join public.checklist_sections s on s.id=i.section_id and s.template_id=cc.template_id where cc.id=target_checklist and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))) then raise exception 'This checklist is not assigned to your contract'; end if;insert into public.checklist_responses(contract_checklist_id,item_id,completed,completed_at) values(target_checklist,target_item,new_completed,case when new_completed then now() else null end) on conflict(contract_checklist_id,item_id) do update set completed=excluded.completed,completed_at=excluded.completed_at;end $$;
drop policy if exists "contracts assigned read" on public.contracts;
create policy "contracts assigned read" on public.contracts for select using(driver_id=auth.uid() or public.is_contract_driver(id) or public.is_admin());
drop policy if exists "contract checklists assigned read" on public.contract_checklists;
create policy "contract checklists assigned read" on public.contract_checklists for select using(public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))));
drop policy if exists "responses assigned manage" on public.checklist_responses;
create policy "responses assigned manage" on public.checklist_responses for all using(public.is_admin() or exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.id=contract_checklist_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id)))) with check(public.is_admin() or exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.id=contract_checklist_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))));
drop policy if exists "photos assigned read" on public.photos;
create policy "photos assigned read" on public.photos for select using(public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))));

create table public.messages (
  id uuid primary key default gen_random_uuid(),sender_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "message participants read" on public.messages for select using(sender_id=auth.uid() or recipient_id=auth.uid() or public.is_admin());
create policy "admins send messages" on public.messages for insert with check(public.is_admin() and sender_id=auth.uid());
create policy "recipient marks read" on public.messages for update using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());

alter table public.notifications add column if not exists kind text not null default 'general';
alter table public.notifications add column if not exists contract_id uuid references public.contracts(id) on delete cascade;
create unique index if not exists unique_contract_notification on public.notifications(recipient_id,contract_id,kind) where contract_id is not null;
create or replace function public.notify_contract_assignment() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.driver_id is not null then if tg_op='INSERT' then insert into public.notifications(recipient_id,title,body,link,kind,contract_id) values(new.driver_id,'New contract assigned','A contract has been assigned to you.','/contracts/'||new.id,'assignment',new.id) on conflict do nothing; elsif new.driver_id is distinct from old.driver_id then insert into public.notifications(recipient_id,title,body,link,kind,contract_id) values(new.driver_id,'New contract assigned','A contract has been assigned to you.','/contracts/'||new.id,'assignment',new.id) on conflict do nothing; end if;end if;return new;end $$;
drop trigger if exists notify_contract_assignment on public.contracts;
create trigger notify_contract_assignment after insert or update of driver_id on public.contracts for each row execute function public.notify_contract_assignment();
create or replace function public.notify_contract_driver_assignment() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.notifications(recipient_id,title,body,link,kind,contract_id) values(new.driver_id,'New contract assigned',case when new.is_trainee then 'You have been added to a contract for training.' else 'A contract has been assigned to you.' end,'/contracts/'||new.contract_id,'assignment',new.contract_id) on conflict do nothing;return new;end $$;
create trigger notify_contract_driver_assignment after insert on public.contract_drivers for each row execute function public.notify_contract_driver_assignment();
create or replace function public.ensure_my_due_notifications() returns void language plpgsql security definer set search_path=public as $$ begin insert into public.notifications(recipient_id,title,body,link,kind,contract_id) select auth.uid(),'Work scheduled today',case when c.kind='setup' then 'Your setup is scheduled for today.' else 'Your teardown is scheduled for today.' end,'/contracts/'||c.id,'work_day',c.id from public.contracts c where c.service_date=current_date and (c.driver_id=auth.uid() or public.is_contract_driver(c.id)) on conflict do nothing; end $$;
grant execute on function public.ensure_my_due_notifications() to authenticated;

drop policy if exists "photos assigned insert" on public.photos;
create policy "photos assigned insert" on public.photos for insert with check(uploaded_by=auth.uid() and exists(select 1 from public.contracts c where c.id=contract_id and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))));

create table public.toolbag_templates(id uuid primary key default gen_random_uuid(),name text not null unique,created_at timestamptz not null default now());
create table public.toolbag_template_items(id uuid primary key default gen_random_uuid(),template_id uuid not null references public.toolbag_templates(id) on delete cascade,name text not null,quantity integer not null default 1 check(quantity>0),position integer not null default 0);
alter table public.toolbag_templates enable row level security;alter table public.toolbag_template_items enable row level security;
create policy "toolbag templates authenticated read" on public.toolbag_templates for select to authenticated using(true);
create policy "toolbag template items authenticated read" on public.toolbag_template_items for select to authenticated using(true);
create policy "toolbag templates admin manage" on public.toolbag_templates for all using(public.is_admin()) with check(public.is_admin());
create policy "toolbag template items admin manage" on public.toolbag_template_items for all using(public.is_admin()) with check(public.is_admin());
create or replace function public.apply_toolbag_template(target_toolbag uuid,target_template uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'Admin access required';end if;delete from public.toolbag_items where toolbag_id=target_toolbag;insert into public.toolbag_items(toolbag_id,name,quantity,position) select target_toolbag,name,quantity,position from public.toolbag_template_items where template_id=target_template;end $$;
grant execute on function public.apply_toolbag_template(uuid,uuid) to authenticated;

create policy "admins upload resource files" on storage.objects for insert to authenticated with check(bucket_id='resources' and public.is_admin());
create policy "admins update resource files" on storage.objects for update to authenticated using(bucket_id='resources' and public.is_admin());
create policy "admins delete resource files" on storage.objects for delete to authenticated using(bucket_id='resources' and public.is_admin());
