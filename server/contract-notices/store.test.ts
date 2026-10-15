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
