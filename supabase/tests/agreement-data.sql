insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004');
update public.profiles set full_name='Synthetic Admin',role='admin' where id='00000000-0000-0000-0000-000000000001';
update public.profiles set full_name='Synthetic Driver' where id='00000000-0000-0000-0000-000000000002';
update public.profiles set full_name='Synthetic Other' where id='00000000-0000-0000-0000-000000000003';
update public.profiles set is_active=false where id='00000000-0000-0000-0000-000000000004';
insert into public.shows(id,name,starts_on,ends_on,city,per_diem)
 values('20000000-0000-0000-0000-000000000001','Synthetic Show','2026-11-01','2026-11-03','Denver',0);
insert into public.contracts(id,show_id,driver_id,kind,service_date,contract_pay,bonus_pay,terms)
 values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','setup','2026-11-01',0,null,'Exact full terms\nSecond line');
insert into public.contract_drivers(contract_id,driver_id,is_trainee) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',false),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',true);
insert into public.checklist_templates(id,name,kind) values('30000000-0000-0000-0000-000000000001','Synthetic checklist','setup');
insert into public.checklist_sections(id,template_id,title,position) values('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Load',0);
insert into public.checklist_items(id,section_id,title,instructions,required,photo_required,position) values('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Check supplies','Exact instruction',true,false,0);
insert into public.contract_checklists(id,contract_id,template_id) values('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
insert into public.checklist_responses(id,contract_checklist_id,item_id,completed) values('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',true);
insert into public.shows(id,name,starts_on,ends_on,city) values('20000000-0000-0000-0000-000000000003','Legacy synthetic','2026-11-01','2026-11-01','Denver');
insert into public.contracts(id,show_id,kind,service_date,signed_at,signature_name)
 values('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','setup','2026-11-01',now(),'Unknown legacy signer');
insert into public.shows(id,name,starts_on,ends_on,city) values('20000000-0000-0000-0000-000000000004','Legacy roster synthetic','2026-11-01','2026-11-01','Denver');
insert into public.contracts(id,show_id,driver_id,kind,service_date,signed_at,signature_name)
 values('10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','setup','2026-11-01',now(),'Unknown legacy signer');
insert into public.shows(id,name,starts_on,ends_on,city) values('20000000-0000-0000-0000-000000000005','Unissued synthetic','2026-11-01','2026-11-01','Denver');
insert into public.contracts(id,show_id,kind,service_date) values('10000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000005','setup','2026-11-01');
insert into public.checklist_templates(id,name,kind) values('30000000-0000-0000-0000-000000000009','Unissued checklist','setup');
insert into public.checklist_sections(id,template_id,title,position) values('40000000-0000-0000-0000-000000000009','30000000-0000-0000-0000-000000000009','Unissued section',0);
