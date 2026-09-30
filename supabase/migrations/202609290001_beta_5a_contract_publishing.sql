-- Roadshow Driver Beta 5A: batch contract publishing and mixed assignments

create table public.availability_release_batches (
  id uuid primary key default gen_random_uuid(),
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.availability_release_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.availability_release_batches(id) on delete cascade,
  status text not null default 'open' check(status in ('open','assigned','withdrawn')),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.availability_release_item_shows (
  release_item_id uuid not null references public.availability_release_items(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  primary key(release_item_id,show_id)
);

create table public.availability_release_responses (
  id uuid primary key default gen_random_uuid(),
  release_item_id uuid not null references public.availability_release_items(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check(status in ('available','unavailable')),
  responded_at timestamptz not null default now(),
  available_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(release_item_id,profile_id),
  check((status='available' and available_at is not null) or (status='unavailable' and available_at is null))
);

create table public.contract_external_assignees (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  display_name text not null check(char_length(display_name) between 1 and 120),
  position integer not null default 0 check(position>=0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index contract_external_assignees_name_unique
  on public.contract_external_assignees(contract_id,lower(display_name));
create index availability_release_items_batch_idx
  on public.availability_release_items(batch_id,status);
create index availability_release_item_shows_show_idx
  on public.availability_release_item_shows(show_id,release_item_id);
create index availability_release_responses_item_idx
  on public.availability_release_responses(release_item_id,status,available_at,id);
create index contract_external_assignees_contract_idx
  on public.contract_external_assignees(contract_id,position,id);

alter table public.notification_preferences
  add column if not exists availability_release_alerts boolean not null default true;

alter table public.notifications
  add column if not exists release_batch_id uuid
    references public.availability_release_batches(id) on delete cascade;
create unique index availability_release_notification_unique
  on public.notifications(recipient_id,release_batch_id,kind)
  where release_batch_id is not null and kind='availability_release';

alter table public.availability_release_batches enable row level security;
alter table public.availability_release_items enable row level security;
alter table public.availability_release_item_shows enable row level security;
alter table public.availability_release_responses enable row level security;
alter table public.contract_external_assignees enable row level security;

create policy "release batches admin read"
  on public.availability_release_batches for select to authenticated
  using(public.is_admin());
create policy "release items admin read"
  on public.availability_release_items for select to authenticated
  using(public.is_admin());
create policy "release item shows admin read"
  on public.availability_release_item_shows for select to authenticated
  using(public.is_admin());
create policy "release responses admin read"
  on public.availability_release_responses for select to authenticated
  using(public.is_admin());
create policy "external assignees admin read"
  on public.contract_external_assignees for select to authenticated
  using(public.is_admin());

create or replace function public.admin_get_publishable_opportunities()
returns table(
  opportunity_id uuid,
  show_ids uuid[],
  title text,
  event_type text,
  location text,
  work_at timestamptz,
  contract_kind public.contract_kind,
  contract_pay numeric,
  bonus_pay numeric
)
language sql stable security definer set search_path=public as $$
  with recursive signing_walk(root_id,node_id) as (
    select s.id,s.id from public.shows s where s.event_type='signing'
    union
    select signing_walk.root_id,
      case when links.show_id=signing_walk.node_id then links.linked_show_id else links.show_id end
    from signing_walk
    join public.show_links links
      on links.show_id=signing_walk.node_id or links.linked_show_id=signing_walk.node_id
  ), signing_components as (
    select root_id,min(node_id) component_id
    from signing_walk group by root_id
  ), grouped as (
    select s.id component_id,array[s.id]::uuid[] show_ids
    from public.shows s where s.event_type='show'
    union all
    select component_id,array_agg(root_id order by root_id)
    from signing_components group by component_id
  ), current_contracts as (
    select distinct on (c.show_id)
      c.id,c.show_id,c.kind,c.service_date,c.service_time,c.contract_pay,c.bonus_pay
    from public.contracts c
    order by c.show_id,c.created_at desc
  ), candidates as (
    select grouped.component_id,grouped.show_ids,
      min(coalesce(s.artist,s.name)) filter(where s.event_type='show') normal_title,
      string_agg(coalesce(s.artist,s.name),' & ' order by coalesce(s.signing_at,s.starts_on::timestamptz))
        filter(where s.event_type='signing') signing_title,
      min(s.event_type) event_type,
      min(coalesce(s.venue_name,s.address,s.city)) location,
      min(case when s.event_type='signing' then coalesce(s.setup_at,s.signing_at)
        else (cc.service_date::text||' '||coalesce(cc.service_time::text,'12:00:00'))::timestamptz end) work_at,
      min(cc.kind::text)::public.contract_kind contract_kind,
      max(cc.contract_pay) contract_pay,max(cc.bonus_pay) bonus_pay,
      bool_and(s.ends_on>=current_date) future_work,
      bool_and(cc.id is not null) has_contract,
      bool_or(
        cc.id is not null and (
          exists(select 1 from public.contract_drivers cd where cd.contract_id=cc.id)
          or exists(select 1 from public.contract_external_assignees ce where ce.contract_id=cc.id)
          or exists(select 1 from public.contracts direct_contract where direct_contract.id=cc.id and direct_contract.driver_id is not null)
        )
      ) assigned,
      bool_or(exists(
        select 1 from public.availability_release_item_shows ris
        join public.availability_release_items ri on ri.id=ris.release_item_id and ri.status='open'
        where ris.show_id=s.id
      )) already_open
    from grouped
    join public.shows s on s.id=any(grouped.show_ids)
    left join current_contracts cc on cc.show_id=s.id
    group by grouped.component_id,grouped.show_ids
  )
  select component_id,show_ids,coalesce(signing_title,normal_title),event_type,
    location,work_at,contract_kind,contract_pay,bonus_pay
  from candidates
  where future_work and has_contract and not assigned and not already_open
    and public.is_admin()
  order by work_at,coalesce(signing_title,normal_title)
$$;

create or replace function public.admin_publish_availability_batch(target_show_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare
  result_batch uuid;
  result_item uuid;
  selected_ids uuid[];
  target_id uuid;
  group_row record;
  item_count integer:=0;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select array_agg(distinct value order by value) into selected_ids
  from unnest(coalesce(target_show_ids,array[]::uuid[])) value;
  if coalesce(cardinality(selected_ids),0)=0 then raise exception 'Choose at least one contract'; end if;

  foreach target_id in array selected_ids loop
    perform pg_advisory_xact_lock(hashtextextended(target_id::text,0));
  end loop;

  if exists(
    select 1 from unnest(selected_ids) requested(id)
    left join public.shows s on s.id=requested.id
    left join lateral (
      select c.* from public.contracts c where c.show_id=s.id
      order by c.created_at desc limit 1
    ) c on true
    where s.id is null or s.ends_on<current_date or c.id is null
      or c.driver_id is not null
      or exists(select 1 from public.contract_drivers cd where cd.contract_id=c.id)
      or exists(select 1 from public.contract_external_assignees ce where ce.contract_id=c.id)
      or exists(
        select 1 from public.availability_release_item_shows ris
        join public.availability_release_items ri on ri.id=ris.release_item_id and ri.status='open'
        where ris.show_id=requested.id
      )
  ) then raise exception 'One or more selected contracts are unavailable for publishing'; end if;

  if exists(
    with recursive walk(root_id,node_id) as (
      select s.id,s.id from public.shows s
      where s.id=any(selected_ids) and s.event_type='signing'
      union
      select walk.root_id,
        case when links.show_id=walk.node_id then links.linked_show_id else links.show_id end
      from walk join public.show_links links
        on links.show_id=walk.node_id or links.linked_show_id=walk.node_id
    )
    select 1 from walk where not node_id=any(selected_ids)
  ) then raise exception 'Linked signings must be published together'; end if;

  insert into public.availability_release_batches(released_by)
  values(auth.uid()) returning id into result_batch;

  for group_row in
    with recursive signing_walk(root_id,node_id) as (
      select s.id,s.id from public.shows s
      where s.id=any(selected_ids) and s.event_type='signing'
      union
      select signing_walk.root_id,
        case when links.show_id=signing_walk.node_id then links.linked_show_id else links.show_id end
      from signing_walk join public.show_links links
        on links.show_id=signing_walk.node_id or links.linked_show_id=signing_walk.node_id
      where (case when links.show_id=signing_walk.node_id then links.linked_show_id else links.show_id end)=any(selected_ids)
    ), signing_components as (
      select root_id,min(node_id) component_id from signing_walk group by root_id
    ), groups as (
      select s.id component_id,array[s.id]::uuid[] show_ids
      from public.shows s where s.id=any(selected_ids) and s.event_type='show'
      union all
      select component_id,array_agg(root_id order by root_id)
      from signing_components group by component_id
    ) select * from groups order by component_id
  loop
    insert into public.availability_release_items(batch_id)
    values(result_batch) returning id into result_item;
    insert into public.availability_release_item_shows(release_item_id,show_id)
    select result_item,unnest(group_row.show_ids);
    item_count:=item_count+1;
  end loop;

  insert into public.notifications(recipient_id,title,body,link,kind,release_batch_id)
  select p.id,'New contract batch',
    item_count::text||case when item_count=1 then ' new opportunity is available.' else ' new opportunities are available.' end,
    '/availability?batch='||result_batch,'availability_release',result_batch
  from public.profiles p where p.is_active
  on conflict do nothing;

  return result_batch;
end $$;

create or replace function public.get_my_published_availability()
returns table(
  batch_id uuid,
  batch_released_at timestamptz,
  release_item_id uuid,
  item_status text,
  shows jsonb,
  response_status text,
  responded_at timestamptz,
  available_at timestamptz,
  assignees jsonb
)
language sql stable security definer set search_path=public as $$
  with item_rows as (
    select b.id batch_id,b.released_at,i.id item_id,i.status,
      jsonb_agg(jsonb_build_object(
        'id',s.id,'name',s.name,'starts_on',s.starts_on,'ends_on',s.ends_on,
        'city',s.city,'state',s.state,'address',s.address,'event_type',s.event_type,
        'artist',s.artist,'venue_name',s.venue_name,'signing_at',s.signing_at,
        'setup_at',s.setup_at,'is_test',s.is_test,'contract_id',c.id,
        'contract_kind',c.kind,'service_date',c.service_date,'service_time',c.service_time,
        'contract_pay',c.contract_pay,'bonus_pay',c.bonus_pay
      ) order by coalesce(s.setup_at,s.signing_at,c.service_date::timestamptz,s.starts_on::timestamptz)) shows
    from public.availability_release_batches b
    join public.availability_release_items i on i.batch_id=b.id
    join public.availability_release_item_shows ris on ris.release_item_id=i.id
    join public.shows s on s.id=ris.show_id
    left join lateral (
      select current_contract.* from public.contracts current_contract
      where current_contract.show_id=s.id order by current_contract.created_at desc limit 1
    ) c on true
    where i.status in ('open','assigned') and s.ends_on>=current_date
    group by b.id,b.released_at,i.id,i.status
  ), assignment_rows as (
    select items.item_id,
      coalesce(jsonb_agg(distinct people.person) filter(where people.person is not null),'[]'::jsonb) assignees
    from item_rows items
    left join lateral (
      select jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'external',false) person
      from public.availability_release_item_shows ris
      join public.contracts c on c.show_id=ris.show_id
      join lateral (
        select c.driver_id driver_id where c.driver_id is not null
        union select cd.driver_id from public.contract_drivers cd where cd.contract_id=c.id
      ) drivers on true
      join public.profiles p on p.id=drivers.driver_id and p.is_active
      where ris.release_item_id=items.item_id
      union all
      select jsonb_build_object('id',ce.id,'full_name',ce.display_name,'role','external','external',true)
      from public.availability_release_item_shows ris
      join public.contracts c on c.show_id=ris.show_id
      join public.contract_external_assignees ce on ce.contract_id=c.id
      where ris.release_item_id=items.item_id
    ) people on true
    group by items.item_id
  )
  select item_rows.batch_id,item_rows.released_at,item_rows.item_id,item_rows.status,
    item_rows.shows,response.status,response.responded_at,response.available_at,
    coalesce(assignment_rows.assignees,'[]'::jsonb)
  from item_rows
  left join public.availability_release_responses response
    on response.release_item_id=item_rows.item_id and response.profile_id=auth.uid()
  left join assignment_rows on assignment_rows.item_id=item_rows.item_id
  where exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
  order by item_rows.released_at desc,item_rows.item_id
$$;

create or replace function public.set_my_release_response(
  target_release_item uuid,target_status text
) returns timestamptz language plpgsql security definer set search_path=public as $$
declare
  current_status text;
  result_time timestamptz;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
    raise exception 'An active account is required';
  end if;
  if target_status not in ('available','unavailable') then raise exception 'Choose Available or Unavailable'; end if;
  perform 1 from public.availability_release_items
    where id=target_release_item and status='open' for update;
  if not found then raise exception 'This opportunity is no longer open'; end if;

  select status into current_status from public.availability_release_responses
    where release_item_id=target_release_item and profile_id=auth.uid();
  result_time:=clock_timestamp();
  insert into public.availability_release_responses(
    release_item_id,profile_id,status,responded_at,available_at,updated_at
  ) values(
    target_release_item,auth.uid(),target_status,result_time,
    case when target_status='available' then result_time else null end,result_time
  ) on conflict(release_item_id,profile_id) do update set
    status=excluded.status,
    responded_at=excluded.responded_at,
    available_at = case
      when excluded.status='unavailable' then null
      when public.availability_release_responses.status='available'
        then public.availability_release_responses.available_at
      else clock_timestamp()
    end,
    updated_at=clock_timestamp()
  returning coalesce(available_at,responded_at) into result_time;
  return result_time;
end $$;

create or replace function public.admin_get_release_responses(target_release_item uuid)
returns table(
  profile_id uuid,
  full_name text,
  role public.app_role,
  phone text,
  response_status text,
  responded_at timestamptz,
  available_at timestamptz,
  response_rank bigint,
  assigned boolean
)
language sql stable security definer set search_path=public as $$
  with response_rows as (
    select p.id,p.full_name,p.role,p.phone,r.status,r.responded_at,r.available_at,
      case when r.status='available' then row_number() over(
        partition by r.status order by r.available_at,r.id
      ) end response_rank
    from public.profiles p
    left join public.availability_release_responses r
      on r.profile_id=p.id and r.release_item_id=target_release_item
    where p.is_active
  ), assigned_profiles as (
    select distinct drivers.driver_id
    from public.availability_release_item_shows ris
    join public.contracts c on c.show_id=ris.show_id
    join lateral (
      select c.driver_id driver_id where c.driver_id is not null
      union select cd.driver_id from public.contract_drivers cd where cd.contract_id=c.id
    ) drivers on true
    where ris.release_item_id=target_release_item
  )
  select response_rows.id,response_rows.full_name,response_rows.role,response_rows.phone,
    response_rows.status,response_rows.responded_at,response_rows.available_at,
    response_rows.response_rank,assigned_profiles.driver_id is not null
  from response_rows left join assigned_profiles on assigned_profiles.driver_id=response_rows.id
  where public.is_admin()
  order by
    case response_rows.status when 'available' then 0 when 'unavailable' then 1 else 2 end,
    response_rows.available_at nulls last,response_rows.full_name,response_rows.id
$$;

create or replace function public.admin_replace_opportunity_assignments(
  target_release_item uuid,
  target_show_ids uuid[],
  target_driver_ids uuid[],
  target_external_names text[]
) returns void language plpgsql security definer set search_path=public as $$
declare
  clean_show_ids uuid[];
  clean_driver_ids uuid[];
  clean_external_names text[];
  target_contract uuid;
  target_show uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select array_agg(distinct value order by value) into clean_show_ids
    from unnest(coalesce(target_show_ids,array[]::uuid[])) value;
  select array_agg(distinct value order by value) into clean_driver_ids
    from unnest(coalesce(target_driver_ids,array[]::uuid[])) value;
  select array_agg(name order by first_position) into clean_external_names
  from (
    select distinct on (lower(trim(value))) ordinality first_position,trim(value) name
    from unnest(coalesce(target_external_names,array[]::text[])) with ordinality input(value,ordinality)
    where length(trim(value))>0
    order by lower(trim(value)),ordinality
  ) names;

  if coalesce(cardinality(clean_show_ids),0)=0 then raise exception 'Choose at least one contract'; end if;
  if exists(select 1 from unnest(coalesce(clean_external_names,array[]::text[])) value where char_length(value)>120) then
    raise exception 'External driver names must be 120 characters or fewer';
  end if;
  if coalesce(cardinality(clean_driver_ids),0)>0 and exists(
    select 1 from unnest(clean_driver_ids) requested(id)
    left join public.profiles p on p.id=requested.id and p.is_active
    where p.id is null
  ) then raise exception 'Every app user must have an active account'; end if;

  if target_release_item is not null then
    perform 1 from public.availability_release_items
      where id=target_release_item and status='open' for update;
    if not found then raise exception 'This opportunity has already been assigned or withdrawn'; end if;
    if coalesce(cardinality(clean_driver_ids),0)+coalesce(cardinality(clean_external_names),0)=0 then
      raise exception 'Choose at least one driver';
    end if;
    if exists(
      (select show_id from public.availability_release_item_shows where release_item_id=target_release_item
       except select unnest(clean_show_ids))
      union all
      (select unnest(clean_show_ids)
       except select show_id from public.availability_release_item_shows where release_item_id=target_release_item)
    ) then raise exception 'The assignment no longer matches this opportunity'; end if;
  end if;

  foreach target_show in array clean_show_ids loop
    select id into target_contract from public.contracts
      where show_id=target_show order by created_at desc limit 1 for update;
    if target_contract is null then raise exception 'A selected show does not have a contract'; end if;

    update public.contracts set driver_id=clean_driver_ids[1],updated_at=now()
      where id=target_contract;
    delete from public.contract_drivers where contract_id=target_contract;
    insert into public.contract_drivers(contract_id,driver_id,is_trainee)
      select target_contract,value,ordinality>1
      from unnest(coalesce(clean_driver_ids,array[]::uuid[])) with ordinality values_list(value,ordinality);

    delete from public.contract_external_assignees where contract_id=target_contract;
    insert into public.contract_external_assignees(contract_id,display_name,position,created_by)
      select target_contract,value,ordinality-1,auth.uid()
      from unnest(coalesce(clean_external_names,array[]::text[])) with ordinality values_list(value,ordinality);
  end loop;

  if target_release_item is not null then
    update public.availability_release_items set
      status='assigned',closed_at=clock_timestamp(),closed_by=auth.uid(),updated_at=clock_timestamp()
    where id=target_release_item;
  end if;
end $$;

create or replace function public.admin_withdraw_release_item(target_release_item uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.availability_release_items set
    status='withdrawn',closed_at=clock_timestamp(),closed_by=auth.uid(),updated_at=clock_timestamp()
  where id=target_release_item and status='open';
  if not found then raise exception 'Only open opportunities can be withdrawn'; end if;
end $$;

grant execute on function public.admin_get_publishable_opportunities() to authenticated;
grant execute on function public.admin_publish_availability_batch(uuid[]) to authenticated;
grant execute on function public.get_my_published_availability() to authenticated;
grant execute on function public.set_my_release_response(uuid,text) to authenticated;
grant execute on function public.admin_get_release_responses(uuid) to authenticated;
grant execute on function public.admin_replace_opportunity_assignments(uuid,uuid[],uuid[],text[]) to authenticated;
grant execute on function public.admin_withdraw_release_item(uuid) to authenticated;

drop policy if exists "shows authenticated read" on public.shows;
create policy "shows published or assigned read" on public.shows
for select to authenticated using(
  public.is_admin()
  or exists(
    select 1 from public.availability_release_item_shows ris
    join public.availability_release_items ri on ri.id=ris.release_item_id
    where ris.show_id=shows.id and ri.status in ('open','assigned')
  )
  or exists(
    select 1 from public.contracts c
    where c.show_id=shows.id and (
      c.driver_id=auth.uid() or public.is_contract_driver(c.id)
    )
  )
);

do $$
declare
  migration_batch uuid;
  migration_item uuid;
  show_row record;
  grouped_ids uuid[];
  processed_ids uuid[]:=array[]::uuid[];
begin
  if not exists(
    select 1 from public.shows s join public.contracts c on c.show_id=s.id
    where s.ends_on>=current_date and (
      c.driver_id is not null
      or exists(select 1 from public.contract_drivers cd where cd.contract_id=c.id)
    )
  ) then return; end if;

  insert into public.availability_release_batches(released_by)
  values(null) returning id into migration_batch;

  for show_row in
    select distinct s.id,s.event_type
    from public.shows s join public.contracts c on c.show_id=s.id
    where s.ends_on>=current_date and (
      c.driver_id is not null
      or exists(select 1 from public.contract_drivers cd where cd.contract_id=c.id)
    ) order by s.id
  loop
    if show_row.id=any(processed_ids) then continue; end if;
    if show_row.event_type='signing' then
      with recursive connected(id) as (
        select show_row.id
        union
        select case when links.show_id=connected.id then links.linked_show_id else links.show_id end
        from connected join public.show_links links
          on links.show_id=connected.id or links.linked_show_id=connected.id
      ) select array_agg(id order by id) into grouped_ids from connected;
    else grouped_ids:=array[show_row.id]; end if;

    insert into public.availability_release_items(batch_id,status,closed_at)
    values(migration_batch,'assigned',now()) returning id into migration_item;
    insert into public.availability_release_item_shows(release_item_id,show_id)
      select migration_item,unnest(grouped_ids);
    processed_ids:=processed_ids||grouped_ids;
  end loop;
end $$;
