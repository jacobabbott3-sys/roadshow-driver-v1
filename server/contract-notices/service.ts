import { generateReceipt } from './receipt.ts';
import type { Notice, RecipientSettings } from './noticeTypes.ts';
export type { Notice, RecipientSettings } from './noticeTypes.ts';
export const approvedTestInbox = 'shipping@havenlight.com';
export type Signature = { id: string; versionId: string; role: 'driver' | 'admin'; name: string; signedAt: string };
export type Snapshot = { contractId: string; currentVersionId: string | null; versionId: string; versionNumber: number;
  contents: { contract: { contract_pay: unknown; document_path?: unknown }; work: { name: unknown; per_diem: unknown } }; testOwner: string; cancelled: boolean; driverEligible: boolean; signatures: Signature[] };
export type Review = { id: string; actorId: string; expiresAt: number; notice: Notice; state: string };
export type Result = { status: number; body: Record<string, unknown> };
export type DeliveryClaim = 'acquired' | 'accepted' | 'blocked';
export type Ports = {
  authorize: (token: string) => Promise<string | null>;
  snapshot: (contractId: string) => Promise<Snapshot>;
  settings: () => Promise<RecipientSettings>;
  saveSettings: (settings: RecipientSettings, actorId: string) => Promise<number | null>;
  saveReview: (review: Review) => Promise<void>;
  getReview: (id: string) => Promise<Review | null>;
  decideReview: (id: string, actorId: string, state: 'sending' | 'skipped' | 'deferred' | 'stale') => Promise<boolean>;
  finishReview: (id: string, state: string) => Promise<void>;
  claimDelivery: (notice: Notice, recipient: string) => Promise<DeliveryClaim>;
  finishDelivery: (notice: Notice, recipient: string, state: 'accepted' | 'rejected' | 'uncertain') => Promise<void>;
  send: (notice: Notice, recipient: string, attachment: string) => Promise<'accepted' | 'rejected'>;
};
export type Policy = { enabled: boolean; mailEnabled: boolean; testRecipient: string };
const disabled: Policy = { enabled: false, mailEnabled: false, testRecipient: '' };
const hasControls = (value: string) => Array.from(value).some(char => {
  const cp = char.codePointAt(0)!;
  return cp < 32 || (cp >= 127 && cp <= 159) || cp === 8232 || cp === 8233;
});
const normalize = (email: string) => email.trim().toLowerCase();
export function canonicalRecipients(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) throw new Error('Enter one to seven email addresses.');
  const result = value.map(row => {
    if (typeof row !== 'string' || hasControls(row)) throw new Error('Enter email addresses only.');
    const email = normalize(row);
    const [local, domain] = email.split('@');
    if (email.length > 254 || !domain || local.length > 64
      || !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email))
      throw new Error('Enter email addresses only.');
    return email;
  });
  return [...new Set(result)].sort();
}
function singleLine(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || hasControls(value)) throw new Error('Invalid signed label.');
  return value;
}
function money(value: unknown) {
  if (value === null) return 'Not specified';
  if (typeof value !== 'number' || !/^\d{1,9}(?:\.\d{1,2})?$/.test(String(value))) throw new Error('Invalid signed amount.');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
const response = (status: number, message: string, extra: Record<string, unknown> = {}): Result => ({ status, body: { message, ...extra } });
export async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function buildNotice(snapshot: Snapshot, settings: RecipientSettings, testInbox: string): Promise<Notice & {attachment: string}> {
  const driver = snapshot.signatures.filter(s => s.role === 'driver');
  const admin = snapshot.signatures.filter(s => s.role === 'admin');
  if (!snapshot.currentVersionId || snapshot.currentVersionId !== snapshot.versionId || snapshot.cancelled
    || !snapshot.driverEligible || driver.length !== 1 || admin.length !== 1
    || [driver[0], admin[0]].some(s => s.versionId !== snapshot.currentVersionId || !s.id || !s.signedAt)) {
    throw new Error('Both required signatures must belong to the same current, noncancelled agreement version.');
  }
  if (snapshot.contents.contract.document_path !== null && snapshot.contents.contract.document_path !== undefined)
    throw new Error('The immutable uploaded document bytes are unavailable.');
  const recipients = canonicalRecipients(settings.recipients);
  const testRecipient = normalize(testInbox);
  if (testRecipient !== approvedTestInbox) throw new Error('Only the approved shipping test inbox is permitted.');
  const driverName = singleLine(driver[0].name);
  const workLabel = singleLine(snapshot.contents.work.name);
  const subject = `Agreement fully signed — ${workLabel} — version ${snapshot.versionNumber}`;
  const message = `Driver: ${driverName}\nContract: ${workLabel}\nSigned base pay: ${money(snapshot.contents.contract.contract_pay)}\nSigned per diem: ${money(snapshot.contents.work.per_diem)}`;
  const attachment = generateReceipt(snapshot.contents, String(snapshot.versionNumber), [driver[0], admin[0]], { contractId: snapshot.contractId, versionId: snapshot.versionId });
  const details = { contractId: snapshot.contractId, versionId: snapshot.versionId, versionNumber: snapshot.versionNumber,
    recipients, testRecipient, subject, message, attachmentName: 'signed-agreement-receipt.pdf', attachmentDigest: await digest(attachment) };
  return { ...details, attachment, fingerprint: await digest({ details, revision: settings.revision, signatures: [driver[0], admin[0]] }) };
}
export function createNoticeService(ports: Ports, policy: Policy = disabled, now = Date.now) {
  async function fresh(contractId: string, actorId: string) {
    const snapshot = await ports.snapshot(contractId);
    if (snapshot.testOwner !== actorId) throw new Error('Only your synthetic beta test agreement is allowed.');
    return buildNotice(snapshot, await ports.settings(), policy.testRecipient);
  }
  async function verified(token: string, actorId: string, notice: Notice) {
    if (await ports.authorize(token) !== actorId) return null;
    const current = await fresh(notice.contractId, actorId).catch(() => null);
    return current?.fingerprint === notice.fingerprint ? current : null;
  }
  return async (token: string, input: unknown): Promise<Result> => {
    if (!policy.enabled) return response(503, 'Contract email is disabled.');
    let accepted = 0;
    const alreadyAccepted = 0;
    try {
      const actorId = token ? await ports.authorize(token) : null;
      if (!actorId) return response(403, 'A current active administrator session is required.');
      if (!input || typeof input !== 'object' || Array.isArray(input)) return response(400, 'Invalid request.');
      const body = input as Record<string, unknown>;
      if (body.action === 'settings-get' && Object.keys(body).length === 1) {
        return response(200, 'Default recipients loaded.', { settings: await ports.settings() });
      }
      if (body.action === 'settings-save') {
        if (Object.keys(body).some(key => !['action', 'revision', 'recipients'].includes(key))
          || typeof body.revision !== 'number' || !Number.isInteger(body.revision) || body.revision < 0 || body.revision >= 2147483647)
          return response(400, 'Invalid settings request.');
        let recipients: string[];
        try { recipients = canonicalRecipients(body.recipients); }
        catch { return response(400, 'Enter one to seven valid email addresses.'); }
        const revision = await ports.saveSettings({ recipients, revision: body.revision }, actorId);
        if (revision === null) return response(409, 'Settings changed. Reload before saving.');
        return response(200, 'Default recipients saved.', { settings: { recipients, revision } });
      }
      if (body.action === 'prepare') {
        if (Object.keys(body).some(key => !['action', 'contractId'].includes(key)) || typeof body.contractId !== 'string' || !body.contractId || body.contractId.length > 128) return response(400, 'Invalid review request.');
        let notice: Notice;
        try { const { attachment: _attachment, ...reviewNotice } = await fresh(body.contractId, actorId); void _attachment; notice = reviewNotice; } catch { return response(409, 'Notice unavailable. Verify current signatures, assignment, cancellation and recipients before reviewing again.'); }
        const review: Review = { id: crypto.randomUUID(), actorId, expiresAt: now() + 10 * 60 * 1000, notice, state: 'reviewed' };
        await ports.saveReview(review);
        return { status: 200, body: { reviewId: review.id, expiresAt: review.expiresAt, notice, mailEnabled: policy.mailEnabled } };
      }
      if (body.action === 'edit-body') {
        if (Object.keys(body).some(key => !['action', 'reviewId', 'message'].includes(key))
          || typeof body.reviewId !== 'string' || typeof body.message !== 'string' || !body.message.trim()
          || body.message.length > 3000 || new TextEncoder().encode(body.message).length > 9000 || hasControls(body.message.replaceAll('\n', '').replaceAll('\t', ''))
          || Array.from(body.message).some(char => { const cp = char.codePointAt(0)!; return cp >= 55296 && cp <= 57343; })) return response(400, 'Enter a nonempty plain-text email body up to 3,000 characters.');
        const old = await ports.getReview(body.reviewId);
        if (!old || old.actorId !== actorId) return response(404, 'Review not found.');
        if (old.state !== 'reviewed' || old.expiresAt <= now() || !await verified(token, actorId, old.notice))
          return response(409, 'Review expired or changed. Open a fresh review.');
        if (!await ports.decideReview(old.id, actorId, 'stale')) return response(409, 'This review is already decided.');
        const updated: Review = { ...old, id: crypto.randomUUID(), state: 'reviewed', notice: { ...old.notice, message: body.message } };
        await ports.saveReview(updated);
        return { status: 200, body: { reviewId: updated.id, expiresAt: updated.expiresAt, notice: updated.notice, mailEnabled: policy.mailEnabled } };
      }
      if (!['send', 'skip', 'later'].includes(String(body.action)) || typeof body.reviewId !== 'string'
        || Object.keys(body).some(key => !['action', 'reviewId', 'confirmed'].includes(key))) return response(400, 'Invalid decision.');
      const review = await ports.getReview(body.reviewId);
      if (!review || review.actorId !== actorId) return response(404, 'Review not found.');
      if (body.action !== 'send') {
        if (!await ports.decideReview(review.id, actorId, body.action === 'skip' ? 'skipped' : 'deferred')) return response(409, 'This review is already decided.');
        return response(200, body.action === 'skip' ? 'Skipped. No email was sent or queued.' : 'Saved for later. Nothing is scheduled or queued. Reopen a fresh review and confirm Send when ready.');
      }
      if (body.confirmed !== true) return response(400, 'Explicit Send confirmation is required.');
      if (!policy.mailEnabled) return response(503, 'Email sending is disabled. Nothing was sent or queued.');
      if (review.expiresAt <= now()) return response(409, 'Review expired. Reopen and confirm the current recipients and message.');
      if (!await ports.decideReview(review.id, actorId, 'sending')) return response(409, 'This review is already decided or sending.');
      {
        const recipient = approvedTestInbox;
        // Revalidate at confirmed send and before EVERY recipient. Never infer
        // permission or agreement eligibility from the client or a saved draft.
        if (!await verified(token, actorId, review.notice)) {
          await ports.finishReview(review.id, 'stale');
          return response(409, 'Agreement, access or recipients changed. Review again; earlier accepted messages cannot be recalled.', { accepted, alreadyAccepted });
        }
        const claim = await ports.claimDelivery(review.notice, recipient);
        if (claim === 'accepted') {
          await ports.finishReview(review.id, 'sent');
          return response(200, 'This beta test email was previously accepted by the provider.', { accepted, alreadyAccepted: 1 });
        }
        if (claim === 'blocked') {
          await ports.finishReview(review.id, 'uncertain');
          return response(409, 'A previous recipient request is pending or uncertain. Reconcile it before another send.', { accepted, alreadyAccepted });
        }
        // Recheck after the durable claim, which may have waited for another call.
        try {
          const current = await verified(token, actorId, review.notice);
          if (!current) {
            await ports.finishDelivery(review.notice, recipient, 'rejected');
            await ports.finishReview(review.id, 'stale');
            return response(409, 'State changed before sending. Reopen the review.', { accepted, alreadyAccepted });
          }
          const outcome = await ports.send(review.notice, recipient, current.attachment);
          await ports.finishDelivery(review.notice, recipient, outcome);
          if (outcome === 'rejected') {
            await ports.finishReview(review.id, 'failed');
            return response(503, 'Provider rejected a recipient request. Review again before an explicit retry.', { accepted, alreadyAccepted });
          }
          accepted++;
        } catch {
          // Failure after provider acceptance may be ambiguous. Never release a
          // pending claim on error; persist uncertainty when possible.
          await ports.finishDelivery(review.notice, recipient, 'uncertain').catch(() => undefined);
          await ports.finishReview(review.id, 'uncertain').catch(() => undefined);
          return response(409, 'Recipient outcome is unknown. Reconcile before retrying; no automatic retry is scheduled.', { accepted, alreadyAccepted });
        }
      }
      await ports.finishReview(review.id, 'sent');
      return response(200, 'Confirmed test email requests completed. Provider acceptance does not confirm inbox delivery.', { accepted, alreadyAccepted });
    } catch {
      return response(503, 'Notice service unavailable. Check request history before retrying.', { accepted, alreadyAccepted });
    }
  };
}
