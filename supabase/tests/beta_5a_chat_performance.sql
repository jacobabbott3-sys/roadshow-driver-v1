begin;
select plan(10);

select has_function('public','get_chat_thread_summaries',array['text','timestamp with time zone','integer']);
select function_returns('public','get_chat_thread_summaries',array['text','timestamp with time zone','integer'],'setof record');
select has_function('public','get_my_unread_chat_count',array[]::text[]);
select function_returns('public','get_my_unread_chat_count',array[]::text[],'integer');

select function_privs_are('public','get_chat_thread_summaries',array['text','timestamp with time zone','integer'],'authenticated',array['EXECUTE']);
select function_privs_are('public','get_my_unread_chat_count',array[]::text[],'authenticated',array['EXECUTE']);

select has_index('public','chat_thread_members','chat_thread_members_user_idx');
select has_index('public','chat_messages','chat_messages_thread_page_idx');

select throws_ok(
  $$ select * from public.get_chat_thread_summaries('',null,100) $$,
  'An active account is required',
  'anonymous callers cannot read summaries'
);
select is(
  public.get_my_unread_chat_count(),
  0,
  'anonymous callers have no unread chats'
);

select * from finish();
rollback;
