import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('disposable ledger enforces unique delivery and denies browser roles',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated;');
 await db.exec(await readFile(new URL('./store-proposal.sql',import.meta.url),'utf8'));
 const insert="insert into contract_notice_deliveries values ('test:inbox','00000000-0000-4000-8000-000000000001','admin@example.com','hash','pending',now())";
 await db.exec(insert);await assert.rejects(db.exec(insert),/duplicate key/);
 const claim=await db.query("update contract_notice_deliveries set state='accepted' where state='pending' returning recipient");assert.equal(claim.rows.length,1);
 const second=await db.query("update contract_notice_deliveries set state='accepted' where state='pending' returning recipient");assert.equal(second.rows.length,0);
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select * from contract_notice_deliveries'),/permission denied/);await assert.rejects(db.query('select * from contract_notice_reviews'),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();}
});
test('settings proposal keeps admin updates atomic, metadata-only and inaccessible to browser roles',async()=>{
 const db=new PGlite();
 try {
   await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
     create table profiles(id uuid primary key, role text, is_active boolean);
     insert into profiles values ('00000000-0000-4000-8000-000000000001','admin',true),
       ('00000000-0000-4000-8000-000000000002','driver',true),
       ('00000000-0000-4000-8000-000000000003','admin',false)`);
   await db.exec(await readFile(new URL('./settings-proposal.sql',import.meta.url),'utf8'));
   const good="select save_contract_notice_settings(0,array['finance@example.net'],'00000000-0000-4000-8000-000000000001') as revision";
   await db.exec('set role authenticated');
   await assert.rejects(db.query('select * from contract_notice_settings'),/permission denied/);
   await assert.rejects(db.query(good),/permission denied/);
   await db.exec('set role service_role');
   const current=await db.query('select recipients, revision from contract_notice_settings');
   assert.deepEqual(current.rows,[{recipients:['accounting@havenlight.com'],revision:0}]);
   await assert.rejects(db.query(good.replace(/001/g,'002')),/Active administrator required/);
   await assert.rejects(db.query(good.replace(/001/g,'003')),/Active administrator required/);
   assert.deepEqual((await db.query(good)).rows,[{revision:1}]);
   assert.deepEqual((await db.query(good)).rows,[{revision:null}]);
   await assert.rejects(db.query('select * from contract_notice_settings_audit'),/permission denied/);
   await db.exec('reset role');
   const audit=await db.query('select revision, actor_id, recipient_count from contract_notice_settings_audit');
   assert.deepEqual(audit.rows,[{revision:1,actor_id:'00000000-0000-4000-8000-000000000001',recipient_count:1}]);
 } finally { await db.close(); }
});
