-- Read-only catalog assertions. Requires no pgTAP extension or application data.
-- Kept outside supabase/tests because it is not a TAP/pg_prove test script.
-- Run after the reviewed permission migration in the intended environment.
-- This script never invokes either notification-writing function.
begin transaction read only;

do $verify$
declare
  target oid := to_regprocedure('public.create_due_work_notifications()');
begin
  if target is null then
    raise exception 'Missing public.create_due_work_notifications()';
  end if;

  if has_function_privilege('anon', target, 'EXECUTE') then
    raise exception 'anon must not execute the scheduled due-work function';
  end if;
  if has_function_privilege('authenticated', target, 'EXECUTE') then
    raise exception 'authenticated must not execute the scheduled due-work function';
  end if;
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = target and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC must not execute the scheduled due-work function';
  end if;

  if not has_function_privilege('postgres', target, 'EXECUTE') then
    raise exception 'postgres must retain scheduled-job access';
  end if;
  if not has_function_privilege('service_role', target, 'EXECUTE') then
    raise exception 'service_role must retain its existing access';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.ensure_my_due_notifications()', 'EXECUTE'
  ) then
    raise exception 'authenticated must retain its separate user-scoped RPC';
  end if;
end
$verify$;

rollback;
