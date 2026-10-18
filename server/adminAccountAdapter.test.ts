import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAccountPorts } from './adminAccountAdapter.ts';
import { createAccountEndpoint } from './adminAccountEndpoint.ts';
import type { AccountPolicy } from './adminAccounts.ts';
const projectId = 'abcdefghijklmnopqrst';
const policy: AccountPolicy = { enabled: true, deliveryEnabled: true, approvedBetaProjectId: projectId, testRecipients: ['test@example.test'] };
const user = { id: '11111111-1111-4111-8111-111111111111', email:'test@example.test', invited_at:'2026-10-15', user_metadata:{private:'not returned'}, role:'authenticated' };
const command = { action:'create' as const,email:'test@example.test',fullName:'Test Driver',role:'driver' as const,redirectTo:'https://beta.roadshowdriver.com/update-password' };
function fixture() {
  const calls: { url: URL; method: string; body: Record<string, unknown> | null; headers: Headers }[]=[];
  let providerStatus=200;let existing=false;let insertError=false;
  let row: Record<string,unknown>|null=null;
  const fetcher:typeof fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    const method=init?.method??'GET';const body=init?.body?JSON.parse(String(init.body)):null;
    calls.push({url,method,body,headers:new Headers(init?.headers)});
    const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
    if(url.hostname==='api.resend.com')return json(providerStatus===200?{id:'synthetic-mail'}:{message:'private'},providerStatus);
    if(url.pathname.endsWith('/admin/generate_link'))return json({...user,hashed_token:'synthetic-token',verification_type:'invite'});
    if(url.pathname.endsWith('/admin/users'))return method==='POST' ? (existing ? json({code:'email_exists',msg:'exists'},422) : json(user)) : json({users:existing?[user]:[]});
    if(url.pathname.endsWith(`/admin/users/${user.id}`)||url.pathname.endsWith('/user'))return json(user);
    if(url.pathname.endsWith('/profiles'))return json({id:user.id,full_name:'Test Driver',role:'driver',is_active:true});
    if(url.pathname.endsWith('/admin_account_operations')) {
      if(method==='POST') { if(insertError||row)return json({code:'23505'},409); row={...body};return new Response(null,{status:201}); }
      if(method==='PATCH') {row={...row,...body};return json([{request_id:'request_123456789'}]);}
      return json(row);
    }
    throw new Error(`Unexpected synthetic request ${url.pathname}`);
  };
  const client=createClient(`https://${projectId}.supabase.co`,'synthetic-service-key',{global:{fetch:fetcher},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const ports=createSupabaseAccountPorts(client,policy,{projectId,resendKey:'synthetic-provider-key',from:'beta@example.test'},fetcher);
  return {calls,ports,client,fetcher,setStatus:(n:number)=>{providerStatus=n;},setExisting:()=>{existing=true;},setInsertError:()=>{insertError=true;}};
}
test('adapter generates a fixed token-hash invite and sends only to allowlisted recipient without returning secrets',async()=>{
  const f=fixture();const response=await f.ports.perform(command,'admin:request_123456789');
  assert.deepEqual(response,{kind:'accepted'});
  const generated=f.calls.find(call=>call.url.pathname.endsWith('/generate_link'))!;
  assert.deepEqual(generated.body?.data,{full_name:'Test Driver'});assert.equal(generated.body?.type,'invite');
  const sent=f.calls.find(call=>call.url.hostname==='api.resend.com')!;
  assert.deepEqual(sent.body?.to,['test@example.test']);assert.equal(sent.headers.get('idempotency-key'),'admin:request_123456789');
  assert.match(String(sent.body?.text),/https:\/\/beta\.roadshowdriver\.com\/auth\/confirm\?token_hash=synthetic-token&type=invite/);
  assert.ok(!JSON.stringify(response).includes('synthetic-token'));
  assert.ok(!f.calls.some(call=>call.url.pathname.endsWith('/invite')));
});
test('adapter independently blocks non-test recipients, production, disabled mail and caller redirects before network',async()=>{
  for(const change of ['recipient','production','disabled','redirect']){
    const f=fixture();const p={...policy,deliveryEnabled:change!=='disabled'};
    const ports=createSupabaseAccountPorts(f.client,p,{projectId:change==='production'?'myraoovepjwhkafzdppq':projectId,resendKey:'synthetic',from:'beta@example.test'},f.fetcher);
    await assert.rejects(()=>ports.perform({...command,...(change==='recipient'?{email:'accounting@havenlight.com'}:{}),...(change==='redirect'?{redirectTo:'https://evil.test'}:{})},'request'));
    assert.equal(f.calls.length,0);
  }
});
test('existing account creation is rejected without implicit resend',async()=>{
  const f=fixture();f.setExisting();assert.deepEqual(await f.ports.perform(command,'request'),{kind:'rejected',retryable:false});
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.ok(!f.calls.some(c=>c.url.pathname.endsWith('/generate_link')||c.url.hostname==='api.resend.com'));
});
test('recovery uses recovery token type; provider rejection and uncertain outcomes differ',async()=>{
  const f=fixture();const recovery={action:'recover' as const,userId:user.id,email:command.email,redirectTo:command.redirectTo};
  f.setStatus(422);assert.deepEqual(await f.ports.perform(recovery,'request'),{kind:'rejected',retryable:false});
  assert.equal(f.calls.find(c=>c.url.pathname.endsWith('/generate_link'))?.body?.type,'recovery');
  for(const status of [500,408,409]){f.setStatus(status);await assert.rejects(()=>f.ports.perform(recovery,'request'));}
});
test('durable adapter replay/conflict/pending handling uses atomic insert and compare-and-set finish',async()=>{
  const f=fixture();const args=[user.id,'request_123456789','fingerprint','test@example.test'] as const;
  assert.deepEqual(await f.ports.claim(...args),{kind:'acquired'});
  assert.deepEqual(await f.ports.claim(...args),{kind:'busy'});
  const response={status:202,body:{emailDeliveryStatus:'unknown'}};
  await f.ports.finish(user.id,args[1],response,'complete');
  assert.deepEqual(await f.ports.claim(...args),{kind:'replay',result:response});
  assert.deepEqual(await f.ports.claim(user.id,args[1],'changed',args[3]),{kind:'conflict'});
  assert.equal(f.calls.find(c=>c.method==='PATCH')?.url.searchParams.get('state'),'eq.pending');
});
test('minimal list maps profiles separately from Auth metadata',async()=>{
  const f=fixture();f.setExisting();const page=await f.ports.listAccounts(25,null);
  assert.equal(page.accounts[0].role,'driver');assert.equal(page.accounts[0].active,true);
  assert.ok(!JSON.stringify(page).includes('private'));assert.equal(page.nextCursor,null);
});
const request=(body:unknown,headers:Record<string,string>={})=>new Request('https://example.test/admin-accounts',{method:'POST',headers:{origin:'https://beta.roadshowdriver.com',authorization:'Bearer synthetic-token','content-type':'application/json',...headers},body:JSON.stringify(body)});
test('endpoint default-off and production mismatch create no privileged client',async()=>{
  let clients=0;
  for(const values of [{},{ACCOUNT_MANAGEMENT_ENABLED:'true',ACCOUNT_BETA_PROJECT_ID:projectId,SUPABASE_URL:'https://myraoovepjwhkafzdppq.supabase.co'}]){
    const endpoint=createAccountEndpoint(name=>(values as Record<string,string>)[name],()=>{clients++;throw Error('must not construct');});
    assert.equal((await endpoint(request({action:'list'}))).status,503);
  }
  assert.equal(clients,0);
});
test('HTTP boundary enforces exact origin, methods, token, JSON and body limit',async()=>{
  const values:Record<string,string>={ACCOUNT_MANAGEMENT_ENABLED:'true',ACCOUNT_BETA_PROJECT_ID:projectId,SUPABASE_URL:`https://${projectId}.supabase.co`,SUPABASE_SERVICE_ROLE_KEY:'synthetic'};
  let clients=0;const endpoint=createAccountEndpoint(name=>values[name],()=>{clients++;throw Error('must not construct');});
  assert.equal((await endpoint(request({},{origin:'https://evil.test'}))).status,403);
  assert.equal((await endpoint(new Request('https://example.test',{method:'GET',headers:{origin:'https://beta.roadshowdriver.com'}}))).status,405);
  assert.equal((await endpoint(request({},{authorization:''}))).status,401);
  assert.equal((await endpoint(request({},{'content-type':'text/plain'}))).status,415);
  assert.equal((await endpoint(request({large:'x'.repeat(5000)}))).status,413);
  assert.equal(clients,0);
});
test('endpoint sanitizes service errors and disables caching',async()=>{
  const values:Record<string,string>={ACCOUNT_MANAGEMENT_ENABLED:'true',ACCOUNT_BETA_PROJECT_ID:projectId,SUPABASE_URL:`https://${projectId}.supabase.co`,SUPABASE_SERVICE_ROLE_KEY:'synthetic'};
  const endpoint=createAccountEndpoint(name=>values[name],()=>{throw Error('secret-detail');});
  const response=await endpoint(request({action:'list'}));assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes('secret-detail'));
});
test('session adapter requires Auth-verified user and nonempty session identity',async()=>{
  const f=fixture();const token=(claims:unknown)=>`e30.${btoa(JSON.stringify(claims))}.synthetic-signature`;
  const claims={sub:user.id,role:'authenticated',session_id:'22222222-2222-4222-8222-222222222222'};
  assert.deepEqual(await f.ports.verifySession(token(claims)),{id:user.id});
  for(const changed of [{...claims,session_id:null},{...claims,sub:'other'},{...claims,role:'service_role'},{...claims,session_id:'00000000-0000-0000-0000-000000000000'}])assert.equal(await f.ports.verifySession(token(changed)),null);
});
