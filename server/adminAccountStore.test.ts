import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('proposed request-store constraints block duplicates, uncertain recipient bypass and browser access',async()=>{
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    await db.exec(readFileSync(new URL('./adminAccountStore.sql',import.meta.url),'utf8'));
    const actor='11111111-1111-4111-8111-111111111111';const other='22222222-2222-4222-8222-222222222222';
    const insert=(id:string,key:string,recipient:string,bucket:string)=>db.query("insert into public.admin_account_operations(actor_id,request_id,fingerprint,recipient,state,minute_bucket) values($1,$2,'fp',$3,'pending',$4)",[id,key,recipient,bucket]);
    await insert(actor,'one','test@example.test','2026-10-15T12:00:00Z');
    await assert.rejects(()=>insert(actor,'one','other@example.test','2026-10-15T12:01:00Z'));
    await assert.rejects(()=>insert(actor,'two','other@example.test','2026-10-15T12:00:00Z'));
    await assert.rejects(()=>insert(other,'two','test@example.test','2026-10-15T12:01:00Z'));
    await db.exec("update public.admin_account_operations set state='uncertain';");
    await assert.rejects(()=>insert(other,'three','test@example.test','2026-10-16T12:00:00Z'));
    await db.exec('set role authenticated;');
    await assert.rejects(()=>db.query('select * from public.admin_account_operations'));
    await db.exec('reset role;');
    const {rows}=await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where relname='admin_account_operations'");
    assert.equal(rows[0].relrowsecurity,true);
  } finally {await db.close();}
});
