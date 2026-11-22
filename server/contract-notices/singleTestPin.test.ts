import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest } from './service.ts';
import { parseSingleTestPin, matchesSingleTestPin } from './singleTestPin.ts';
import type { Notice } from './noticeTypes.ts';
test('pin is disabled by default, expires and binds actor, ids, full evidence and exact body', async()=>{
 const actorId='00000000-0000-4000-8000-000000000001';
 const notice: Notice={contractId:'00000000-0000-4000-8000-000000000002',versionId:'00000000-0000-4000-8000-000000000003',
 versionNumber:1,recipients:['accounting@havenlight.com'],testRecipient:'shipping@havenlight.com',
 subject:'Beta fictional',message:'Demo\n\nExtra line',attachmentName:'signed-agreement-receipt.pdf',attachmentDigest:'e'.repeat(64),deliveryMode:'approved-fixture-settings',evidenceFingerprint:'f'.repeat(64),fingerprint:'0'.repeat(64)};
 const {contractId,versionId,attachmentDigest,evidenceFingerprint}=notice;
 const now=1_800_000_000_000;
 const raw={actorId,contractId,versionId,attachmentDigest,evidenceFingerprint,bodyDigest:await digest(notice.message),expiresAt:now+60_000};
 const pin=parseSingleTestPin(JSON.stringify(raw),now)!;
 assert.ok(pin);
 for(const bad of [undefined,'{}','null',JSON.stringify({...raw,expiresAt:now}),JSON.stringify({...raw,expiresAt:now+86_400_001}),JSON.stringify({...raw,to:'other@example.com'})]) assert.equal(parseSingleTestPin(bad,now),null);
 assert.equal(await matchesSingleTestPin(pin,notice,actorId,now),true);
 assert.equal(await matchesSingleTestPin(pin,notice,actorId,raw.expiresAt),false);
 assert.equal(await matchesSingleTestPin(pin,notice,contractId,now),false);
 for(const mutation of [{contractId:versionId},{versionId:contractId},{evidenceFingerprint:'a'.repeat(64)},{attachmentDigest:'b'.repeat(64)},{message:'Demo\nExtra line'},{testRecipient:'other@example.com'}])
   assert.equal(await matchesSingleTestPin(pin,{...notice,...mutation},actorId,now),false);
});
test('persistent mode is explicitly discriminated and requires the prior Shipping guarantee', async()=>{
 const now=1_800_000_000_000;
 const actorId='00000000-0000-4000-8000-000000000001',contractId='00000000-0000-4000-8000-000000000002',versionId='00000000-0000-4000-8000-000000000003';
 const notice: Notice={contractId,versionId,versionNumber:1,recipients:['person@example.test'],testRecipient:'shipping@havenlight.com',deliveryMode:'approved-fixture-settings',subject:'Fictional',message:'Fixed',attachmentName:'receipt.pdf',attachmentDigest:'a'.repeat(64),evidenceFingerprint:'b'.repeat(64),fingerprint:'c'.repeat(64)};
 const evidence={actorId,contractId,versionId,attachmentDigest:notice.attachmentDigest,evidenceFingerprint:notice.evidenceFingerprint,bodyDigest:await digest(notice.message)};
 const persistent={...evidence,activationMode:'persistent',allowPriorShippingAccepted:true};
 for(const invalid of [evidence,{...persistent,expiresAt:now+5},{...persistent,allowPriorShippingAccepted:false},{...persistent,activationMode:'forever'}])
   assert.equal(parseSingleTestPin(JSON.stringify(invalid),now),null);
 const pin=parseSingleTestPin(JSON.stringify(persistent),now)!;
 assert.ok(pin);
 assert.equal(await matchesSingleTestPin(pin,notice,actorId,now+365*86_400_000),true);
 assert.equal(await matchesSingleTestPin(pin,{...notice,message:'Changed'},actorId,now),false);
 assert.equal(await matchesSingleTestPin(pin,notice,versionId,now),false);
});
