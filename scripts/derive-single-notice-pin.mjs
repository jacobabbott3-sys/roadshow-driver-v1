// For a separately approved synthetic fixture only. Not a release, no network,
// and no values committed. Stdin is {snapshot, settings, actorId, allowPriorShippingAccepted?}.
import { readFileSync } from 'node:fs';
import { buildNotice, digest, approvedTestInbox } from '../server/contract-notices/service.ts';
const {snapshot, settings, actorId, allowPriorShippingAccepted} = JSON.parse(readFileSync(0, 'utf8'));
if (snapshot.testOwner !== actorId) throw Error('Actor mismatch');
const notice = await buildNotice(snapshot, settings, approvedTestInbox);
const message = notice.message;
const preview = {...(allowPriorShippingAccepted === true ? {allowPriorShippingAccepted: true} : {}),actorId,contractId:notice.contractId,versionId:notice.versionId,evidenceFingerprint:notice.evidenceFingerprint,
  attachmentDigest:notice.attachmentDigest,bodyDigest:await digest(message),expiresAt:Date.now()+24*60*60*1000};
process.stdout.write(JSON.stringify(preview));
