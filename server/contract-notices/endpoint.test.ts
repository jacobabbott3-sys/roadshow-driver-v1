import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContractNoticeEndpoint } from './endpoint.ts';
import { createNoticePorts } from './adapter.ts';
import { buildNotice } from './service.ts';
import { createClient } from '@supabase/supabase-js';
test('endpoint defaults off, rejects preview origins and production before client construction',async()=>{
 for(const [origin,env,status] of [ ['https://preview.example.com',{},403],['https://beta.roadshowdriver.com',{},503],['https://beta.roadshowdriver.com',{CONTRACT_NOTICE_ENABLED:'true',CONTRACT_NOTICE_BETA_PROJECT_ID:'myraoovepjwhkafzdppq',SUPABASE_URL:'https://myraoovepjwhkafzdppq.supabase.co'},503] ] as const){
 const endpoint=createContractNoticeEndpoint(n=>(env as Record<string,string>)[n],()=>{throw Error('must not construct');});const result=await endpoint(new Request('https://example.com',{method:'POST',headers:{origin}}));assert.equal(result.status,status);
 }
});
test('adapter payload always goes only to separate test inbox with stable idempotency key',async()=>{
 const requests:RequestInit[]=[];const client=createClient('https://abcdefghijklmnopqrst.supabase.co','mock-key',{auth:{persistSession:false}});
 const p=createNoticePorts(client,{enabled:true,mailEnabled:true,testRecipient:'test@example.net'},{projectId:'abcdefghijklmnopqrst',approvedProjectId:'abcdefghijklmnopqrst',apiKey:'mock-key',from:'test@example.net'},async(_url,init)=>{requests.push(init!);return new Response('{}',{status:200});});
 const notice=await buildNotice({contractId:'c',currentVersionId:'v',versionId:'v',versionNumber:1,workLabel:'Test',cancelled:false,driverEligible:true,signatures:[{id:'a',versionId:'v',role:'admin',name:'A',signedAt:'now'},{id:'d',versionId:'v',role:'driver',name:'D',signedAt:'now'}]},[],'test@example.net');
 await p.send(notice,'accounting@havenlight.com');await p.send(notice,'accounting@havenlight.com');assert.deepEqual(JSON.parse(String(requests[0].body)).to,['test@example.net']);assert.equal((requests[0].headers as Record<string,string>)['Idempotency-Key'],(requests[1].headers as Record<string,string>)['Idempotency-Key']);
 await assert.rejects(p.send({...notice,testRecipient:'accounting@havenlight.com'},'accounting@havenlight.com'));assert.equal(requests.length,2);
});
