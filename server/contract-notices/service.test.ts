import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotice, createNoticeService, type Ports, type Review, type Snapshot } from './service.ts';
function harness() {
  const snapshot: Snapshot = { contractId:'c', currentVersionId:'v',versionId:'v',versionNumber:1,testOwner:'actor',contents:{work:{name:'Test work',per_diem:null},contract:{contract_pay:125.05}},cancelled:false,driverEligible:true,signatures:[{id:'s1',versionId:'v',role:'driver',name:'Driver',signedAt:'2026-01-01'},{id:'s2',versionId:'v',role:'admin',name:'Admin',signedAt:'2026-01-02'}] };
  const reviews = new Map<string,Review>(), deliveries = new Map<string,string>();
  let sends=0, authorized=true, time=0;
  let settings={recipients:['accounting@havenlight.com'],revision:0};
  const ports: Ports = {
    authorize:async()=>authorized?'actor':null, snapshot:async()=>snapshot, settings:async()=>settings, saveSettings:async(next)=>{if(settings.revision!==next.revision)return null;settings={...next,revision:next.revision+1};return settings.revision;},
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
 const h=harness(),a={recipients:['ADMIN@example.com','admin@example.com','accounting@havenlight.com'],revision:0};
 const n=await buildNotice(h.snapshot,a,'shipping@havenlight.com');h.snapshot.signatures.reverse();assert.deepEqual(await buildNotice(h.snapshot,a,'shipping@havenlight.com'),n);assert.deepEqual(n.recipients,['accounting@havenlight.com','admin@example.com']);assert.equal(n.message,'Driver: Driver\nContract: Test work\nSigned base pay: $125.05\nSigned per diem: Not specified');
});
test('missing, wrong version, duplicate signatures, cancelled and reassigned evidence fail closed',async()=>{
 for(const mutate of [(s:Snapshot)=>s.signatures.pop(),(s:Snapshot)=>s.signatures[0].versionId='old',(s:Snapshot)=>s.signatures.push(s.signatures[0]),(s:Snapshot)=>s.currentVersionId='new',(s:Snapshot)=>s.cancelled=true,(s:Snapshot)=>s.driverEligible=false]){const h=harness();mutate(h.snapshot);assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,409);assert.equal(h.sends,0);}
});
test('test recipient cannot be a real intended recipient',async()=>{const h=harness();await assert.rejects(buildNotice(h.snapshot,{recipients:['accounting@havenlight.com'],revision:0},'accounting@havenlight.com'));});
test('explicit confirmation, active session and unexpired review required',async()=>{
 const h=harness(),id=await h.prepare();assert.equal((await h.run('token',{action:'send',reviewId:id})).status,400);h.expire();assert.equal((await h.run('token',{action:'send',reviewId:id,confirmed:true})).status,409);h.revoke();assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,403);assert.equal(h.sends,0);
});
test('concurrent confirmations and fresh reviews do not resend accepted recipients',async()=>{
 const h=harness(),id=await h.prepare();const results=await Promise.all([1,2].map(()=>h.run('token',{action:'send',reviewId:id,confirmed:true})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(h.sends,1);const next=await h.prepare();const result=await h.run('token',{action:'send',reviewId:next,confirmed:true});assert.equal(result.body.alreadyAccepted,1);assert.equal(h.sends,1);
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
 const h=harness();const admins={recipients:['shipping@havenlight.com'],revision:0};
 const notice=await buildNotice(h.snapshot,admins,' SHIPPING@HAVENLIGHT.COM ');
 assert.equal(notice.testRecipient,'shipping@havenlight.com');
 assert.ok(notice.recipients.includes('shipping@havenlight.com'));
 for(const inbox of ['other@example.com','accounting@havenlight.com','','shipping+test@havenlight.com']) await assert.rejects(buildNotice(h.snapshot,admins,inbox));
});
test('settings require active admin access and reject client hijacks',async()=>{
 const h=harness();
 assert.equal((await h.run('token',{action:'settings-get'})).status,200);
 assert.equal((await h.run('token',{action:'settings-save',revision:0,recipients:['Name <a@example.com>']})).status,400);
 assert.equal((await h.run('token',{action:'settings-save',revision:0,recipients:['a@example.com'],to:'a@example.com'})).status,400);
 h.revoke(); assert.equal((await h.run('token',{action:'settings-get'})).status,403);
});

test('settings save canonicalizes, uses compare-and-swap and makes review stale without delivery',async()=>{
 const h=harness(),reviewId=await h.prepare();
 const r=await h.run('token',{action:'settings-save',revision:0,recipients:[' Other@Example.COM ','other@example.com','billing@example.net']});
 assert.equal(r.status,200);
 assert.deepEqual(r.body.settings,{revision:1,recipients:['billing@example.net','other@example.com']});
 assert.equal((await h.run('token',{action:'settings-save',revision:0,recipients:['evil@example.com']})).status,409);
 assert.equal((await h.run('token',{action:'send',reviewId,confirmed:true})).status,409);
 assert.equal(h.sends,0);assert.equal(h.deliveries.size,0);
});
test('only owner synthetic agreements can be reviewed; signed zero, null and accented spelling remain distinct',async()=>{
 const h=harness();h.snapshot.testOwner='another';assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,409);
 h.snapshot.testOwner='actor';h.snapshot.signatures[0].name='José D’Ávila';
 h.snapshot.contents.work.name='Café São Paulo';h.snapshot.contents.work.per_diem=0;
 const result=await h.run('token',{action:'prepare',contractId:'c'});assert.equal(result.status,200);
 const n=result.body.notice as {message:string,attachment?:string};assert.equal(n.message,'Driver: José D’Ávila\nContract: Café São Paulo\nSigned base pay: $125.05\nSigned per diem: $0.00');
 assert.equal(n.attachment,undefined);
 h.snapshot.contents.work.per_diem=0.001;assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,409);
});
test('unsupported glyphs are rejected rather than altered',async()=>{
 const h=harness();h.snapshot.signatures[0].name='山田';assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,409);assert.equal(h.sends,0);
});
test('body edit rotates the review, preserves expiry and exact submitted text, and does not send',async()=>{
 const h=harness(),reviewId=await h.prepare(),base=h.reviews.get(reviewId as string)!;
 const message='  Hello José,\n\nKeep these line breaks.  ';
 const edit=await h.run('token',{action:'edit-body',reviewId,message});
 assert.equal(edit.status,200);assert.notEqual(edit.body.reviewId,reviewId);
 assert.equal(edit.body.expiresAt,base.expiresAt);
 assert.deepEqual(edit.body.notice,{...base.notice,message});
 assert.equal(h.sends,0);
 assert.equal((await h.run('token',{action:'send',reviewId,confirmed:true})).status,409);
 let sent='';
 h.ports.send=async n=>{sent=n.message;return 'accepted';};
 assert.equal((await h.run('token',{action:'send',reviewId:edit.body.reviewId,confirmed:true})).status,200);
 assert.equal(sent,message);
 assert.equal(h.deliveries.size,1);
});
test('document-backed snapshot cannot be reviewed or sent without immutable document bytes',async()=>{
 const h=harness();const reviewId=await h.prepare();
 h.snapshot.contents.contract.document_path='mutable/original.pdf';
 assert.equal((await h.run('token',{action:'prepare',contractId:'c'})).status,409);
 assert.equal((await h.run('token',{action:'send',reviewId,confirmed:true})).status,409);
 assert.equal(h.sends,0);
});
test('body edits reject invalid text and overrides, foreign, stale and expired reviews',async()=>{
 const h=harness(), reviewId=await h.prepare();
 for (const message of ['', '   ', 'z'.repeat(3001), 'a\r\nb', 'a\u0000b','\ud800'])
   assert.equal((await h.run('token',{action:'edit-body',reviewId,message})).status,400);
 assert.equal((await h.run('token',{action:'edit-body',reviewId,message:'valid',subject:'override'})).status,400);
 h.reviews.get(reviewId as string)!.actorId='different';assert.equal((await h.run('token',{action:'edit-body',reviewId,message:'valid'})).status,404);
 h.reviews.get(reviewId as string)!.actorId='actor';h.snapshot.versionNumber++;
 assert.equal((await h.run('token',{action:'edit-body',reviewId,message:'valid'})).status,409);
 h.snapshot.versionNumber--;h.expire();assert.equal((await h.run('token',{action:'edit-body',reviewId,message:'valid'})).status,409);
 assert.equal(h.sends,0);
});
test('exactly pinned review enables existing Send; edit, wrong actor and expiry fail closed without provider', async()=>{
 const h=harness();
 const canonical=await buildNotice(h.snapshot,{recipients:['accounting@havenlight.com'],revision:0},'shipping@havenlight.com');
 let time=0;
 const run=createNoticeService(h.ports,{
  enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com',
  isPinnedTarget:(contract,actor)=>contract==='c'&&actor==='actor',
  permitsTest:async(n,actor,at)=>n.message===canonical.message&&n.fingerprint===canonical.fingerprint&&actor==='actor'&&at<100,
 },()=>time);
 assert.equal((await run('token',{action:'test-eligible',contractId:'different'})).body.eligible,false);
 assert.equal((await run('token',{action:'test-eligible',contractId:'c'})).body.eligible,true);
 const first=await run('token',{action:'prepare',contractId:'c'});
 assert.equal(first.body.mailEnabled,true);
 const edit=await run('token',{action:'edit-body',reviewId:first.body.reviewId,message:'Not the approved body'});
 assert.equal(edit.body.mailEnabled,false);
 assert.equal((await run('token',{action:'send',reviewId:edit.body.reviewId,confirmed:true})).status,503);
 const second=await run('token',{action:'prepare',contractId:'c'});
 const claim=h.ports.claimDelivery;
 h.ports.claimDelivery=async(n,r)=>{const result=await claim(n,r);time=100;return result;};
 assert.equal((await run('token',{action:'send',reviewId:second.body.reviewId,confirmed:true})).status,409);
 assert.equal(h.sends,0);
});
test('pinned retry is exact and explicit; accepted and uncertain payloads do not replay',async()=>{
 for (const mode of ['accepted','rejected','uncertain'] as const) {
  const h=harness(); const expected=await buildNotice(h.snapshot,{recipients:['accounting@havenlight.com'],revision:0},'shipping@havenlight.com');
  let calls=0;
  h.ports.send=async n=>{
   assert.equal(n.message,expected.message);calls++;
   if (mode==='uncertain') throw Error('connection lost after attempt');
   return mode==='rejected'&&calls===1?'rejected':'accepted';
  };
  const run=createNoticeService(h.ports,{enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com',
   permitsTest:async(n,actor)=>actor==='actor'&&expected.message===n.message&&expected.fingerprint===n.fingerprint},()=>0);
  const request=async() => {
   const r=await run('token',{action:'prepare',contractId:'c'});
   return run('token',{action:'send',reviewId:r.body.reviewId,confirmed:true});
  };
  assert.equal((await request()).status,mode==='accepted'?200:mode==='rejected'?503:409);
  assert.equal((await request()).status,mode==='uncertain'?409:200);
  assert.equal(calls,mode==='rejected'?2:1);
 }
});
test('frozen Settings uses one envelope per address; partial uncertainty never replays',async()=>{
 const h=harness(), first='a@example.test', second='b@example.test', third='c@example.test';
 await h.ports.saveSettings({revision:0,recipients:[third,second,first]},'actor');
 const attempts:string[]=[];
 h.ports.send=async(_notice,to)=>{attempts.push(to);if(to===second)throw Error('ambiguous');return 'accepted';};
 const run=createNoticeService(h.ports,{enabled:true,mailEnabled:true,testRecipient:'shipping@havenlight.com',deliveryMode:'approved-fixture-settings',permitsTest:async()=>true},()=>0);
 assert.equal((await run('token',{action:'prepare',contractId:'c'})).status,409);
 const protocol='fictional-settings-delivery-v1';
 const prepare=()=>run('token',{action:'prepare',contractId:'c',deliveryProtocol:protocol});
 const send=(reviewId:unknown)=>run('token',{action:'send',reviewId,confirmed:true,deliveryProtocol:protocol});
 const stale=await prepare();
 assert.equal((await run('token',{action:'send',reviewId:stale.body.reviewId,confirmed:true})).status,409);
 assert.equal((await run('token',{action:'edit-body',reviewId:stale.body.reviewId,message:'old cached client'})).status,409);
 await h.ports.saveSettings({revision:1,recipients:[third,second,first]},'actor');
 assert.equal((await send(stale.body.reviewId)).status,409);assert.deepEqual(attempts,[]);
 const started=await prepare();
 assert.deepEqual((started.body.notice as {recipients:string[]}).recipients,[first,second,third]);
 const partial=await send(started.body.reviewId);
 assert.equal(partial.status,409);assert.equal(partial.body.accepted,1);assert.deepEqual(attempts,[first,second]);
 const retry=await send((await prepare()).body.reviewId);
 assert.equal(retry.status,409);assert.equal(retry.body.alreadyAccepted,1);assert.deepEqual(attempts,[first,second]);
});
