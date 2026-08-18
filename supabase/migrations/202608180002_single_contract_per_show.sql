-- Roadshow Driver: consolidate legacy setup/teardown duplicates
-- Keep the most progressed/assigned contract for each show, then enforce one contract per show.
with ranked as (
  select id,row_number() over(
    partition by show_id order by
      (signed_at is not null) desc,
      (driver_id is not null) desc,
      case status when 'bonus_earned' then 9 when 'approved' then 8 when 'under_review' then 7 when 'submitted' then 6 when 'in_progress' then 5 when 'signed' then 4 when 'available' then 3 else 1 end desc,
      updated_at desc,created_at desc
  ) as position
  from public.contracts
)
delete from public.contracts where id in (select id from ranked where position>1);
create unique index if not exists one_contract_per_show_idx on public.contracts(show_id);
