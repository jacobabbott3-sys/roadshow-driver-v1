-- Roadshow Driver Beta 5A: consistent contract language and reversible assignments

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
      select root_id,min(node_id::text)::uuid component_id from signing_walk group by root_id
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
    item_count::text||case when item_count=1 then ' new contract is available.' else ' new contracts are available.' end,
    '/availability?batch='||result_batch,'availability_release',result_batch
  from public.profiles p where p.is_active
  on conflict do nothing;

  return result_batch;
end $$;

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
  if not found then raise exception 'This contract is no longer open'; end if;

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
  has_assignees boolean;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select array_agg(distinct value order by value) into clean_show_ids
    from unnest(coalesce(target_show_ids,array[]::uuid[])) value;
  select array_agg(value order by first_position) into clean_driver_ids
  from (
    select distinct on (value) value,ordinality first_position
    from unnest(coalesce(target_driver_ids,array[]::uuid[])) with ordinality input(value,ordinality)
    order by value,ordinality
  ) ordered_drivers;
  select array_agg(name order by first_position) into clean_external_names
  from (
    select distinct on (lower(trim(value))) ordinality first_position,trim(value) name
    from unnest(coalesce(target_external_names,array[]::text[])) with ordinality input(value,ordinality)
    where length(trim(value))>0
    order by lower(trim(value)),ordinality
  ) names;
  has_assignees:=coalesce(cardinality(clean_driver_ids),0)+coalesce(cardinality(clean_external_names),0)>0;

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
      where id=target_release_item and status in ('open','assigned') for update;
    if not found then raise exception 'This contract has been withdrawn or removed'; end if;
    if exists(
      (select show_id from public.availability_release_item_shows where release_item_id=target_release_item
       except select unnest(clean_show_ids))
      union all
      (select unnest(clean_show_ids)
       except select show_id from public.availability_release_item_shows where release_item_id=target_release_item)
    ) then raise exception 'The assignment no longer matches this contract'; end if;
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
      status=case when has_assignees then 'assigned' else 'open' end,
      closed_at=case when has_assignees then clock_timestamp() else null end,
      closed_by=case when has_assignees then auth.uid() else null end,
      updated_at=clock_timestamp()
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
  if not found then raise exception 'Only open contracts can be withdrawn'; end if;
end $$;

update public.notifications
set body=replace(replace(body,'opportunities','contracts'),'opportunity','contract')
where kind='availability_release' and body ilike '%opportunit%';

grant execute on function public.admin_publish_availability_batch(uuid[]) to authenticated;
grant execute on function public.set_my_release_response(uuid,text) to authenticated;
grant execute on function public.admin_replace_opportunity_assignments(uuid,uuid[],uuid[],text[]) to authenticated;
grant execute on function public.admin_withdraw_release_item(uuid) to authenticated;
