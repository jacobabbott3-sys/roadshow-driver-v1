begin;
select plan(14);

select has_function('public','is_active_user',array[]::text[]);
select function_returns('public','is_active_user',array[]::text[],'boolean');
select has_function('public','admin_update_user',array['uuid','app_role','boolean']);
select function_returns('public','admin_update_user',array['uuid','app_role','boolean'],'void');
select has_function('public','admin_save_show_contract',array['jsonb']);
select has_function('public','admin_save_signing',array['jsonb']);

select function_lang_is('public','is_active_user',array[]::text[],'sql');

select policy_roles_are('public','profiles','active team directory read',array['authenticated']);
select policy_cmd_is('public','profiles','active team directory read','SELECT');
select policy_roles_are('public','contracts','contracts assigned read',array['authenticated']);
select policy_roles_are('public','notifications','notifications own read',array['authenticated']);
select policy_roles_are('public','notification_preferences','notification preferences own insert',array['authenticated']);
select policy_cmd_is('public','notification_preferences','notification preferences own insert','INSERT');

select throws_ok(
  $$ select public.admin_update_user(gen_random_uuid(),'driver',false) $$,
  'Admin access required',
  'anonymous and inactive callers cannot update users'
);

select * from finish();
rollback;
