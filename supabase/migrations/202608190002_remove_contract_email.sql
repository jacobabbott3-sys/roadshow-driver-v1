-- Remove the abandoned signed-contract email beta feature from databases
-- that installed it before the feature was removed from the main migration.

drop trigger if exists queue_signed_contract_email on public.contracts;
drop function if exists public.queue_signed_contract_email();
drop table if exists public.contract_email_queue;
drop table if exists public.app_settings;
