import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest } from './service.ts';
import { parseSingleTestPin, matchesSingleTestPin } from './singleTestPin.ts';
import type { Notice } from './noticeTypes.ts';
test('pin is disabled by default, expires and binds actor, ids, full evidence and exact body', async()=>{
 const actorId='00000000-0000-4000-8000-000000000001';
 const notice: Notice={contractId:'00000000-0000-4000-8000-000000000002',versionId:'00000000-0000-4000-8000-000000000003',
 versionNumber:1,recipients:['accounting@havenlight.com'],testRecipient:'shipping@havenlight.com',
 subject:'Beta fictional',message:'Demo\n\nExtra line',attachmentName:'signed-agreement-receipt.pdf',attachmentDigest:'e'.repeat(64),fingerprint:'f'.repeat(64)};
 const {contractId,versionId,attachmentDigest,fingerprint}=notice;
 const now=1_800_000_000_000;
 const raw={actorId,contractId,versionId,attachmentDigest,fingerprint,bodyDigest:await digest(notice.message),expiresAt:now+60_000};
 const pin=parseSingleTestPin(JSON.stringify(raw),now)!;
 assert.ok(pin);
 for(const bad of [undefined,'{}','null',JSON.stringify({...raw,expiresAt:now}),JSON.stringify({...raw,expiresAt:now+900001}),JSON.stringify({...raw,to:'other@example.com'})]) assert.equal(parseSingleTestPin(bad,now),null);
 assert.equal(await matchesSingleTestPin(pin,notice,actorId,now),true);
 assert.equal(await matchesSingleTestPin(pin,notice,actorId,raw.expiresAt),false);
 assert.equal(await matchesSingleTestPin(pin,notice,contractId,now),false);
 for(const mutation of [{contractId:versionId},{versionId:contractId},{fingerprint:'a'.repeat(64)},{attachmentDigest:'b'.repeat(64)},{message:'Demo\nExtra line'},{testRecipient:'other@example.com'}])
   assert.equal(await matchesSingleTestPin(pin,{...notice,...mutation},actorId,now),false);
});
