-- UNAPPLIED PROPOSAL. No agreement changes, triggers, scheduled jobs or new grants.
-- Review records are explicit human decisions, never an automatic mail queue.
create table public.contract_notice_reviews (
  id uuid primary key,
  actor_id uuid not null,
  expires_at bigint not null,
  notice jsonb not null,
  state text not null check(state in ('reviewed','skipped','deferred','sending','sent','stale','failed','uncertain')),
  created_at timestamptz not null default now()
);
create table public.contract_notice_deliveries (
  environment_scope text not null,
  version_id uuid not null,
  recipient text not null,
  payload_hash text not null,
  state text not null check(state in ('pending','accepted','rejected','uncertain')),
  updated_at timestamptz not null default now(),
  primary key(environment_scope, version_id, recipient)
);
alter table public.contract_notice_reviews enable row level security;
alter table public.contract_notice_deliveries enable row level security;
revoke all on public.contract_notice_reviews, public.contract_notice_deliveries from public, anon, authenticated;
-- Verify pre-existing service_role default privileges before separately approved use.
-- Pending/uncertain records must NEVER be automatically expired or replayed.
