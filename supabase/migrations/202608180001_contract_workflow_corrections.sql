-- Roadshow Driver: unified show/contract editing and reliable checklist actions
alter table public.contracts add column if not exists service_date date;
update public.contracts c set service_date=case when c.kind='setup' then s.starts_on-1 else s.ends_on end from public.shows s where c.show_id=s.id and c.service_date is null;
alter table public.contracts alter column service_date set not null;

create or replace function public.set_my_checklist_item(target_checklist uuid,target_item uuid,new_completed boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(
    select 1 from public.contract_checklists cc join public.contracts c on c.id=cc.contract_id
    join public.checklist_items i on i.id=target_item
    join public.checklist_sections s on s.id=i.section_id and s.template_id=cc.template_id
    where cc.id=target_checklist and c.driver_id=auth.uid()
  ) then raise exception 'This checklist is not assigned to your contract'; end if;
  insert into public.checklist_responses(contract_checklist_id,item_id,completed,completed_at)
  values(target_checklist,target_item,new_completed,case when new_completed then now() else null end)
  on conflict(contract_checklist_id,item_id) do update set completed=excluded.completed,completed_at=excluded.completed_at;
end $$;
grant execute on function public.set_my_checklist_item(uuid,uuid,boolean) to authenticated;
