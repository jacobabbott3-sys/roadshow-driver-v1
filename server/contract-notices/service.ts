export type Signature = { id: string; versionId: string; role: 'driver' | 'admin'; name: string; signedAt: string };
export type Snapshot = { contractId: string; currentVersionId: string | null; versionId: string; versionNumber: number;
  workLabel: string; cancelled: boolean; driverEligible: boolean; signatures: Signature[] };
export type AdminRecipient = { email: string; active: boolean };
export type Notice = { contractId: string; versionId: string; versionNumber: number; recipients: string[];
  testRecipient: string; subject: string; message: string; fingerprint: string };
export type Review = { id: string; actorId: string; expiresAt: number; notice: Notice; state: string };
export type Result = { status: number; body: Record<string, unknown> };
export type DeliveryClaim = 'acquired' | 'accepted' | 'blocked';
export type Ports = {
  authorize: (token: string) => Promise<string | null>;
  snapshot: (contractId: string) => Promise<Snapshot>;
  admins: () => Promise<AdminRecipient[]>;
  saveReview: (review: Review) => Promise<void>;
  getReview: (id: string) => Promise<Review | null>;
  decideReview: (id: string, actorId: string, state: 'sending' | 'skipped' | 'deferred') => Promise<boolean>;
  finishReview: (id: string, state: string) => Promise<void>;
  claimDelivery: (notice: Notice, recipient: string) => Promise<DeliveryClaim>;
  finishDelivery: (notice: Notice, recipient: string, state: 'accepted' | 'rejected' | 'uncertain') => Promise<void>;
  send: (notice: Notice, recipient: string) => Promise<'accepted' | 'rejected'>;
};
export type Policy = { enabled: boolean; mailEnabled: boolean; testRecipient: string };
const disabled: Policy = { enabled: false, mailEnabled: false, testRecipient: '' };
const normalize = (email: string) => email.trim().toLowerCase();
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const response = (status: number, message: string, extra: Record<string, unknown> = {}): Result => ({ status, body: { message, ...extra } });
export async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function buildNotice(snapshot: Snapshot, admins: AdminRecipient[], testInbox: string): Promise<Notice> {
  const driver = snapshot.signatures.filter(s => s.role === 'driver');
  const admin = snapshot.signatures.filter(s => s.role === 'admin');
  if (!snapshot.currentVersionId || snapshot.currentVersionId !== snapshot.versionId || snapshot.cancelled
    || !snapshot.driverEligible || driver.length !== 1 || admin.length !== 1
    || [driver[0], admin[0]].some(s => s.versionId !== snapshot.currentVersionId || !s.id || !s.signedAt)) {
    throw new Error('Both required signatures must belong to the same current, noncancelled agreement version.');
  }
  const recipients = [...new Set([...admins.filter(a => a.active).map(a => normalize(a.email)), 'accounting@havenlight.com'])].sort();
  if (recipients.some(email => !validEmail(email))) throw new Error('An active administrator has no valid email address.');
  const testRecipient = normalize(testInbox);
  if (!validEmail(testRecipient) || recipients.includes(testRecipient)) throw new Error('A separate approved test inbox is required.');
  const subject = `Agreement fully signed — ${snapshot.workLabel} — version ${snapshot.versionNumber}`;
  const message = `${snapshot.workLabel}\nAgreement version ${snapshot.versionNumber} (${snapshot.versionId}) has both required signatures.\nDriver: ${driver[0].name} (${driver[0].signedAt})\nAdministrator: ${admin[0].name} (${admin[0].signedAt})\n\nThis is an informational signed-contract notice, not payment authorization. Payment readiness will be communicated separately.\n\nReview the current agreement: https://beta.roadshowdriver.com/admin/contracts/${encodeURIComponent(snapshot.contractId)}/agreement\nA later revision or cancellation may change the current agreement. This notice records the version identified above.`;
  const details = { contractId: snapshot.contractId, versionId: snapshot.versionId, versionNumber: snapshot.versionNumber, recipients, testRecipient, subject, message };
  return { ...details, fingerprint: await digest({ details, signatures: [driver[0], admin[0]] }) };
}
export function createNoticeService(ports: Ports, policy: Policy = disabled, now = Date.now) {
  async function fresh(contractId: string) { return buildNotice(await ports.snapshot(contractId), await ports.admins(), policy.testRecipient); }
  return async (token: string, input: unknown): Promise<Result> => {
    if (!policy.enabled) return response(503, 'Contract email is disabled.');
    let accepted = 0, alreadyAccepted = 0;
    try {
      const actorId = token ? await ports.authorize(token) : null;
      if (!actorId) return response(403, 'A current active administrator session is required.');
      if (!input || typeof input !== 'object' || Array.isArray(input)) return response(400, 'Invalid request.');
      const body = input as Record<string, unknown>;
      if (body.action === 'prepare') {
        if (Object.keys(body).some(key => !['action', 'contractId'].includes(key)) || typeof body.contractId !== 'string' || !body.contractId || body.contractId.length > 128) return response(400, 'Invalid review request.');
        let notice: Notice;
        try { notice = await fresh(body.contractId); } catch { return response(409, 'Notice unavailable. Verify current signatures, assignment, cancellation and recipients before reviewing again.'); }
        const review: Review = { id: crypto.randomUUID(), actorId, expiresAt: now() + 10 * 60 * 1000, notice, state: 'reviewed' };
        await ports.saveReview(review);
        return { status: 200, body: { reviewId: review.id, expiresAt: review.expiresAt, notice, mailEnabled: policy.mailEnabled } };
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
      for (const recipient of review.notice.recipients) {
        // Revalidate at confirmed send and before EVERY recipient. Never infer
        // permission or agreement eligibility from the client or a saved draft.
        if (await ports.authorize(token) !== actorId || (await fresh(review.notice.contractId)).fingerprint !== review.notice.fingerprint) {
          await ports.finishReview(review.id, 'stale');
          return response(409, 'Agreement, access or recipients changed. Review again; earlier accepted messages cannot be recalled.', { accepted, alreadyAccepted });
        }
        const claim = await ports.claimDelivery(review.notice, recipient);
        if (claim === 'accepted') { alreadyAccepted++; continue; }
        if (claim === 'blocked') {
          await ports.finishReview(review.id, 'uncertain');
          return response(409, 'A previous recipient request is pending or uncertain. Reconcile it before another send.', { accepted, alreadyAccepted });
        }
        // Recheck after the durable claim, which may have waited for another call.
        try {
          if (await ports.authorize(token) !== actorId || (await fresh(review.notice.contractId)).fingerprint !== review.notice.fingerprint) {
            await ports.finishDelivery(review.notice, recipient, 'rejected');
            await ports.finishReview(review.id, 'stale');
            return response(409, 'State changed before sending. Reopen the review.', { accepted, alreadyAccepted });
          }
          const outcome = await ports.send(review.notice, recipient);
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
