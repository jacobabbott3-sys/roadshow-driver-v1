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
  for (const file of (await readdir(dir)).sort()) {
    if (file.startsWith('20261007') && Number(file.slice(11,12)) > Number(migrationLimit)) continue;
    // PGlite supplies gen_random_uuid natively; pgcrypto is unavailable here.
    const sql = (await readFile(new URL(file, dir), 'utf8')).replace('create extension if not exists pgcrypto;', '');
    try { await db.exec(sql); } catch (error) { throw new Error(`${file}: ${error.message}`); }
  }
  await db.exec(await readFile(new URL('../supabase/tests/agreement-data.sql', import.meta.url), 'utf8'));
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
  await q('select roadshow_private.begin_agreement_change()');
  await deny("update public.contracts set current_agreement_id=$1 where id='10000000-0000-0000-0000-000000000002'",[v.id],/foreign key/i);
  await q('select roadshow_private.end_agreement_change()');
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
  }
  console.log(`Agreement stage ${migrationLimit}: ${checks} PostgreSQL checks passed (synthetic, single-session PGlite).`);
} finally { await db.close(); }
