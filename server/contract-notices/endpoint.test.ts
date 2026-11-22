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
test('adapter payload always goes only to approved shipping inbox with stable idempotency key',async()=>{
 const requests:RequestInit[]=[];const client=createClient('https://abcdefghijklmnopqrst.supabase.co','mock-key',{auth:{persistSession:false}});
 const p=createNoticePorts(client,{enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com'},{projectId:'abcdefghijklmnopqrst',approvedProjectId:'abcdefghijklmnopqrst',apiKey:'mock-key',from:'shipping@havenlight.com'},async(_url,init)=>{requests.push(init!);return new Response('{}',{status:200});});
 const notice=await buildNotice({contractId:'c',currentVersionId:'v',versionId:'v',versionNumber:1,testOwner:'actor',contents:{work:{name:'Test',per_diem:null},contract:{contract_pay:25.05}},cancelled:false,driverEligible:true,signatures:[{id:'a',versionId:'v',role:'admin',name:'A',signedAt:'now'},{id:'d',versionId:'v',role:'driver',name:'D',signedAt:'now'}]},{recipients:['manager@example.com','accounting@havenlight.com'],revision:0},'shipping@havenlight.com');
 await p.send(notice,'shipping@havenlight.com',notice.attachment);await p.send(notice,'shipping@havenlight.com',notice.attachment);assert.deepEqual(JSON.parse(String(requests[0].body)).to,['shipping@havenlight.com']);assert.equal((requests[0].headers as Record<string,string>)['Idempotency-Key'],(requests[1].headers as Record<string,string>)['Idempotency-Key']);
 await assert.rejects(p.send({...notice,testRecipient:'accounting@havenlight.com'},'shipping@havenlight.com',notice.attachment));assert.equal(requests.length,2);
 const edited='  Hello José,\n\n<literal>  ';
 await p.send({...notice,message:edited},'shipping@havenlight.com',notice.attachment);assert.deepEqual(JSON.parse(String(requests[2].body)).to,['shipping@havenlight.com']);
 assert.equal(Object.hasOwn(JSON.parse(String(requests[2].body)),'cc'),false);assert.equal(Object.hasOwn(JSON.parse(String(requests[2].body)),'bcc'),false);
 for(const inbox of ['other@example.com','accounting@havenlight.com']) {
  const wrong=createNoticePorts(client,{enabled:true,mailEnabled:true,testRecipient:inbox},{projectId:'abcdefghijklmnopqrst',approvedProjectId:'abcdefghijklmnopqrst',apiKey:'mock-key',from:'sender@example.net'},async()=>{throw Error('must not contact provider');});
  await assert.rejects(wrong.send({...notice,testRecipient:inbox},'shipping@havenlight.com',notice.attachment),/Mail disabled/);
 }
 const parsed=JSON.parse(String(requests[2].body));assert.equal(parsed.text,edited);assert.ok(!Object.hasOwn(parsed,'html'));
 assert.equal(JSON.parse(String(requests[0].body)).text,'Driver: D\nContract: Test\nSigned base pay: $25.05\nSigned per diem: Not specified');
 assert.equal(parsed.attachments[0].filename,'signed-agreement-receipt.pdf');
 assert.match(atob(parsed.attachments[0].content),/^%PDF-/);
 await assert.rejects(p.send(notice,'accounting@havenlight.com',notice.attachment),/Mail disabled/);
 await assert.rejects(p.send(notice,'shipping@havenlight.com','tampered'),/Mail disabled/);
 assert.equal(requests.length,3);
});
test('deployed endpoint refuses provider delivery even when the existing mail flag is true',async()=>{
 const actor='00000000-0000-4000-8000-000000000001';
 const token='header.'+btoa(JSON.stringify({sub:actor,role:'authenticated',session_id:'00000000-0000-4000-8000-000000000002'}))+'.signature';
 const env:Record<string,string>={
  CONTRACT_NOTICE_BETA_PROJECT_ID:'exsquwjtqnirojntoxqv',SUPABASE_URL:'https://exsquwjtqnirojntoxqv.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake',
  CONTRACT_NOTICE_ENABLED:'true',CONTRACT_NOTICE_MAIL_ENABLED:'true',CONTRACT_NOTICE_TEST_INBOX:'shipping@havenlight.com',
 };
 const fake={
  auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},
  from:(table:string)=>({
   select:()=>({eq:()=>({maybeSingle:async()=>{
    if(table==='profiles')return {data:{id:actor,is_active:true,role:'admin'},error:null};
    if(table==='contract_notice_reviews')return {data:{id:'review',actor_id:actor,expires_at:Date.now()+60_000,notice:{},state:'reviewed'},error:null};
    throw Error('Unexpected read');
   }})}),
  }),
 };
 const endpoint=createContractNoticeEndpoint(n=>env[n],()=>fake as unknown as ReturnType<typeof createClient>,async()=>{throw Error('must not call provider');});
 const response=await endpoint(new Request('https://example.com',{method:'POST',headers:{origin:'https://beta.roadshowdriver.com',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action:'send',reviewId:'review',confirmed:true})}));
 assert.equal(response.status,503);
 assert.equal((await response.json()).message,'Email sending is disabled. Nothing was sent or queued.');
});
