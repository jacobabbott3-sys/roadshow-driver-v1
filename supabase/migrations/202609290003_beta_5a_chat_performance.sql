-- Beta 5A: bounded chat summaries, paginated messages, and lightweight unread counts.

create index if not exists chat_thread_members_user_idx
  on public.chat_thread_members(user_id,thread_id);
create index if not exists chat_messages_thread_page_idx
  on public.chat_messages(thread_id,created_at desc,id desc);

create or replace function public.get_chat_thread_summaries(
  target_search text default '',
  target_before timestamptz default null,
  target_limit integer default 50
) returns table(
  id uuid,
  subject text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb,
  latest_message jsonb,
  unread boolean
) language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_active_user() then
    raise exception 'An active account is required';
  end if;

  return query
  select
    thread.id,
    thread.subject,
    thread.created_by,
    thread.created_at,
    thread.updated_at,
    coalesce(member_list.members,'[]'::jsonb),
    case when latest.id is null then null else jsonb_build_object(
      'id',latest.id,
      'thread_id',latest.thread_id,
      'sender_id',latest.sender_id,
      'body',latest.body,
      'created_at',latest.created_at,
      'sender',jsonb_build_object('full_name',coalesce(latest_sender.full_name,'Team member'))
    ) end,
    exists(
      select 1
      from public.chat_messages unread_message
      where unread_message.thread_id=thread.id
        and unread_message.sender_id<>auth.uid()
        and (mine.read_at is null or unread_message.created_at>mine.read_at)
    )
  from public.chat_threads thread
  join public.chat_thread_members mine
    on mine.thread_id=thread.id and mine.user_id=auth.uid()
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'user_id',member.user_id,
        'read_at',member.read_at,
        'profile',jsonb_build_object('full_name',profile.full_name,'role',profile.role)
      ) order by profile.full_name,member.user_id
    ) as members
    from public.chat_thread_members member
    join public.profiles profile on profile.id=member.user_id
    where member.thread_id=thread.id and profile.is_active
  ) member_list on true
  left join lateral (
    select message.id,message.thread_id,message.sender_id,message.body,message.created_at
    from public.chat_messages message
    where message.thread_id=thread.id
    order by message.created_at desc,message.id desc
    limit 1
  ) latest on true
  left join public.profiles latest_sender on latest_sender.id=latest.sender_id
  where (target_before is null or thread.updated_at<target_before)
    and (
      length(trim(coalesce(target_search,'')))=0
      or thread.subject ilike '%'||trim(target_search)||'%'
      or exists(
        select 1
        from public.chat_thread_members search_member
        join public.profiles search_profile on search_profile.id=search_member.user_id
        where search_member.thread_id=thread.id
          and search_profile.full_name ilike '%'||trim(target_search)||'%'
      )
    )
  order by thread.updated_at desc,thread.id desc
  limit least(greatest(coalesce(target_limit,50),1),50);
end $$;

create or replace function public.get_my_unread_chat_count()
returns integer language sql stable security definer set search_path=public as $$
  select case when public.is_active_user() then count(*)::integer else 0 end
  from public.chat_thread_members mine
  where mine.user_id=auth.uid()
    and exists(
      select 1
      from public.chat_messages message
      where message.thread_id=mine.thread_id
        and message.sender_id<>auth.uid()
        and (mine.read_at is null or message.created_at>mine.read_at)
    )
$$;

revoke all on function public.get_chat_thread_summaries(text,timestamptz,integer) from public;
revoke all on function public.get_my_unread_chat_count() from public;
grant execute on function public.get_chat_thread_summaries(text,timestamptz,integer) to authenticated;
grant execute on function public.get_my_unread_chat_count() to authenticated;
