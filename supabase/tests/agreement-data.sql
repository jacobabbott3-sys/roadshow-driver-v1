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
