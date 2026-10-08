-- Forward-only review artifact: canonical preview/commit uses the same mutation code.
begin;
alter table public.checklist_sections add column archived boolean not null default false;
alter table public.checklist_items add column archived boolean not null default false;
create table roadshow_private.agreement_previews(
 token uuid primary key default gen_random_uuid(),actor_id uuid not null,
 operation text not null,input jsonb not null,mutation jsonb not null,
 before_state jsonb not null,after_state jsonb not null,consequences jsonb not null,
 expires_at timestamptz not null default clock_timestamp()+interval '15 minutes',
 committed_result uuid
);
revoke all on roadshow_private.agreement_previews from public,anon,authenticated;

create function roadshow_private.admin_save_show_contract(target_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  result_show uuid:=nullif(target_payload->>'show_id','')::uuid;
  result_contract uuid:=nullif(target_payload->>'contract_id','')::uuid;
  selected_template uuid:=nullif(target_payload->>'template_id','')::uuid;
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

  select coalesce(array_agg(value::uuid order by ordinality),array[]::uuid[]) into driver_ids from jsonb_array_elements_text(coalesce(nullif(target_payload->'driver_ids','null'::jsonb),'[]'::jsonb)) with ordinality input(value,ordinality);
  select coalesce(array_agg(value order by ordinality),array[]::text[]) into external_names from jsonb_array_elements_text(coalesce(nullif(target_payload->'external_names','null'::jsonb),'[]'::jsonb)) with ordinality input(value,ordinality);
  perform public.admin_replace_opportunity_assignments(null,array[result_show],driver_ids,external_names);

  if selected_template is not null then
    if not exists(select 1 from public.checklist_templates where id=selected_template and kind=contract_kind and (active or exists(select 1 from public.contract_checklists cc where cc.contract_id=result_contract and cc.template_id=selected_template))) then raise exception 'The selected checklist template is unavailable or has the wrong contract type'; end if;
    insert into public.show_checklist_templates(show_id,kind,template_id) values(result_show,contract_kind,selected_template) on conflict(show_id,kind) do update set template_id=excluded.template_id;
    perform public.admin_assign_checklist(result_contract,selected_template);
  else
    delete from public.show_checklist_templates where show_id=result_show and kind=contract_kind;
    update public.contract_checklists set template_id=null where contract_id=result_contract;
  end if;
  return result_contract;
end $$;

create function roadshow_private.admin_save_signing(target_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  result_show uuid:=nullif(target_payload->>'show_id','')::uuid;
  result_contract uuid:=nullif(target_payload->>'contract_id','')::uuid;
  selected_template uuid:=nullif(target_payload->>'template_id','')::uuid;
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

  select coalesce(array_agg(value::uuid order by ordinality),array[]::uuid[]) into driver_ids from jsonb_array_elements_text(coalesce(nullif(target_payload->'driver_ids','null'::jsonb),'[]'::jsonb)) with ordinality input(value,ordinality);
  select coalesce(array_agg(value order by ordinality),array[]::text[]) into external_names from jsonb_array_elements_text(coalesce(nullif(target_payload->'external_names','null'::jsonb),'[]'::jsonb)) with ordinality input(value,ordinality);
  perform public.admin_replace_opportunity_assignments(null,array[result_show],driver_ids,external_names);
  if selected_template is not null then
    if not exists(select 1 from public.checklist_templates where id=selected_template and (active or exists(select 1 from public.contract_checklists cc where cc.contract_id=result_contract and cc.template_id=selected_template))) then raise exception 'The selected checklist template is unavailable'; end if;
    perform public.admin_assign_checklist(result_contract,selected_template);
  else update public.contract_checklists set template_id=null where contract_id=result_contract;
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[]) into linked_ids from jsonb_array_elements_text(coalesce(nullif(target_payload->'linked_show_ids','null'::jsonb),'[]'::jsonb)) input(value);
  if exists(select 1 from unnest(linked_ids) requested(id) left join public.shows s on s.id=requested.id and s.event_type='signing' where s.id is null or requested.id=result_show) then raise exception 'Every linked signing must still exist'; end if;
  delete from public.show_links where show_id=result_show or linked_show_id=result_show;
  insert into public.show_links(show_id,linked_show_id)
  select least(result_show,id),greatest(result_show,id) from unnest(linked_ids) id on conflict do nothing;
  return result_contract;
end $$;

create function roadshow_private.admin_replace_opportunity_assignments(
  target_release_item uuid,
  target_show_ids uuid[],
  target_driver_ids uuid[],
  target_external_names text[]
) returns void language plpgsql security definer set search_path='' as $$
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
    delete from public.contract_drivers where contract_id=target_contract and not (driver_id=any(coalesce(clean_driver_ids,array[]::uuid[])));
    insert into public.contract_drivers(contract_id,driver_id,is_trainee)
      select target_contract,value,ordinality>1
      from unnest(coalesce(clean_driver_ids,array[]::uuid[])) with ordinality values_list(value,ordinality) on conflict(contract_id,driver_id) do update set is_trainee=excluded.is_trainee;

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

create function roadshow_private.agreement_state() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'content',public.agreement_content(c.id),
 'contract',to_jsonb(c)-'updated_at','show',to_jsonb(s)-'updated_at',
 'template_id',(select cc.template_id from public.contract_checklists cc where cc.contract_id=c.id),
 'roster',coalesce((select jsonb_agg(jsonb_build_object('id',d.driver_id,'trainee',d.is_trainee) order by d.driver_id) from public.contract_drivers d where d.contract_id=c.id),'[]'::jsonb),
 'external_names',coalesce((select jsonb_agg(e.display_name order by e.position) from public.contract_external_assignees e where e.contract_id=c.id),'[]'::jsonb),
 'signatures',coalesce((select jsonb_agg(to_jsonb(sig) order by sig.signer_role) from public.agreement_signatures sig where sig.version_id=c.current_agreement_id),'[]'::jsonb)
 ) order by c.id),'[]'::jsonb) from public.contracts c join public.shows s on s.id=c.show_id
$$;

create function roadshow_private.normalize_agreement_payload(payload jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=payload; key text;
begin
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Agreement payload must be an object'; end if;
 foreach key in array array['driver_ids','external_names','show_ids','linked_show_ids','sections'] loop
  if result ? key and result->key='null'::jsonb then result:=jsonb_set(result,array[key],'[]'); end if;
  if result ? key and jsonb_typeof(result->key) is distinct from 'array' then raise exception '% must be an array',key; end if;
 end loop;
 return result;
end $$;

create function roadshow_private.prepare_template_change(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sec jsonb; item jsonb; sections jsonb:='[]'; items jsonb; sid uuid; iid uuid; spos integer:=0; ipos integer;
begin
 for sec in select value from jsonb_array_elements(coalesce(nullif(payload->'sections','null'::jsonb),'[]')) loop
  sid:=nullif(sec->>'id','')::uuid;
  if sid is null then select id into sid from public.checklist_sections where template_id=(payload->>'template_id')::uuid and position=spos and not archived; end if;
  sid:=coalesce(sid,gen_random_uuid()); items:='[]'; ipos:=0;
  for item in select value from jsonb_array_elements(coalesce(nullif(sec->'items','null'::jsonb),'[]')) loop
   iid:=nullif(item->>'id','')::uuid;
   if iid is null then select id into iid from public.checklist_items where section_id=sid and position=ipos and not archived; end if;
   iid:=coalesce(iid,gen_random_uuid());
   items:=items||jsonb_build_array(item||jsonb_build_object('id',iid)); ipos:=ipos+1;
  end loop;
  sections:=sections||jsonb_build_array(sec||jsonb_build_object('id',sid,'items',items)); spos:=spos+1;
 end loop;
 return payload||jsonb_build_object('sections',sections);
end $$;

create function roadshow_private.mutate_template(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare tid uuid:=(payload->>'template_id')::uuid; sec jsonb; item jsonb; sid uuid; iid uuid; spos integer:=0; ipos integer;
begin
 if not exists(select 1 from public.checklist_templates where id=tid) then raise exception 'Template unavailable'; end if;
 if exists(select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id where cc.template_id=tid and c.kind<>(payload->>'kind')::public.contract_kind) then raise exception 'Issued template kind cannot change'; end if;
 update public.checklist_templates set name=trim(payload->>'name'),kind=(payload->>'kind')::public.contract_kind,version=version+1 where id=tid;
 update public.checklist_sections set archived=true where template_id=tid;
 update public.checklist_items set archived=true where section_id in(select id from public.checklist_sections where template_id=tid);
 for sec in select value from jsonb_array_elements(payload->'sections') loop
  sid:=(sec->>'id')::uuid;
  if exists(select 1 from public.checklist_sections where id=sid and template_id<>tid) then raise exception 'Section does not belong to template'; end if;
  insert into public.checklist_sections(id,template_id,title,position,archived) values(sid,tid,trim(sec->>'title'),spos,false)
  on conflict(id) do update set title=excluded.title,position=excluded.position,archived=false;
  ipos:=0;
  for item in select value from jsonb_array_elements(coalesce(nullif(sec->'items','null'::jsonb),'[]')) loop
   iid:=(item->>'id')::uuid;
   if exists(select 1 from public.checklist_items where id=iid and section_id<>sid) then raise exception 'Item does not belong to section'; end if;
   insert into public.checklist_items(id,section_id,title,instructions,required,photo_required,position,archived)
   values(iid,sid,trim(item->>'title'),item->>'instructions',coalesce((item->>'required')::boolean,(select required from public.checklist_items where id=iid),true),
    coalesce((item->>'photo_required')::boolean,(select photo_required from public.checklist_items where id=iid),false),ipos,false)
   on conflict(id) do update set title=excluded.title,instructions=case when item ? 'instructions' then excluded.instructions else public.checklist_items.instructions end,
    required=excluded.required,photo_required=excluded.photo_required,position=excluded.position,archived=false;
   ipos:=ipos+1;
  end loop;
  spos:=spos+1;
 end loop;
 return tid;
end $$;

create function roadshow_private.mutate_agreement(operation text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 case operation
 when 'show' then result:=roadshow_private.admin_save_show_contract(payload);
 when 'signing' then result:=roadshow_private.admin_save_signing(payload);
 when 'assign' then
  perform roadshow_private.admin_replace_opportunity_assignments(nullif(payload->>'release_item_id','')::uuid,
   array(select value::uuid from jsonb_array_elements_text(coalesce(payload->'show_ids','[]'))),
   array(select value::uuid from jsonb_array_elements_text(coalesce(payload->'driver_ids','[]'))),
   array(select value from jsonb_array_elements_text(coalesce(payload->'external_names','[]'))));
  select id into result from public.contracts where show_id=(payload->'show_ids'->>0)::uuid;
 when 'template' then result:=roadshow_private.mutate_template(payload);
 else raise exception 'Unknown agreement operation'; end case;
 return result;
end $$;

create function roadshow_private.agreement_consequences(before_state jsonb,after_state jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare prior jsonb; next jsonb; result jsonb:='[]'; signer uuid; removed boolean; legacy_roster_changed boolean;
begin
 for prior in select value from jsonb_array_elements(before_state) loop
  select value into next from jsonb_array_elements(after_state) where value->>'id'=prior->>'id';
  if next is null then raise exception 'Agreement removal is not supported'; end if;
  select (value->>'signer_id')::uuid into signer from jsonb_array_elements(prior->'signatures') where value->>'signer_role'='driver';
  removed:=signer is not null and not exists(select 1 from jsonb_array_elements(next->'roster') d where d->>'id'=signer::text)
    and next->'contract'->>'driver_id' is distinct from signer::text;
  legacy_roster_changed:=(prior->'contract'->>'current_agreement_id' is null)
    and (prior->'contract'->>'signed_at' is not null or prior->'contract'->>'admin_signed_at' is not null)
    and (prior->'roster' is distinct from next->'roster' or prior->'contract'->'driver_id' is distinct from next->'contract'->'driver_id');
  if ((prior->'content' is distinct from next->'content') and
    (prior->'contract'->>'current_agreement_id' is not null or prior->'contract'->>'signed_at' is not null or prior->'contract'->>'admin_signed_at' is not null)) or removed or legacy_roster_changed then
   result:=result||jsonb_build_array(jsonb_build_object('contract_id',prior->>'id','work_name',prior->'content'->'work'->>'name',
    'before',prior->'content','after',next->'content','removed_signer',case when removed then signer else null end,
    'requires_both_signatures',true));
  end if;
 end loop;
 return result;
end $$;

create function public.preview_agreement_change(operation text,target_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare normalized jsonb; mutation jsonb; before_state jsonb; after_state jsonb; consequences jsonb; result_id uuid; ticket uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 normalized:=roadshow_private.normalize_agreement_payload(target_payload); mutation:=normalized;
 if operation in ('show','signing') and nullif(normalized->>'show_id','') is null then raise exception 'Create initial work with the atomic save, then preview existing agreement changes'; end if;
 if operation='template' then mutation:=roadshow_private.prepare_template_change(normalized); end if;
 before_state:=roadshow_private.agreement_state();
 begin
  perform roadshow_private.begin_agreement_change();
  result_id:=roadshow_private.mutate_agreement(operation,mutation);
  after_state:=roadshow_private.agreement_state();
  raise exception using errcode='P6001',message='rollback preview';
 exception when sqlstate 'P6001' then null;
 end;
 consequences:=roadshow_private.agreement_consequences(before_state,after_state);
 delete from roadshow_private.agreement_previews where expires_at<clock_timestamp() and committed_result is null;
 insert into roadshow_private.agreement_previews(actor_id,operation,input,mutation,before_state,after_state,consequences)
 values(auth.uid(),operation,normalized,mutation,before_state,after_state,consequences) returning token into ticket;
 return jsonb_build_object('token',ticket,'consequences',consequences,'resulting_content',
  (select coalesce(jsonb_agg(jsonb_build_object('contract_id',a->>'id','content',a->'content')),'[]') from jsonb_array_elements(after_state) a
   where a is distinct from (select b from jsonb_array_elements(before_state) b where b->>'id'=a->>'id')));
end $$;

create function public.commit_agreement_change(operation text,target_payload jsonb,preview_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ticket roadshow_private.agreement_previews; result_id uuid; consequence jsonb; affected uuid; c record;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 select * into ticket from roadshow_private.agreement_previews where token=preview_token::uuid and actor_id=auth.uid() for update;
 if ticket.token is null or ticket.operation<>operation or ticket.input is distinct from roadshow_private.normalize_agreement_payload(target_payload) then raise exception 'Preview payload does not match'; end if;
 if ticket.committed_result is not null then return ticket.committed_result; end if;
 if ticket.expires_at<clock_timestamp() or ticket.before_state is distinct from roadshow_private.agreement_state() then raise exception 'Stale preview: review changes again'; end if;
 perform roadshow_private.begin_agreement_change();
 result_id:=roadshow_private.mutate_agreement(operation,ticket.mutation);
 if ticket.after_state is distinct from roadshow_private.agreement_state() then raise exception 'Preview and committed values differ'; end if;
 for c in select id from public.contracts order by id loop perform roadshow_private.sync_agreement_periods(c.id); end loop;
 for consequence in select value from jsonb_array_elements(ticket.consequences) loop
  affected:=(consequence->>'contract_id')::uuid;
  if exists(select 1 from public.contracts where id=affected and (current_agreement_id is not null or signed_at is not null or admin_signed_at is not null)) then
   perform roadshow_private.issue_agreement(affected);
  end if;
 end loop;
 perform roadshow_private.end_agreement_change();
 update roadshow_private.agreement_previews set committed_result=result_id where token=ticket.token;
 return result_id;
end $$;

-- Compatibility saves allow edits without consequences; signed changes fail closed.
create function roadshow_private.compatible_agreement_change(operation text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare preview jsonb; result uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 if operation in ('show','signing') and nullif(payload->>'show_id','') is null then
  if operation='signing' and exists(select 1 from public.contracts c where c.show_id in(select value::uuid from jsonb_array_elements_text(coalesce(nullif(payload->'linked_show_ids','null'::jsonb),'[]'))) and (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null)) then raise exception 'Create without links, then review linked agreement changes'; end if;
  perform roadshow_private.begin_agreement_change();
  result:=roadshow_private.mutate_agreement(operation,roadshow_private.normalize_agreement_payload(payload));
  perform roadshow_private.end_agreement_change(); return result;
 end if;
 preview:=public.preview_agreement_change(operation,payload);
 if jsonb_array_length(preview->'consequences')>0 then raise exception 'Agreement changes require preview and explicit confirmation'; end if;
 return public.commit_agreement_change(operation,payload,preview->>'token');
end $$;

create or replace function public.admin_save_show_contract(target_payload jsonb) returns uuid language sql security definer set search_path='' as $$ select roadshow_private.compatible_agreement_change('show',$1) $$;
create or replace function public.admin_save_signing(target_payload jsonb) returns uuid language sql security definer set search_path='' as $$ select roadshow_private.compatible_agreement_change('signing',$1) $$;
create or replace function public.admin_replace_opportunity_assignments(target_release_item uuid,target_show_ids uuid[],target_driver_ids uuid[],target_external_names text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if roadshow_private.in_agreement_change() then
  perform roadshow_private.admin_replace_opportunity_assignments(target_release_item,target_show_ids,target_driver_ids,target_external_names);
 else
  perform roadshow_private.compatible_agreement_change('assign',jsonb_build_object('release_item_id',target_release_item,'show_ids',target_show_ids,'driver_ids',target_driver_ids,'external_names',target_external_names));
 end if;
end $$;
create or replace function public.admin_assign_checklist(target_contract uuid,target_template uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 if not roadshow_private.in_agreement_change() and exists(select 1 from public.contracts c where c.id=target_contract and (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null))
  and (select template_id from public.contract_checklists where contract_id=target_contract) is distinct from target_template then raise exception 'Checklist changes require agreement review'; end if;
 insert into public.contract_checklists(contract_id,template_id) values(target_contract,target_template)
 on conflict(contract_id) do update set template_id=excluded.template_id returning id into result; return result;
end $$;
create or replace function public.admin_replace_checklist_template(target_template uuid,new_name text,new_kind public.contract_kind,new_sections jsonb) returns uuid
language sql security definer set search_path='' as $$
 select roadshow_private.compatible_agreement_change('template',jsonb_build_object('template_id',$1,'name',$2,'kind',$3,'sections',$4))
$$;

create function roadshow_private.guard_issued_related() returns trigger
language plpgsql security definer set search_path='' as $$
declare tids uuid[]; cids uuid[]; sids uuid[];
begin
 if roadshow_private.in_agreement_change() then return coalesce(new,old); end if;
 if tg_table_name='contract_drivers' or tg_table_name='contract_checklists' then
  cids:=array[new.contract_id,old.contract_id];
  if exists(select 1 from public.contracts c where c.id=any(cids) and (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null)) then raise exception 'Issued agreement changes require review'; end if;
 elsif tg_table_name='show_links' then
  sids:=array[new.show_id,old.show_id,new.linked_show_id,old.linked_show_id];
  if exists(select 1 from public.contracts c where c.show_id=any(sids) and (c.current_agreement_id is not null or c.signed_at is not null or c.admin_signed_at is not null)) then raise exception 'Linked agreement changes require review'; end if;
 else
  if tg_table_name='checklist_templates' then tids:=array[new.id,old.id];
  elsif tg_table_name='checklist_sections' then tids:=array[new.template_id,old.template_id];
  else select array_agg(template_id) into tids from public.checklist_sections where id in(new.section_id,old.section_id); end if;
  if exists(select 1 from public.contract_checklists where template_id=any(tids)) then
   if tg_table_name='checklist_templates' and tg_op='UPDATE' and (to_jsonb(new)-'active')=(to_jsonb(old)-'active') then return new; end if;
   raise exception 'Issued checklist content changes require agreement review';
  end if;
 end if;
 return coalesce(new,old);
end $$;
create trigger agreement_roster_guard before insert or update or delete on public.contract_drivers for each row execute function roadshow_private.guard_issued_related();
create trigger agreement_checklist_guard before insert or update or delete on public.contract_checklists for each row execute function roadshow_private.guard_issued_related();
create trigger agreement_template_guard before update or delete on public.checklist_templates for each row execute function roadshow_private.guard_issued_related();
create trigger agreement_section_guard before insert or update or delete on public.checklist_sections for each row execute function roadshow_private.guard_issued_related();
create trigger agreement_item_guard before insert or update or delete on public.checklist_items for each row execute function roadshow_private.guard_issued_related();
create trigger agreement_link_guard before insert or update or delete on public.show_links for each row execute function roadshow_private.guard_issued_related();
revoke all on all functions in schema roadshow_private from public,anon,authenticated;
revoke all on function public.preview_agreement_change(text,jsonb),public.commit_agreement_change(text,jsonb,text) from public,anon;
grant execute on function public.preview_agreement_change(text,jsonb),public.commit_agreement_change(text,jsonb,text) to authenticated;
create or replace function public.agreement_content(target_contract uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'contract',jsonb_build_object('kind',c.kind,'service_date',c.service_date,'service_time',c.service_time,
   'contract_pay',c.contract_pay,'bonus_pay',c.bonus_pay,'terms',c.terms,'document_path',c.document_path),
  'work',jsonb_build_object('id',s.id,'name',s.name,'event_type',s.event_type,'artist',s.artist,
   'venue_name',s.venue_name,'starts_on',s.starts_on,'ends_on',s.ends_on,'city',s.city,'state',s.state,
   'address',s.address,'bin_count',s.bin_count,'signing_at',s.signing_at,'setup_at',s.setup_at,
   'per_diem',s.per_diem,'meals_included',s.meals_included,'lodging_included',s.lodging_included),
  'linked_show_ids',coalesce((select jsonb_agg(other_id order by other_id) from
   (select case when l.show_id=s.id then l.linked_show_id else l.show_id end other_id from public.show_links l where l.show_id=s.id or l.linked_show_id=s.id) linked),'[]'::jsonb),
  'checklist',coalesce((select jsonb_agg(jsonb_build_object('id',sec.id,'title',sec.title,'position',sec.position,
   'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'instructions',i.instructions,
   'required',i.required,'photo_required',i.photo_required,'position',i.position) order by i.position,i.id)
   from public.checklist_items i where i.section_id=sec.id and not i.archived),'[]'::jsonb)) order by sec.position,sec.id)
   from public.contract_checklists cc join public.checklist_sections sec on sec.template_id=cc.template_id where cc.contract_id=c.id and not sec.archived),'[]'::jsonb)
 ) from public.contracts c join public.shows s on s.id=c.show_id where c.id=target_contract
$$;
commit;
