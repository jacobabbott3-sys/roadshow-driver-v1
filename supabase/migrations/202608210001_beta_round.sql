-- Beta round 4: expose assignment summaries for both shows and signings.

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
  where auth.uid() is not null
$$;

grant execute on function public.get_public_show_availability() to authenticated;
