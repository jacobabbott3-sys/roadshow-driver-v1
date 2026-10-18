import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService, type AccountPorts, type AccountPolicy, type Result } from './adminAccounts.ts';

function fixture() {
  const records = new Map<string, {fingerprint:string; scope:string; state:string; response?:Result}>();
  const calls: string[] = [];
  const ports: AccountPorts = {
    projectId:'synthetic-beta',
    verifySession:async () => ({id:'admin'}),
    getProfile:async id => ({id,role:'admin',active:true}),
    listAccounts:async () => ({accounts:[{id:'driver',email:'test@example.test',fullName:'Test Driver',role:'driver',active:true,invitedAt:'2026-10-15',confirmedAt:null}],nextCursor:null}),
    getAccount:async () => ({id:'driver',email:'test@example.test',fullName:'Test Driver',role:'driver',active:true,invitedAt:'2026-10-15',confirmedAt:null}),
    allowRequest:async () => true,
    claim:async (actor,key,fingerprint,scope) => {
      const id = `${actor}:${key}`;
      const record = records.get(id);
      if (record && record.fingerprint !== fingerprint) return {kind:'conflict'};
      if (record?.state === 'complete') return {kind:'replay',result:record.response!};
      if (record?.state === 'uncertain') return {kind:'uncertain'};
      if ([...records.values()].some(item => item.scope === scope && ['pending','uncertain'].includes(item.state))) return {kind:'busy'};
      records.set(id,{fingerprint,scope,state:'pending'});
      return {kind:'acquired'};
    },
    finish:async (actor,key,response,state) => {Object.assign(records.get(`${actor}:${key}`)!, {response,state});},
    perform:async (command,key) => {calls.push(JSON.stringify({command,key})); return {kind:'accepted'};},
  };
  const policy: AccountPolicy = {enabled:true,deliveryEnabled:true,approvedBetaProjectId:'synthetic-beta',testRecipients:['test@example.test']};
  return {ports,policy,calls,records,run:() => createAccountService(ports,policy)};
}
const create = {action:'create', requestId:'request_123456789',email:'test@example.test',fullName:'Test Driver'};
test('default-off performs no authorization, account or email operations', async () => {
  const f=fixture(); f.ports.verifySession=async () => {throw Error('must not be invoked');};
  assert.equal((await createAccountService(f.ports)('token',create)).status,503); assert.equal(f.calls.length,0);
});
test('blocks mismatched backend and known production even if explicitly configured', async () => {
  for (const id of ['another-project','myraoovepjwhkafzdppq']) {
    const f=fixture(); f.ports.projectId=id;
    if (id.startsWith('myrao')) f.policy.approvedBetaProjectId=id;
    assert.equal((await f.run()('token',create)).status,503); assert.equal(f.calls.length,0);
  }
});
test('denies anonymous, expired, driver, inactive and mismatched-profile sessions', async () => {
  for (const mode of ['anonymous','expired','driver','inactive','mismatch']) {
    const f=fixture();
    if(mode==='expired') f.ports.verifySession=async()=>null;
    if(['driver','inactive','mismatch'].includes(mode)) f.ports.getProfile=async()=>({id:mode==='mismatch'?'other':'admin',role:mode==='driver'?'driver':'admin',active:mode!=='inactive'});
    assert.equal((await f.run()(mode==='anonymous'?'':'token',create)).status,['anonymous','expired'].includes(mode)?401:403);
    assert.equal(f.calls.length,0);
  }
});
test('lists minimal status independent of activity and rejects invalid pagination',async()=>{
  const f=fixture(); const page=await f.ports.listAccounts(25,null);
  f.ports.listAccounts=async()=>({...page,accounts:page.accounts.map(a=>({...a,active:false,confirmedAt:'2026-10-15',secret:'never-return'}))});
  const response=await f.run()('token',{action:'list',limit:25});
  assert.deepEqual(response.body.accounts,[{id:'driver',email:'test@example.test',fullName:'Test Driver',role:'driver',active:false,invitationStatus:'confirmed',emailDeliveryStatus:'unknown'}]);
  for(const limit of [0,51,1.5,'25']) assert.equal((await f.run()('token',{action:'list',limit})).status,400);
});
test('creation defaults to driver, uses a fixed beta callback and rejects injected fields',async()=>{
  const f=fixture(); const run=f.run();
  for(const field of ['role','redirectTo','metadata']) assert.equal((await run('token',{...create,[field]:'admin'})).status,400);
  assert.equal((await run('token',create)).status,202);
  const sent=JSON.parse(f.calls[0]); assert.equal(sent.command.role,'driver');assert.equal(sent.command.redirectTo,'https://beta.roadshowdriver.com/update-password');
});
test('mail gate and exact test recipient allowlist fail closed',async()=>{
  const f=fixture();f.policy.deliveryEnabled=false;
  assert.equal((await f.run()('token',create)).status,503);
  f.policy.deliveryEnabled=true;
  for(const email of ['accounting@havenlight.com','test@example.test.evil','bad']) assert.notEqual((await f.run()('token',{...create,email})).status,202);
  assert.equal(f.calls.length,0);
});
test('resend and recovery resolve recipient server-side and cannot receive arbitrary redirects',async()=>{
  for(const action of ['resend','recover']) {
    const f=fixture(); assert.equal((await f.run()('token',{action,requestId:create.requestId,userId:'driver'})).status,202);
    const command=JSON.parse(f.calls[0]).command;
    assert.equal(command.email,'test@example.test');assert.equal(command.redirectTo,'https://beta.roadshowdriver.com/update-password');
  }
});
test('confirmed invitation resend and inactive account email are denied',async()=>{
  for(const active of [true,false]) {
    const f=fixture(); const account=await f.ports.getAccount('driver');f.ports.getAccount=async()=>({...account!,active,confirmedAt:'2026-10-15'});
    assert.equal((await f.run()('token',{action:'resend',requestId:create.requestId,userId:'driver'})).status,409);assert.equal(f.calls.length,0);
  }
});
test('replays completed request, rejects changed payload and serializes pending recipient operations',async()=>{
  const f=fixture(); const run=f.run();
  const first=await run('token',create);assert.deepEqual(await run('token',create),first);assert.equal(f.calls.length,1);
  assert.equal((await run('token',{...create,fullName:'Changed'})).status,409);
  let release!:()=>void;
  f.ports.perform=async()=>{await new Promise<void>(resolve=>{release=resolve;});return {kind:'accepted'};};
  const pending=run('token',{...create,requestId:'request_pending_1'});
  while(!release) await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal((await run('token',{...create,requestId:'request_pending_2'})).status,409);
  release();await pending;
});
test('rechecks admin authorization after acquiring request before performing action',async()=>{
  const f=fixture();let checks=0;f.ports.getProfile=async id=>({id,role:'admin',active:++checks===1});
  assert.equal((await f.run()('token',create)).status,403);assert.equal(f.calls.length,0);
});
test('rate limiting denies before side effects',async()=>{
  const f=fixture();f.ports.allowRequest=async()=>false;
  assert.equal((await f.run()('token',create)).status,429);assert.equal(f.records.size,0);
});
test('accepted request never claims delivery',async()=>{
  const f=fixture();assert.deepEqual((await f.run()('token',create)).body,{requestId:create.requestId,emailRequestStatus:'accepted',emailDeliveryStatus:'unknown'});
});
test('explicit transient rejection permits same-key retry; ambiguous failure requires reconciliation',async()=>{
  const f=fixture(); let attempts=0;
  f.ports.perform=async()=> ++attempts===1?{kind:'rejected',retryable:true}:{kind:'accepted'};
  const run=f.run();assert.equal((await run('token',create)).status,503);assert.equal((await run('token',create)).status,202);assert.equal(attempts,2);
  const g=fixture();let unknownAttempts=0;g.ports.perform=async()=>{unknownAttempts++;throw Error('private provider details');};
  const unknown=g.run();assert.equal((await unknown('token',create)).status,409);assert.equal((await unknown('token',create)).status,409);
  assert.equal((await unknown('token',{...create,requestId:'request_new_123456'})).status,409);assert.equal(unknownAttempts,1);
});
test('durable-store failure never returns success or retries the provider',async()=>{
  const f=fixture();f.ports.finish=async()=>{throw Error('private db detail');};
  const run=f.run();const response=await run('token',create);assert.equal(response.status,503);assert.ok(!JSON.stringify(response).includes('private'));
  assert.equal((await run('token',create)).status,409);assert.equal(f.calls.length,1);
});
test('rejects changed email or inactive target after request claim',async()=>{
  for(const change of ['email','active','confirmed']) {
    const f=fixture();const initial=await f.ports.getAccount('driver');let reads=0;
    f.ports.getAccount=async()=>++reads===1?initial:{...initial!,...(change==='email'?{email:'real@example.test'}:change==='active'?{active:false}:{confirmedAt:'2026-10-15'})};
    assert.equal((await f.run()('token',{action:'resend',requestId:create.requestId,userId:'driver'})).status,409);
    assert.equal(f.calls.length,0);
  }
});
test('terminal provider rejection is replayed without another delivery attempt',async()=>{
  const f=fixture();let attempts=0;f.ports.perform=async()=>{attempts++;return {kind:'rejected',retryable:false};};
  const run=f.run();assert.equal((await run('token',create)).status,503);assert.equal((await run('token',create)).status,503);assert.equal(attempts,1);
});
