-- PROPOSAL ONLY: never applied by CI/deployment. Requires separate beta approval.
-- No new grants. Verify existing service_role default privileges before activation.
create table public.admin_account_operations (
  actor_id uuid not null,
  request_id text not null,
  fingerprint text not null,
  recipient text not null,
  state text not null check (state in ('pending','complete','retryable','uncertain')),
  response jsonb,
  created_at timestamptz not null default now(),
  minute_bucket timestamptz not null default date_trunc('minute', now()),
  primary key (actor_id, request_id),
  unique (actor_id, minute_bucket),
  unique (recipient, minute_bucket)
);
-- Uncertain/pending operations never expire automatically or release on a new ID.
create unique index admin_account_recipient_pending on public.admin_account_operations(recipient)
  where state in ('pending','uncertain');
alter table public.admin_account_operations enable row level security;
revoke all on public.admin_account_operations from public, anon, authenticated;
-- No browser policies; server-only access uses already-existing service_role grants.
