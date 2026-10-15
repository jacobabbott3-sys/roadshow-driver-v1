-- This global notification writer belongs to the scheduled backend job.
-- Keep the existing postgres owner and service_role access. The app uses
-- public.ensure_my_due_notifications() for its current-user notification path.
-- PUBLIC's default grant and explicit client grants must all be removed.
revoke execute on function public.create_due_work_notifications()
  from public, anon, authenticated;
