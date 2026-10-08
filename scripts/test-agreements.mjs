// Disposable PostgreSQL only. No URL, environment credentials or network backend.
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = await PGlite.create();
let checks = 0;
const migrationLimit = process.env.AGREEMENT_STAGE || '7';
try {
  await db.exec(await readFile(new URL('../supabase/tests/agreement-fixture.sql', import.meta.url), 'utf8'));
  const dir = new URL('../supabase/migrations/', import.meta.url);
  let seeded=false;
  for (const file of (await readdir(dir)).sort()) {
    if (file.startsWith('20261007') && !seeded) {
      await db.exec(await readFile(new URL('../supabase/tests/agreement-data.sql', import.meta.url), 'utf8')); seeded=true;
    }
    if (file.startsWith('20261007') && Number(file.slice(11,12)) > Number(migrationLimit)) continue;
    // PGlite supplies gen_random_uuid natively; pgcrypto is unavailable here.
    const sql = (await readFile(new URL(file, dir), 'utf8')).replace('create extension if not exists pgcrypto;', '');
    try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error.message}`); }
  }
  if (!seeded) await db.exec(await readFile(new URL('../supabase/tests/agreement-data.sql', import.meta.url), 'utf8'));
  const q = async (sql, params=[]) => (await db.query(sql, params)).rows;
  const actor = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const deny = async (sql, params=[], pattern=/permission|immutable|review|agreement|acceptance|sign|denied/i) => {
    await assert.rejects(() => db.query(sql,params),pattern); checks++;
  };
  const ok = (value, expected, name) => { assert.deepEqual(value,expected,name); checks++; };
  const admin='00000000-0000-0000-0000-000000000001';
  const driver='00000000-0000-0000-0000-000000000002';
  const other='00000000-0000-0000-0000-000000000003';
  const contract='10000000-0000-0000-0000-000000000001';
  await actor(admin);
  await deny('update public.contracts set signed_at=now(),signature_name=\'Forged\' where id=$1',[contract]);
  await q("insert into public.shows(id,name,starts_on,ends_on,city) values('20000000-0000-0000-0000-000000000002','Insert probe','2026-11-01','2026-11-01','Denver')");
  await deny("insert into public.contracts(show_id,kind,service_date,signed_at,signature_name) values('20000000-0000-0000-0000-000000000002','teardown','2026-11-03',now(),'Forged')");
  await db.exec('reset role');
  // Synthetic owner inserts exercise trigger protection independently of RLS.
  const [v] = await q("insert into public.agreement_versions(contract_id,version_number,content,created_by) values($1,1,public.agreement_content($1),$2) returning id",[contract,admin]);
  await deny('update public.agreement_versions set content=\'{}\' where id=$1',[v.id]);
  await deny('delete from public.agreement_versions where id=$1',[v.id]);
  await deny('delete from public.contracts where id=$1',[contract],/foreign key|immutable|agreement/i);
  const [period] = await q('insert into public.agreement_assignment_periods(contract_id,driver_id) values($1,$2) returning id',[contract,other]);
  await deny("insert into public.agreement_signatures(version_id,signer_id,signer_role,assignment_period_id,signer_name) values($1,$2,'driver',$3,'Wrong account')",[v.id,driver,period.id],/binding|acceptance/i);
  await q("insert into public.contracts(id,show_id,kind,service_date) values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','setup','2026-11-01')");
  await assert.rejects(() => db.transaction(async tx => {
    await tx.query('select roadshow_private.begin_agreement_change()');
    await tx.query("update public.contracts set current_agreement_id=$1 where id='10000000-0000-0000-0000-000000000002'",[v.id]);
  }),/foreign key/i); checks++;
  await actor(other);
  ok((await q('select * from public.agreement_versions')).length,0,'unrelated version privacy');
  await deny('select public.agreement_content($1)',[contract]);
  await deny('select roadshow_private.begin_agreement_change()',[],/permission/i);
  if (Number(migrationLimit)>=2) {
    await actor(driver);
    const [review] = await q('select public.get_contract_agreement($1) result',[contract]);
    const version=review.result.version.id;
    ok(review.result.version.content.contract.contract_pay,0,'zero remains zero');
    ok(review.result.version.content.contract.bonus_pay,null,'null remains null');
    const [signed]=await q("select public.accept_contract_agreement($1,$2,'driver','Synthetic Driver') id",[contract,version]);
    ok((await q("select public.accept_contract_agreement($1,$2,'driver','Synthetic Driver') id",[contract,version]))[0].id,signed.id,'duplicate idempotent');
    await deny("select public.accept_contract_agreement($1,$2,'driver','Synthetic Driver')",[contract,v.id],/stale|review/i);
    await actor(other);
    await deny('select public.get_contract_agreement($1)',[contract],/access|assigned/i);
    await deny("select public.get_contract_agreement('10000000-0000-0000-0000-000000000002')",[],/access|assigned/i);
    await deny("select public.accept_contract_agreement($1,$2,'driver','Synthetic Other')",[contract,version],/assigned/i);
    ok((await q('select public.get_my_agreement_history() history'))[0].history,[],'unrelated history');
    await actor(admin);
    await q("select public.accept_contract_agreement($1,$2,'admin','Synthetic Admin')",[contract,version]);
    ok((await q('select public.get_contract_agreement($1) result',[contract]))[0].result.signatures.length,2,'both on same version');
    await actor('00000000-0000-0000-0000-000000000004');
    await deny('select public.get_my_agreement_history()',[],/active/i);
    await actor(driver);
    ok((await q('select public.get_my_agreement_history() history'))[0].history.length,1,'own accepted history');
    await deny("select public.sign_my_contract($1,'Old browser')",[contract],/review/i);
    await actor(admin);
    await q("update public.contracts set driver_id=$1 where id='10000000-0000-0000-0000-000000000002'",[admin]);
    const [adminReview]=await q("select public.get_contract_agreement('10000000-0000-0000-0000-000000000002') result");
    await q("select public.accept_contract_agreement('10000000-0000-0000-0000-000000000002',$1,'admin','Synthetic Admin')",[adminReview.result.version.id]);
    await q("select public.accept_contract_agreement('10000000-0000-0000-0000-000000000002',$1,'driver','Synthetic Admin')",[adminReview.result.version.id]);
    ok((await q("select public.get_contract_agreement('10000000-0000-0000-0000-000000000002') result"))[0].result.signatures.length,2,'admin-first assigned admin can sign as driver');
    const [legacy]=await q("select public.get_contract_agreement('10000000-0000-0000-0000-000000000003') result");
    ok(legacy.result.legacy_missing,true,'legacy missing copy explicitly labeled');
    ok(legacy.result.signatures.length,0,'legacy evidence not manufactured');
    ok(legacy.result.legacy_evidence.signature_name,'Unknown legacy signer','existing legacy name retained without inferred account');
    if (Number(migrationLimit)>=3) {
      await actor(admin);
      const payload={release_item_id:null,show_ids:['20000000-0000-0000-0000-000000000001'],driver_ids:[driver],external_names:null};
      const [preview]=await q("select public.preview_agreement_change('assign',$1::jsonb) result",[JSON.stringify(payload)]);
      ok(preview.result.consequences.length,0,'nonsigner removal retains acceptance');
      await q("select public.commit_agreement_change('assign',$1::jsonb,$2) result",[JSON.stringify(payload),preview.result.token]);
      ok((await q('select public.get_contract_agreement($1) result',[contract]))[0].result.version.id,version,'same accepted version');
      const removed={...payload,driver_ids:[other]};
      const [removal]=await q("select public.preview_agreement_change('assign',$1::jsonb) result",[JSON.stringify(removed)]);
      ok(removal.result.consequences.length,1,'accepting driver removal consequence');
      await q("select public.commit_agreement_change('assign',$1::jsonb,$2)",[JSON.stringify(removed),removal.result.token]);
      const [current]=await q('select public.get_contract_agreement($1) result',[contract]);
      ok(current.result.signatures.length,0,'both signatures reopened');
      await deny("select public.commit_agreement_change('assign',$1::jsonb,$2)",[JSON.stringify({...removed,driver_ids:[driver]}),removal.result.token],/preview|payload/i);
      await actor(driver);
      await deny('select public.get_contract_agreement($1)',[contract],/access|assigned/i);
      ok((await q('select public.get_my_agreement_history() history'))[0].history.length,1,'removed signer retains own receipt');
      ok((await q('select * from public.contracts where id=$1',[contract])).length,0,'receipt does not restore contract');
      await actor(admin);
      const [returnPreview]=await q("select public.preview_agreement_change('assign',$1::jsonb) result",[JSON.stringify(payload)]);
      await q("select public.commit_agreement_change('assign',$1::jsonb,$2)",[JSON.stringify(payload),returnPreview.result.token]);
      ok((await q('select public.get_contract_agreement($1) result',[contract]))[0].result.signatures.length,0,'return does not reactivate historical acceptance');
      const edit={show_id:payload.show_ids[0],contract_id:contract,name:'  Synthetic Show  ',starts_on:'2026-11-01',ends_on:'2026-11-03',city:' Denver ',state:null,address:null,bin_count:null,lodging_included:false,per_diem:'0',kind:'setup',service_date:'2026-11-01',service_time:null,contract_pay:'0',bonus_pay:null,terms:'Updated full terms\nLine two',template_id:'30000000-0000-0000-0000-000000000001',driver_ids:[driver],external_names:null};
      await q("update public.checklist_templates set active=false where id='30000000-0000-0000-0000-000000000001'");
      const [edited]=await q("select public.preview_agreement_change('show',$1::jsonb) result",[JSON.stringify(edit)]);
      const expected=edited.result.resulting_content.find(x=>x.contract_id===contract).content;
      ok(expected.work.city,'Denver','preview uses committed trimming');
      await q("select public.commit_agreement_change('show',$1::jsonb,$2)",[JSON.stringify(edit),edited.result.token]);
      ok((await q('select public.get_contract_agreement($1) result',[contract]))[0].result.version.content,expected,'exact preview and issued content equality');
      await q("select public.commit_agreement_change('show',$1::jsonb,$2)",[JSON.stringify(edit),edited.result.token]); checks++;
      await q('select public.admin_save_show_contract($1::jsonb)',[JSON.stringify({...edit,lodging_name:'Changed hotel',lodging_check_in:'2026-10-31'})]); checks++;
      const changed={...edit,contract_pay:'350'};
      const [stale]=await q("select public.preview_agreement_change('show',$1::jsonb) result",[JSON.stringify(changed)]);
      const [rosterPreview]=await q("select public.preview_agreement_change('assign',$1::jsonb) result",[JSON.stringify({...payload,driver_ids:[driver,other]})]);
      await q("select public.commit_agreement_change('assign',$1::jsonb,$2)",[JSON.stringify({...payload,driver_ids:[driver,other]}),rosterPreview.result.token]);
      await deny("select public.commit_agreement_change('show',$1::jsonb,$2)",[JSON.stringify(changed),stale.result.token],/stale/i);
      ok((await q('select contract_pay from public.contracts where id=$1',[contract]))[0].contract_pay,'0.00','stale preview does not partially update');
      const template={template_id:edit.template_id,name:'Updated checklist',kind:'setup',sections:[{id:'40000000-0000-0000-0000-000000000001',title:'Load',items:[{id:'50000000-0000-0000-0000-000000000001',title:'Check all supplies',photo_required:true}]}]};
      await deny("select public.admin_replace_checklist_template($1,'Updated checklist','setup',$2::jsonb)",[edit.template_id,JSON.stringify(template.sections)],/confirmation|review/i);
      await deny("update public.checklist_items set title='Silent change' where id='50000000-0000-0000-0000-000000000001'",[],/review/i);
      const [templatePreview]=await q("select public.preview_agreement_change('template',$1::jsonb) result",[JSON.stringify(template)]);
      await q("select public.commit_agreement_change('template',$1::jsonb,$2)",[JSON.stringify(template),templatePreview.result.token]);
      ok((await q("select id,completed from public.checklist_responses where item_id='50000000-0000-0000-0000-000000000001'"))[0],{id:'70000000-0000-0000-0000-000000000001',completed:true},'template edit retains real response ID and progress');
      const [item]=await q("select required,photo_required,instructions from public.checklist_items where id='50000000-0000-0000-0000-000000000001'");
      ok(item,{required:true,photo_required:true,instructions:'Exact instruction'},'template preserves flags and instruction when omitted');
    }
  }
  console.log(`Agreement stage ${migrationLimit}: ${checks} PostgreSQL checks passed (synthetic, single-session PGlite).`);
} finally { await db.close(); }
