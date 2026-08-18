-- Roadshow Driver: Phase 1 foundation
create extension if not exists pgcrypto;
create type public.app_role as enum ('driver','admin');
create type public.contract_kind as enum ('setup','teardown');
create type public.contract_status as enum ('upcoming','available','signed','in_progress','submitted','under_review','approved','bonus_earned','bonus_not_earned');
create type public.availability_status as enum ('available','unavailable','pending','assigned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', avatar_url text,
  role public.app_role not null default 'driver', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.shows (
  id uuid primary key default gen_random_uuid(), name text not null, starts_on date not null, ends_on date not null,
  city text not null, state text, address text, bin_count integer check (bin_count >= 0),
  meals_included boolean not null default false, lodging_included boolean not null default false,
  details_unlock_at timestamptz, created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  constraint valid_show_dates check (ends_on >= starts_on)
);
create table public.contracts (
  id uuid primary key default gen_random_uuid(), show_id uuid not null references public.shows(id) on delete cascade,
  driver_id uuid references public.profiles(id), kind public.contract_kind not null, status public.contract_status not null default 'upcoming',
  contract_pay numeric(10,2) check (contract_pay >= 0), bonus_pay numeric(10,2) check (bonus_pay >= 0), document_path text,
  signed_at timestamptz, signature_name text, submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
  admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(show_id,kind,driver_id)
);
create table public.checklist_templates (id uuid primary key default gen_random_uuid(), name text not null, kind public.contract_kind not null, version integer not null default 1, active boolean not null default true, created_at timestamptz not null default now());
create table public.checklist_sections (id uuid primary key default gen_random_uuid(), template_id uuid not null references public.checklist_templates(id) on delete cascade, title text not null, position integer not null default 0);
create table public.checklist_items (id uuid primary key default gen_random_uuid(), section_id uuid not null references public.checklist_sections(id) on delete cascade, title text not null, instructions text, required boolean not null default true, photo_required boolean not null default false, position integer not null default 0);
create table public.contract_checklists (id uuid primary key default gen_random_uuid(), contract_id uuid not null unique references public.contracts(id) on delete cascade, template_id uuid references public.checklist_templates(id), created_at timestamptz not null default now());
create table public.checklist_responses (id uuid primary key default gen_random_uuid(), contract_checklist_id uuid not null references public.contract_checklists(id) on delete cascade, item_id uuid not null references public.checklist_items(id), completed boolean not null default false, note text, completed_at timestamptz, review_status text check(review_status in ('pending','approved','denied')), review_note text, unique(contract_checklist_id,item_id));
create table public.photos (id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.contracts(id) on delete cascade, response_id uuid references public.checklist_responses(id) on delete cascade, slot_name text, storage_path text not null, uploaded_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create table public.availability (id uuid primary key default gen_random_uuid(), show_id uuid not null references public.shows(id) on delete cascade, driver_id uuid not null references public.profiles(id) on delete cascade, status public.availability_status not null, updated_at timestamptz not null default now(), unique(show_id,driver_id));
create table public.resources (id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('handbook','faq','link')), title text not null, content text, file_path text, position integer not null default 0, published boolean not null default false, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade, title text not null, body text not null, link text, read_at timestamptz, created_at timestamptz not null default now());

create index contracts_driver_idx on public.contracts(driver_id); create index contracts_show_idx on public.contracts(show_id); create index availability_driver_idx on public.availability(driver_id); create index notifications_recipient_idx on public.notifications(recipient_id,created_at desc);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security; alter table public.shows enable row level security; alter table public.contracts enable row level security; alter table public.checklist_templates enable row level security; alter table public.checklist_sections enable row level security; alter table public.checklist_items enable row level security; alter table public.contract_checklists enable row level security; alter table public.checklist_responses enable row level security; alter table public.photos enable row level security; alter table public.availability enable row level security; alter table public.resources enable row level security; alter table public.notifications enable row level security;
create policy "profiles own read" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "profiles own update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "shows authenticated read" on public.shows for select to authenticated using(true);
create policy "shows admin manage" on public.shows for all using(public.is_admin()) with check(public.is_admin());
create policy "contracts assigned read" on public.contracts for select using(driver_id=auth.uid() or public.is_admin());
create policy "contracts admin manage" on public.contracts for all using(public.is_admin()) with check(public.is_admin());
create policy "templates authenticated read" on public.checklist_templates for select to authenticated using(true);
create policy "sections authenticated read" on public.checklist_sections for select to authenticated using(true);
create policy "items authenticated read" on public.checklist_items for select to authenticated using(true);
create policy "templates admin manage" on public.checklist_templates for all using(public.is_admin()) with check(public.is_admin());
create policy "sections admin manage" on public.checklist_sections for all using(public.is_admin()) with check(public.is_admin());
create policy "items admin manage" on public.checklist_items for all using(public.is_admin()) with check(public.is_admin());
create policy "contract checklists assigned read" on public.contract_checklists for select using(public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and c.driver_id=auth.uid()));
create policy "contract checklists admin manage" on public.contract_checklists for all using(public.is_admin()) with check(public.is_admin());
create policy "responses assigned manage" on public.checklist_responses for all using(public.is_admin() or exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.id=contract_checklist_id and c.driver_id=auth.uid())) with check(public.is_admin() or exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.id=contract_checklist_id and c.driver_id=auth.uid()));
create policy "photos assigned read" on public.photos for select using(public.is_admin() or exists(select 1 from public.contracts c where c.id=contract_id and c.driver_id=auth.uid()));
create policy "photos assigned insert" on public.photos for insert with check(uploaded_by=auth.uid() and exists(select 1 from public.contracts c where c.id=contract_id and c.driver_id=auth.uid()));
create policy "availability own manage" on public.availability for all using(driver_id=auth.uid() or public.is_admin()) with check(driver_id=auth.uid() or public.is_admin());
create policy "resources published read" on public.resources for select to authenticated using(published or public.is_admin());
create policy "resources admin manage" on public.resources for all using(public.is_admin()) with check(public.is_admin());
create policy "notifications own read" on public.notifications for select using(recipient_id=auth.uid() or public.is_admin());
create policy "notifications own update" on public.notifications for update using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create policy "notifications admin insert" on public.notifications for insert with check(public.is_admin());

insert into storage.buckets(id,name,public) values('contract-files','contract-files',false),('roadshow-photos','roadshow-photos',false),('resources','resources',false) on conflict(id) do nothing;
