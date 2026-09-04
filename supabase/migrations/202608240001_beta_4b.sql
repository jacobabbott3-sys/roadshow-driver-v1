-- Beta 4B: account-synced Extreme Confetti Mode.

alter table public.profiles
  add column if not exists extreme_confetti boolean not null default false;

grant update(extreme_confetti) on public.profiles to authenticated;
