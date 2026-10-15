-- Review hardening for reviewed agreement changes.
-- 1. Template payloads: reject duplicate section/item ids and ids of archived rows.
-- 2. Consequences: any removed lead/additional driver on an issued agreement requires explicit confirmation,
--    even when nothing was signed yet; such confirmations do not by themselves reissue the agreement.
-- 3. Admin RPCs are not executable by anon (they already reject internally).
begin;

create or replace function roadshow_private.prepare_template_change(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sec jsonb; item jsonb; sections jsonb:='[]'; items jsonb; sid uuid; iid uuid; spos integer:=0; ipos integer;
 seen_sections uuid[]:='{}'; seen_items uuid[]:='{}';
begin
 for sec in select value from jsonb_array_elements(coalesce(nullif(payload->'sections','null'::jsonb),'[]')) loop
  sid:=nullif(sec->>'id','')::uuid;
  if sid is not null and exists(select 1 from public.checklist_sections where id=sid and archived) then
   raise exception 'Archived checklist sections cannot be reused; create a new section'; end if;
  if sid is null then select id into sid from public.checklist_sections where template_id=(payload->>'template_id')::uuid and position=spos and not archived; end if;
  sid:=coalesce(sid,gen_random_uuid());
  if sid=any(seen_sections) then raise exception 'Duplicate checklist section id in request'; end if;
  seen_sections:=seen_sections||sid; items:='[]'; ipos:=0;
  for item in select value from jsonb_array_elements(coalesce(nullif(sec->'items','null'::jsonb),'[]')) loop
   iid:=nullif(item->>'id','')::uuid;
   if iid is not null and exists(select 1 from public.checklist_items where id=iid and archived) then
    raise exception 'Archived checklist items cannot be reused; create a new item'; end if;
   if iid is null then select id into iid from public.checklist_items where section_id=sid and position=ipos and not archived; end if;
   iid:=coalesce(iid,gen_random_uuid());
   if iid=any(seen_items) then raise exception 'Duplicate checklist item id in request'; end if;
   seen_items:=seen_items||iid;
   items:=items||jsonb_build_array(item||jsonb_build_object('id',iid)); ipos:=ipos+1;
  end loop;
  sections:=sections||jsonb_build_array(sec||jsonb_build_object('id',sid,'items',items)); spos:=spos+1;
 end loop;
 return payload||jsonb_build_object('sections',sections);
end $$;

create or replace function roadshow_private.agreement_consequences(before_state jsonb,after_state jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare prior jsonb; next jsonb; result jsonb:='[]'; signer uuid; removed boolean; legacy_roster_changed boolean;
 issued boolean; content_changed boolean; gone uuid[]; entry jsonb;
begin
 for prior in select value from jsonb_array_elements(before_state) loop
  select value into next from jsonb_array_elements(after_state) where value->>'id'=prior->>'id';
  if next is null then raise exception 'Agreement removal is not supported'; end if;
  select (value->>'signer_id')::uuid into signer from jsonb_array_elements(prior->'signatures') where value->>'signer_role'='driver';
  removed:=signer is not null and not exists(select 1 from jsonb_array_elements(next->'roster') d where d->>'id'=signer::text)
    and next->'contract'->>'driver_id' is distinct from signer::text;
  legacy_roster_changed:=(prior->'contract'->>'current_agreement_id' is null)
    and (prior->'contract'->>'signed_at' is not null or prior->'contract'->>'admin_signed_at' is not null)
    and (prior->'roster' is distinct from next->'roster' or prior->'contract'->'driver_id' is distinct from next->'contract'->'driver_id');
  issued:=prior->'contract'->>'current_agreement_id' is not null or prior->'contract'->>'signed_at' is not null or prior->'contract'->>'admin_signed_at' is not null;
  content_changed:=prior->'content' is distinct from next->'content';
  select coalesce(array_agg(distinct u),'{}') into gone from (
    select (d->>'id')::uuid u from jsonb_array_elements(prior->'roster') d
    union select nullif(prior->'contract'->>'driver_id','')::uuid) p(u)
   where u is not null
     and not exists(select 1 from jsonb_array_elements(next->'roster') d where d->>'id'=u::text)
     and next->'contract'->>'driver_id' is distinct from u::text;
  if (issued and content_changed) or removed or legacy_roster_changed or (issued and cardinality(gone)>0) then
   entry:=jsonb_build_object('contract_id',prior->>'id','work_name',prior->'content'->'work'->>'name',
    'before',prior->'content','after',next->'content','removed_signer',case when removed then signer else null end,
    'removed_driver_ids',to_jsonb(case when issued then gone else '{}'::uuid[] end),
    'reissue',(issued and content_changed) or removed or legacy_roster_changed,
    'requires_both_signatures',(issued and content_changed) or removed or legacy_roster_changed);
   result:=result||jsonb_build_array(entry);
  end if;
 end loop;
 return result;
end $$;

create or replace function public.commit_agreement_change(operation text,target_payload jsonb,preview_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ticket roadshow_private.agreement_previews; result_id uuid; consequence jsonb; affected uuid; c record;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(61007,1);
 select * into ticket from roadshow_private.agreement_previews where token=preview_token::uuid and actor_id=auth.uid() for update;
 if ticket.token is null or ticket.operation<>operation or ticket.input is distinct from roadshow_private.normalize_agreement_payload(target_payload) then raise exception 'Preview payload does not match'; end if;
 if ticket.committed_result is not null then return ticket.committed_result; end if;
 if ticket.expires_at<clock_timestamp() or ticket.before_state is distinct from roadshow_private.agreement_state() then raise exception 'Stale preview: review changes again'; end if;
 perform roadshow_private.begin_agreement_change();
 result_id:=roadshow_private.mutate_agreement(operation,ticket.mutation);
 if ticket.after_state is distinct from roadshow_private.agreement_state() then raise exception 'Preview and committed values differ'; end if;
 for c in select id from public.contracts order by id loop perform roadshow_private.sync_agreement_periods(c.id); end loop;
 for consequence in select value from jsonb_array_elements(ticket.consequences) loop
  affected:=(consequence->>'contract_id')::uuid;
  if coalesce((consequence->>'reissue')::boolean,true)
   and exists(select 1 from public.contracts where id=affected and (current_agreement_id is not null or signed_at is not null or admin_signed_at is not null)) then
   perform roadshow_private.issue_agreement(affected);
  end if;
 end loop;
 perform roadshow_private.end_agreement_change();
 update roadshow_private.agreement_previews set committed_result=result_id where token=ticket.token;
 return result_id;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure r from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'admin\_%' loop
  execute format('revoke execute on function %s from public, anon', f.r);
 end loop;
end $$;
revoke all on function public.preview_agreement_change(text,jsonb),public.commit_agreement_change(text,jsonb,text) from public,anon;
grant execute on function public.preview_agreement_change(text,jsonb),public.commit_agreement_change(text,jsonb,text) to authenticated;
commit;
