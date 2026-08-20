-- Roadshow Driver beta: reusable, admin-owned test show sandbox

alter table public.shows
  add column if not exists is_test boolean not null default false,
  add column if not exists test_owner uuid references public.profiles(id) on delete set null;

create unique index if not exists one_beta_test_show_per_admin
  on public.shows(test_owner) where is_test and test_owner is not null;

create or replace function public.reset_my_beta_test_show()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  result_show uuid;
  result_contract uuid;
  test_template uuid;
  checklist_id uuid;
  section_id uuid;
  photo_paths jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select id into test_template
  from public.checklist_templates
  where name='[Beta] Test Show Checklist' and kind='setup'
  order by created_at desc limit 1;

  if test_template is null then
    insert into public.checklist_templates(name,kind,active)
    values('[Beta] Test Show Checklist','setup',true)
    returning id into test_template;

    insert into public.checklist_sections(template_id,title,position)
    values(test_template,'Load Truck',0) returning id into section_id;
    insert into public.checklist_items(section_id,title,required,photo_required,position)
    values
      (section_id,'Confirm toolbag and supplies',true,false,0),
      (section_id,'Load booth materials',true,false,1),
      (section_id,'Complete truck check',true,false,2);

    insert into public.checklist_sections(template_id,title,position)
    values(test_template,'Build Booth',1) returning id into section_id;
    insert into public.checklist_items(section_id,title,required,photo_required,position)
    values
      (section_id,'Unload and stage materials',true,false,0),
      (section_id,'Build booth structure',true,false,1),
      (section_id,'Install signage and displays',true,false,2);

    insert into public.checklist_sections(template_id,title,position)
    values(test_template,'Final Walkthrough',2) returning id into section_id;
    insert into public.checklist_items(section_id,title,required,photo_required,position)
    values
      (section_id,'Clean and organize booth',true,false,0),
      (section_id,'Complete final walkthrough',true,false,1);
  else
    update public.checklist_templates set active=true where id=test_template;
  end if;

  select id into result_show from public.shows
  where is_test and test_owner=auth.uid() limit 1;

  if result_show is null then
    insert into public.shows(
      name,starts_on,ends_on,city,state,address,bin_count,
      lodging_included,details_unlock_at,created_by,event_type,per_diem,
      lodging_name,lodging_address,lodging_phone,lodging_confirmation,
      lodging_check_in,lodging_check_out,lodging_notes,is_test,test_owner
    ) values(
      '[BETA TEST] Convention Show',current_date+14,current_date+16,
      'Denver','CO','100 Test Center Drive',12,true,now(),auth.uid(),
      'show',65,'Beta Test Hotel','200 Test Hotel Way','555-0100',
      'TEST-12345',current_date+13,current_date+17,
      'Test lodging details. No real reservation exists.',true,auth.uid()
    ) returning id into result_show;
  else
    update public.shows set
      name='[BETA TEST] Convention Show',starts_on=current_date+14,
      ends_on=current_date+16,city='Denver',state='CO',
      address='100 Test Center Drive',bin_count=12,per_diem=65,
      lodging_included=true,details_unlock_at=now(),event_type='show',
      artist=null,venue_name=null,signing_at=null,setup_at=null,
      lodging_name='Beta Test Hotel',lodging_address='200 Test Hotel Way',
      lodging_phone='555-0100',lodging_confirmation='TEST-12345',
      lodging_check_in=current_date+13,lodging_check_out=current_date+17,
      lodging_notes='Test lodging details. No real reservation exists.',
      is_test=true,test_owner=auth.uid()
    where id=result_show;
  end if;

  select id into result_contract from public.contracts
  where show_id=result_show limit 1;

  if result_contract is null then
    insert into public.contracts(
      show_id,driver_id,kind,status,service_date,service_time,
      contract_pay,bonus_pay,terms
    ) values(
      result_show,auth.uid(),'setup','available',current_date+13,'08:00',
      350,100,
      'Beta test contract terms. Use this contract only to test app features.'
    ) returning id into result_contract;
  else
    update public.contracts set
      driver_id=auth.uid(),kind='setup',status='available',
      service_date=current_date+13,service_time='08:00',contract_pay=350,
      bonus_pay=100,terms='Beta test contract terms. Use this contract only to test app features.',
      document_path=null,signed_at=null,signature_name=null,submitted_at=null,
      reviewed_at=null,reviewed_by=null,admin_note=null,
      admin_signed_at=null,admin_signature_name=null,updated_at=now()
    where id=result_contract;
  end if;

  select coalesce(jsonb_agg(storage_path),'[]'::jsonb) into photo_paths
  from public.photos where contract_id=result_contract;
  delete from public.photos where contract_id=result_contract;

  select id into checklist_id from public.contract_checklists
  where contract_id=result_contract;
  if checklist_id is not null then
    delete from public.checklist_responses where contract_checklist_id=checklist_id;
    update public.contract_checklists set template_id=test_template where id=checklist_id;
  else
    insert into public.contract_checklists(contract_id,template_id)
    values(result_contract,test_template) returning id into checklist_id;
  end if;

  insert into public.show_checklist_templates(show_id,kind,template_id)
  values(result_show,'setup',test_template)
  on conflict(show_id,kind) do update set template_id=excluded.template_id;

  delete from public.contract_drivers where contract_id=result_contract;
  insert into public.contract_drivers(contract_id,driver_id,is_trainee)
  values(result_contract,auth.uid(),false);
  delete from public.availability where show_id=result_show;

  delete from public.notifications where contract_id=result_contract;
  insert into public.notifications(recipient_id,title,body,link,kind,contract_id)
  values(
    auth.uid(),'Beta test contract ready',
    'Your resettable Beta Test Show is ready to use.',
    '/contracts/'||result_contract,'assignment',result_contract
  );

  return jsonb_build_object(
    'show_id',result_show,
    'contract_id',result_contract,
    'photo_paths',coalesce(photo_paths,'[]'::jsonb)
  );
end $$;

grant execute on function public.reset_my_beta_test_show() to authenticated;
