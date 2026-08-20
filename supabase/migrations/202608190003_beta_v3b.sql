-- Roadshow Driver beta v3b: safe template editing and availability details

create or replace function public.get_public_show_availability()
returns table(
  show_id uuid,
  assignees jsonb,
  contract_pay numeric,
  bonus_pay numeric,
  contract_kind public.contract_kind,
  service_date date,
  service_time time
)
language sql stable security definer set search_path=public as $$
  with assigned as (
    select c.show_id,cd.driver_id
    from public.contracts c join public.contract_drivers cd on cd.contract_id=c.id
    union
    select c.show_id,c.driver_id from public.contracts c where c.driver_id is not null
  ), assignment_groups as (
    select assigned.show_id,
      jsonb_agg(distinct jsonb_build_object(
        'id',p.id,'full_name',p.full_name,'role',p.role
      )) as assignees
    from assigned join public.profiles p on p.id=assigned.driver_id and p.is_active
    group by assigned.show_id
  ), current_contract as (
    select distinct on (c.show_id)
      c.show_id,c.contract_pay,c.bonus_pay,c.kind,c.service_date,c.service_time
    from public.contracts c
    order by c.show_id,c.created_at desc
  )
  select s.id,coalesce(assignment_groups.assignees,'[]'::jsonb),
    current_contract.contract_pay,current_contract.bonus_pay,current_contract.kind,
    current_contract.service_date,current_contract.service_time
  from public.shows s
  left join assignment_groups on assignment_groups.show_id=s.id
  left join current_contract on current_contract.show_id=s.id
  where auth.uid() is not null and s.event_type='show'
$$;
grant execute on function public.get_public_show_availability() to authenticated;

drop function if exists public.admin_replace_checklist_template(uuid,text,public.contract_kind,jsonb);
create function public.admin_replace_checklist_template(
  target_template uuid,
  new_name text,
  new_kind public.contract_kind,
  new_sections jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  replacement_id uuid:=target_template;
  prior_version integer;
  section_data jsonb;
  item_data jsonb;
  section_id uuid;
  section_position integer:=0;
  item_position integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select version into prior_version from public.checklist_templates where id=target_template;
  if prior_version is null then raise exception 'Checklist template not found'; end if;

  if exists(select 1 from public.contract_checklists where template_id=target_template) then
    insert into public.checklist_templates(name,kind,version,active)
    values(trim(new_name),new_kind,prior_version+1,true)
    returning id into replacement_id;
    update public.show_checklist_templates set template_id=replacement_id where template_id=target_template;
    update public.contract_checklists cc set template_id=replacement_id
    where cc.template_id=target_template
      and not exists(select 1 from public.checklist_responses response where response.contract_checklist_id=cc.id);
    update public.checklist_templates set active=false where id=target_template;
  else
    update public.checklist_templates
      set name=trim(new_name),kind=new_kind,version=version+1,active=true
      where id=target_template;
    delete from public.checklist_sections where template_id=target_template;
  end if;

  for section_data in select value from jsonb_array_elements(new_sections) loop
    insert into public.checklist_sections(template_id,title,position)
    values(replacement_id,trim(section_data->>'title'),section_position)
    returning id into section_id;
    item_position:=0;
    for item_data in select value from jsonb_array_elements(coalesce(section_data->'items','[]'::jsonb)) loop
      insert into public.checklist_items(section_id,title,instructions,required,photo_required,position)
      values(section_id,trim(item_data->>'title'),null,true,false,item_position);
      item_position:=item_position+1;
    end loop;
    section_position:=section_position+1;
  end loop;
  return replacement_id;
end $$;
grant execute on function public.admin_replace_checklist_template(uuid,text,public.contract_kind,jsonb) to authenticated;
