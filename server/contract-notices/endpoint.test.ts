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
 assert.equal((await response.json()).message,'Email sending is disabled for this review. Nothing was sent or queued.');
});
test('ordinary fixture snapshot is rejected unless it is exactly pinned and still unpublished and isolated',async()=>{
 const actor='00000000-0000-4000-8000-000000000001', contract='00000000-0000-4000-8000-000000000002', version='00000000-0000-4000-8000-000000000003', show='00000000-0000-4000-8000-000000000004';
 const title='[BETA TEST] Nonbinding signed email delivery check';
 const pin={actorId:actor,contractId:contract,versionId:version,expiresAt:Date.now()+60_000,bodyDigest:'a'.repeat(64),attachmentDigest:'b'.repeat(64),evidenceFingerprint:'c'.repeat(64)};
 const base={
  contracts:{id:contract,show_id:show,driver_id:actor,current_agreement_id:version,cancelled_at:null},
  agreement_versions:{id:version,version_number:1,content:{work:{id:show,name:title},contract:{document_path:null},linked_work:[],linked_show_ids:[]}},
  agreement_signatures:[{id:'d',signer_role:'driver',signer_id:actor,assignment_period_id:'open',version_id:version},{id:'a',signer_role:'admin',signer_id:actor,version_id:version}],
  agreement_assignment_periods:{id:'open'},contract_drivers:{driver_id:actor},shows:{name:title,is_test:false,test_owner:null,created_by:null,cancelled_at:null},
 };
 function fixture(changed:Record<string,unknown>={},binding:typeof pin|null=pin) {
  const values:Record<string,unknown>={...base,...changed};
  const client={
   from:(table:string)=>{
    const result=()=>({data:values[table]??[],error:null});
    const query={select(){return query;},eq(){return query;},neq(){return query;},is(){return query;},limit:async()=>({data:values[table+'_rows']??[],error:null}),
      single:async()=>result(),maybeSingle:async()=>result(),then:(resolve:(value:ReturnType<typeof result>)=>unknown)=>Promise.resolve(resolve(result()))};
    return query;
   },
  };
  return createNoticePorts(client as unknown as ReturnType<typeof createClient>,
   {enabled:true,mailEnabled:false,testRecipient:'shipping@havenlight.com'},
   {projectId:'exsquwjtqnirojntoxqv',approvedProjectId:'exsquwjtqnirojntoxqv',apiKey:'',from:''},async()=>{throw Error('must not call provider');},binding);
 }
 assert.equal((await fixture().snapshot(contract)).testOwner,actor);
 await assert.rejects(fixture({},null).snapshot(contract),/pinned fictional fixture/);
 await assert.rejects(fixture({}, {...pin,versionId:show}).snapshot(contract),/pinned fictional fixture/);
 for(const table of ['availability_release_item_shows','contract_drivers','contract_external_assignees'])
  await assert.rejects(fixture({[table+'_rows']:[{id:'other'}]}).snapshot(contract),/outside the test/);
 for(const changed of [{shows:{...base.shows,created_by:show}},{shows:{...base.shows,name:'ordinary'}},
   {agreement_signatures:[...base.agreement_signatures.slice(0,1),{...base.agreement_signatures[1],signer_id:show}]}])
  await assert.rejects(fixture(changed).snapshot(contract),/pinned fictional fixture/);
});
test('scoped delivery uses separate To values and rejects an unreviewed address', async()=>{
 const client=createClient('https://exsquwjtqnirojntoxqv.supabase.co','mock-key',{auth:{persistSession:false}});
 const actorId='00000000-0000-4000-8000-000000000001', contractId='00000000-0000-4000-8000-000000000002', versionId='00000000-0000-4000-8000-000000000003';
 const list=['a@example.test','b@example.test'], calls:RequestInit[]=[];
 const n=await buildNotice({contractId,currentVersionId:versionId,versionId,versionNumber:1,testOwner:actorId,contents:{work:{name:'Fictional',per_diem:null},contract:{contract_pay:25.05}},cancelled:false,driverEligible:true,
 signatures:[{id:'a',versionId,role:'admin',name:'Fictional Admin',signedAt:'now'},{id:'d',versionId,role:'driver',name:'Fictional Driver',signedAt:'now'}]},
 {recipients:list,revision:0},'shipping@havenlight.com','approved-fixture-settings');
 const pin={actorId,contractId,versionId,evidenceFingerprint:n.evidenceFingerprint!,attachmentDigest:n.attachmentDigest,bodyDigest:'a'.repeat(64),expiresAt:Date.now()+60000};
 const p=createNoticePorts(client,{enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com',deliveryMode:'approved-fixture-settings',permitsTest:async(_n,id)=>id===actorId},
 {projectId:'exsquwjtqnirojntoxqv',approvedProjectId:'exsquwjtqnirojntoxqv',apiKey:'mock-key',from:'sender@example.test'},
 async(_url,request)=>{calls.push(request!);return new Response('{}',{status:200});},pin);
 await assert.rejects(p.send(n,'other@example.test',n.attachment,actorId),/Mail disabled/);
 await assert.rejects(p.send(n,list[0],n.attachment,'wrong actor'),/Mail disabled/);
 for(const address of list) await p.send(n,address,n.attachment,actorId);
 assert.equal(calls.length,2);
 for(const [ix,call] of calls.entries()){
  const body=JSON.parse(String(call.body));assert.deepEqual(body.to,[list[ix]]);assert.notEqual((calls[0].headers as Record<string,string>)['Idempotency-Key'],(calls[1].headers as Record<string,string>)['Idempotency-Key']);
  assert.equal(body.text,n.message);assert.equal(body.attachments[0].content,n.attachment); assert.ok(!Object.hasOwn(body,'cc')&&!Object.hasOwn(body,'bcc'));
 }
});
test('scoped ledger freezes the lifetime recipient set, permits identical retry and vetoes prior Shipping history',async()=>{
 const rows: Array<Record<string,string>>=[];
 const fake={
  from:()=>{
   const equals:Record<string,string>={},not:Record<string,string>={};let patch:Record<string,string>|null=null;
   const matching=()=>rows.filter(row=>Object.entries(equals).every(([k,v])=>row[k]===v)&&Object.entries(not).every(([k,v])=>row[k]!==v));
   const q={select:()=>{if(patch) return Promise.resolve({data:matching().map(row=>Object.assign(row,patch)),error:null});return q;},
    eq:(key:string,value:string)=>{equals[key]=value;return q;},
    neq:(key:string,value:string)=>{not[key]=value;return q;},
    limit:async(count:number)=>({data:matching().slice(0,count),error:null}),
    maybeSingle:async()=>({data:matching()[0]??null,error:null}),
    update:(values:Record<string,string>)=>{patch=values;return q;},
    insert:async(row:Record<string,string>)=>{
      const duplicate=rows.some(x=>x.environment_scope===row.environment_scope&&x.version_id===row.version_id&&x.recipient===row.recipient);
      if(!duplicate) rows.push({...row});
      return {error:duplicate?{code:'23505'}:null};
    },
   }; return q;
  },
 };
 const client=fake as unknown as ReturnType<typeof createClient>;
 const make=(pin?:import('./singleTestPin.ts').SingleTestPin)=>createNoticePorts(client,{enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com',deliveryMode:'approved-fixture-settings'},
  {projectId:'exsquwjtqnirojntoxqv',approvedProjectId:'exsquwjtqnirojntoxqv',apiKey:'fake',from:'sender@example.test'},async()=>{throw Error('must not call provider');},pin);
 const p=make();
 const n={contractId:'c',versionId:'v',versionNumber:1,recipients:['a@example.test','b@example.test'],testRecipient:'shipping@havenlight.com',
  deliveryMode:'approved-fixture-settings' as const,subject:'Fictional',message:'Canonical',attachmentName:'fixture.pdf',attachmentDigest:'digest',fingerprint:'fingerprint'};
 assert.equal(await p.claimDelivery(n,n.recipients[0]),'acquired');
 await p.finishDelivery(n,n.recipients[0],'accepted');
 assert.equal(await p.claimDelivery(n,n.recipients[0]),'accepted');
 assert.equal(await p.claimDelivery({...n,recipients:['c@example.test']},'c@example.test'),'blocked');
 assert.equal(await p.claimDelivery(n,n.recipients[1]),'acquired');
 await p.finishDelivery(n,n.recipients[1],'rejected');
 assert.equal(await p.claimDelivery(n,n.recipients[1]),'acquired');
 const other={...n,versionId:'old'};
 rows.push({environment_scope:'test:shipping@havenlight.com',version_id:'old',recipient:'shipping@havenlight.com',payload_hash:'known',state:'accepted'});
 assert.equal(await p.claimDelivery(other,other.recipients[0]),'blocked');
 assert.equal(rows.filter(x=>x.version_id==='old').length,1);
 const reuse=make({actorId:'a',contractId:'c',versionId:'old',evidenceFingerprint:'x',attachmentDigest:'y',bodyDigest:'z',expiresAt:Date.now()+60000,allowPriorShippingAccepted:true});
 assert.equal(await reuse.claimDelivery({...other,recipients:['a@example.test','shipping@havenlight.com']},'a@example.test'),'blocked');
 assert.equal(await reuse.claimDelivery(other,other.recipients[0]),'acquired');
 const prior=rows.find(x=>x.version_id==='old'&&x.environment_scope==='test:shipping@havenlight.com')!;
 prior.state='uncertain';
 assert.equal(await reuse.claimDelivery(other,other.recipients[1]),'blocked');
 prior.state='accepted';
 rows.push({...prior,recipient:'unexpected@example.test'});
 assert.equal(await reuse.claimDelivery(other,other.recipients[1]),'blocked');
});
