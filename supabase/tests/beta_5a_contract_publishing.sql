begin;

select plan(21);

select has_table('public', 'availability_release_batches');
select has_table('public', 'availability_release_items');
select has_table('public', 'availability_release_item_shows');
select has_table('public', 'availability_release_responses');
select has_table('public', 'contract_external_assignees');

select has_column('public', 'notification_preferences', 'availability_release_alerts');
select col_default_is(
  'public',
  'notification_preferences',
  'availability_release_alerts',
  'true',
  'batch push preference defaults on'
);

select has_function('public', 'admin_get_publishable_opportunities', array[]::text[]);
select has_function('public', 'admin_publish_availability_batch', array['uuid[]']);
select has_function('public', 'get_my_published_availability', array[]::text[]);
select has_function('public', 'set_my_release_response', array['uuid', 'text']);
select has_function('public', 'admin_get_release_responses', array['uuid']);
select has_function(
  'public',
  'admin_replace_opportunity_assignments',
  array['uuid', 'uuid[]', 'uuid[]', 'text[]']
);
select has_function('public', 'admin_withdraw_release_item', array['uuid']);

select col_not_null('public', 'availability_release_batches', 'released_at');
select col_not_null('public', 'availability_release_items', 'status');
select col_not_null('public', 'availability_release_responses', 'status');
select col_not_null('public', 'contract_external_assignees', 'display_name');

select policies_are(
  'public',
  'availability_release_batches',
  array['release batches admin read'],
  'release batches are not directly exposed to drivers'
);
select policies_are(
  'public',
  'availability_release_responses',
  array['release responses admin read'],
  'responses are written through RPCs'
);

select throws_ok(
  $$ select public.admin_publish_availability_batch(array[]::uuid[]) $$,
  'Admin access required',
  'anonymous callers cannot publish'
);

select * from finish();
rollback;
