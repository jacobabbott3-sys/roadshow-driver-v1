-- Roadshow Driver: admin editing and explicit show configuration
alter table public.contracts add column if not exists terms text;

create table public.show_checklist_templates (
  show_id uuid not null references public.shows(id) on delete cascade,
  kind public.contract_kind not null,
  template_id uuid not null references public.checklist_templates(id),
  primary key(show_id,kind)
);
alter table public.show_checklist_templates enable row level security;
create policy "show checklist authenticated read" on public.show_checklist_templates for select to authenticated using(true);
create policy "show checklist admin manage" on public.show_checklist_templates for all using(public.is_admin()) with check(public.is_admin());

create or replace function public.admin_replace_checklist_template(target_template uuid,new_name text,new_kind public.contract_kind,new_sections jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare section_data jsonb; item_data jsonb; section_id uuid; section_position integer:=0; item_position integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.checklist_templates set name=trim(new_name),kind=new_kind,version=version+1 where id=target_template;
  delete from public.checklist_sections where template_id=target_template;
  for section_data in select value from jsonb_array_elements(new_sections) loop
    insert into public.checklist_sections(template_id,title,position) values(target_template,section_data->>'title',section_position) returning id into section_id;
    item_position:=0;
    for item_data in select value from jsonb_array_elements(coalesce(section_data->'items','[]'::jsonb)) loop
      insert into public.checklist_items(section_id,title,instructions,required,photo_required,position) values(section_id,item_data->>'title',null,true,coalesce((item_data->>'photo_required')::boolean,false),item_position);
      item_position:=item_position+1;
    end loop;
    section_position:=section_position+1;
  end loop;
end $$;
grant execute on function public.admin_replace_checklist_template(uuid,text,public.contract_kind,jsonb) to authenticated;
