import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotice, createNoticeService, type Ports, type Review, type Snapshot } from './service.ts';
function harness() {
  const snapshot: Snapshot = { contractId:'c', currentVersionId:'v',versionId:'v',versionNumber:1,workLabel:'Test work',cancelled:false,driverEligible:true,signatures:[{id:'s1',versionId:'v',role:'driver',name:'Driver',signedAt:'2026-01-01'},{id:'s2',versionId:'v',role:'admin',name:'Admin',signedAt:'2026-01-02'}] };
  const reviews = new Map<string,Review>(), deliveries = new Map<string,string>();
  let sends=0, authorized=true, time=0;
  const ports: Ports = {
    authorize:async()=>authorized?'actor':null, snapshot:async()=>snapshot, admins:async()=>[{email:'admin@example.com',active:true}],
    saveReview:async r=>{reviews.set(r.id,r);}, getReview:async id=>reviews.get(id)??null,
    decideReview:async(id,actor,state)=>{const r=reviews.get(id);if(!r || r.actorId!==actor || r.state!=='reviewed')return false;r.state=state;return true;},
    finishReview:async(id,state)=>{reviews.get(id)!.state=state;},
    claimDelivery:async(n,r)=>{const key=n.versionId+r, state=deliveries.get(key);if(state==='accepted')return 'accepted';if(state && state!=='rejected')return 'blocked';deliveries.set(key,'pending');return 'acquired';},
    finishDelivery:async(n,r,s)=>{deliveries.set(n.versionId+r,s);}, send:async()=>{sends++;return 'accepted';},
  };
  const run=createNoticeService(ports,{enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com'},()=>time);
  const prepare=async()=>{const r=await run('token',{action:'prepare',contractId:'c'});assert.equal(r.status,200);return r.body.reviewId;};
  return {snapshot,ports,run,prepare,reviews,deliveries,get sends(){return sends;},revoke(){authorized=false;},expire(){time=700000;}};
}
test('disabled service does not authorize or access persistence',async()=>{
 const h=harness();h.ports.authorize=()=>{throw Error('must not call');};assert.equal((await createNoticeService(h.ports)('token',{})).status,503);
});
test('prepare, Skip and Send later never claim or send; later requires fresh review',async()=>{
 for(const action of ['skip','later']){const h=harness(),id=await h.prepare();assert.equal(h.deliveries.size,0);assert.equal((await h.run('token',{action,reviewId:id})).status,200);assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,409);assert.equal(h.sends,0);assert.equal(h.deliveries.size,0);}
});
test('both signing orders yield same notice; active recipients deduplicated',async()=>{
 const h=harness(),a=[{email:'ADMIN@example.com',active:true},{email:'admin@example.com',active:true},{email:'inactive@example.com',active:false}];
 const n=await buildNotice(h.snapshot,a,'shipping@havenlight.com');h.snapshot.signatures.reverse();assert.deepEqual(await buildNotice(h.snapshot,a,'shipping@havenlight.com'),n);assert.deepEqual(n.recipients,['accounting@havenlight.com','admin@example.com']);assert.match(n.message,/not payment authorization/);
});
test('missing, wrong version, duplicate signatures, cancelled and reassigned evidence fail closed',async()=>{
 for(const mutate of [(s:Snapshot)=>s.signatures.pop(),(s:Snapshot)=>s.signatures[0].versionId='old',(s:Snapshot)=>s.signatures.push(s.signatures[0]),(s:Snapshot)=>s.currentVersionId='new',(s:Snapshot)=>s.cancelled=true,(s:Snapshot)=>s.driverEligible=false]){const h=harness();mutate(h.snapshot);assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,409);assert.equal(h.sends,0);}
});
test('test recipient cannot be a real intended recipient',async()=>{const h=harness();await assert.rejects(buildNotice(h.snapshot,[],'accounting@havenlight.com'));});
test('explicit confirmation, active session and unexpired review required',async()=>{
 const h=harness(),id=await h.prepare();assert.equal((await h.run('token',{action:'send',reviewId:id})).status,400);h.expire();assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,409);h.revoke();assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,403);assert.equal(h.sends,0);
});
test('concurrent confirmations and fresh reviews do not resend accepted recipients',async()=>{
 const h=harness(),id=await h.prepare();const results=await Promise.all([1,2].map(()=>h.run('token',{action:'send',reviewId:id,confirmed:true})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(h.sends,2);const next=await h.prepare();const result=await h.run('token',{action:'send',reviewId:next,confirmed:true});assert.equal(result.body.alreadyAccepted,2);assert.equal(h.sends,2);
});
test('state changes after review and after claim prevent send',async()=>{
 for(const afterClaim of [false,true]){const h=harness(),id=await h.prepare();if(afterClaim){const original=h.ports.claimDelivery;h.ports.claimDelivery=async(n,r)=>{const claim=await original(n,r);h.revoke();return claim;};}else h.snapshot.versionNumber=2;assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,409);assert.equal(h.sends,0);}
});
test('provider ambiguity blocks explicit retry and never auto retries',async()=>{
 const h=harness();let calls=0;h.ports.send=async()=>{calls++;throw Error('timeout');};const id=await h.prepare();assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,409);const next=await h.prepare();assert.equal((await h.run('token',{action:'send',reviewId:next,confirmed:true})).status,409);assert.equal(calls,1);
});
test('definite rejection can retry only after a new review',async()=>{
 const h=harness();h.ports.send=async()=> 'rejected';const id=await h.prepare();assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,503);h.ports.send=async()=> 'accepted';const next=await h.prepare();assert.equal((await h.run('token',{action:'send',reviewId:next,confirmed:true})).status,200);
});
test('foreign review and client supplied recipient rejected',async()=>{
 const h=harness(),id=await h.prepare();h.reviews.get(id as string)!.actorId='someone-else';assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,404);assert.equal((await h.run('token',{action:'prepare',contractId:'c',to:'evil@example.com'})).status,400);
});

test('approved shipping inbox may also be an intended admin; other destinations fail closed', async()=>{
 const h=harness();const admins=[{email:'shipping@havenlight.com',active:true}];
 const notice=await buildNotice(h.snapshot,admins,' SHIPPING@HAVENLIGHT.COM ');
 assert.equal(notice.testRecipient,'shipping@havenlight.com');
 assert.ok(notice.recipients.includes('shipping@havenlight.com'));
 for(const inbox of ['other@example.com','accounting@havenlight.com','','shipping+test@havenlight.com']) await assert.rejects(buildNotice(h.snapshot,admins,inbox));
});
