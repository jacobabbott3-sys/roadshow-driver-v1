/** Server-only orchestration. No live adapter or HTTP endpoint is wired in this increment. */
export type Account = {
  id: string; email: string; fullName: string | null; role: 'driver' | 'admin';
  active: boolean; invitedAt: string | null; confirmedAt: string | null;
};
type Actor = { id: string };
type Profile = { id: string; role: string; active: boolean };
export type MailCommand =
  | { action: 'create'; email: string; fullName: string; role: 'driver'; redirectTo: string }
  | { action: 'resend' | 'recover'; userId: string; email: string; redirectTo: string };
export type Result = { status: number; body: Record<string, unknown> };
export type Claim = { kind: 'acquired' } | { kind: 'replay'; result: Result }
  | { kind: 'busy' | 'conflict' | 'uncertain' };
export type AccountPorts = {
  projectId: string;
  verifySession: (bearer: string) => Promise<Actor | null>;
  getProfile: (id: string) => Promise<Profile | null>;
  listAccounts: (limit: number, cursor: string | null) => Promise<{ accounts: Account[]; nextCursor: string | null }>;
  getAccount: (id: string) => Promise<Account | null>;
  allowRequest: (actorId: string, recipient: string) => Promise<boolean>;
  // Must be durable and atomic; scope serializes all commands for a recipient.
  // Same actor/key with different fingerprint returns conflict, never acquired.
  claim: (actorId: string, key: string, fingerprint: string, scope: string) => Promise<Claim>;
  finish: (actorId: string, key: string, result: Result, state: 'complete' | 'retryable' | 'uncertain') => Promise<void>;
  // Must enforce a second server-side sandbox/recipient gate and use operationKey
  // for provider idempotency. Create must reject an existing email account, never
  // implicitly resend or change its role. Never accept client roles or redirects.
  perform: (command: MailCommand, operationKey: string) => Promise<
    { kind: 'accepted' } | { kind: 'rejected'; retryable: boolean }
  >;
};
export type AccountPolicy = {
  enabled: boolean;
  deliveryEnabled: boolean;
  approvedBetaProjectId: string;
  testRecipients: readonly string[];
};
const disabledPolicy: AccountPolicy = {
  enabled: false, deliveryEnabled: false, approvedBetaProjectId: '', testRecipients: [],
};
const result = (status: number, message: string): Result => ({ status, body: { message } });
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const only = (body: Record<string, unknown>, fields: string[]) => Object.keys(body).every(key => fields.includes(key));
const betaOrigin = 'https://beta.roadshowdriver.com';

export function createAccountService(ports: AccountPorts, policy: AccountPolicy = disabledPolicy) {
  async function authorize(bearer: string): Promise<Actor | Result> {
    if (!bearer) return result(401, 'Sign in again.');
    const actor = await ports.verifySession(bearer);
    if (!actor) return result(401, 'Sign in again.');
    const profile = await ports.getProfile(actor.id);
    return profile?.id === actor.id && profile.active && profile.role === 'admin'
      ? actor : result(403, 'Active administrator access required.');
  }

  return async (bearer: string, input: unknown): Promise<Result> => {
    // No live calls at all with the default policy. Production target is forbidden.
    if (!policy.enabled || !policy.approvedBetaProjectId || ports.projectId !== policy.approvedBetaProjectId
      || ports.projectId === 'myraoovepjwhkafzdppq') return result(503, 'Account management is disabled.');
    try {
      const actor = await authorize(bearer);
      if ('status' in actor) return actor;
      if (!input || typeof input !== 'object' || Array.isArray(input)) return result(400, 'Invalid request.');
      const body = input as Record<string, unknown>;
      if (body.action === 'list') {
        if (!only(body, ['action', 'limit', 'cursor']) || (body.limit !== undefined && (!Number.isInteger(body.limit) || Number(body.limit) < 1 || Number(body.limit) > 50))
          || (body.cursor !== undefined && (typeof body.cursor !== 'string' || body.cursor.length > 200))) return result(400, 'Invalid pagination.');
        const page = await ports.listAccounts(Number(body.limit ?? 25), typeof body.cursor === 'string' ? body.cursor : null);
        // Explicit projection: never return raw Auth users or editable metadata.
        return { status: 200, body: { accounts: page.accounts.map(account => ({
          id: account.id, email: account.email, fullName: account.fullName, role: account.role,
          active: account.active,
          invitationStatus: account.confirmedAt ? 'confirmed' : account.invitedAt ? 'invited' : 'unknown',
          emailDeliveryStatus: 'unknown',
        })), nextCursor: page.nextCursor } };
      }
      if (!['create', 'resend', 'recover'].includes(String(body.action))) return result(400, 'Unsupported action.');
      if (!policy.deliveryEnabled) return result(503, 'Account email operations are disabled.');
      if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(body.requestId)) return result(400, 'A valid request ID is required.');
      let command: MailCommand;
      if (body.action === 'create') {
        if (!only(body, ['action', 'requestId', 'email', 'fullName']) || typeof body.email !== 'string' || typeof body.fullName !== 'string'
          || !body.fullName.trim() || body.fullName.trim().length > 120) return result(400, 'Invalid account details.');
        command = { action: 'create', email: normalizeEmail(body.email), fullName: body.fullName.trim(), role: 'driver', redirectTo: `${betaOrigin}/update-password` };
      } else {
        if (!only(body, ['action', 'requestId', 'userId']) || typeof body.userId !== 'string' || !body.userId || body.userId.length > 128) return result(400, 'Invalid account request.');
        const account = await ports.getAccount(body.userId);
        if (!account) return result(404, 'Account not found.');
        if (!account.active) return result(409, 'Inactive accounts cannot receive account email.');
        if (body.action === 'resend' && account.confirmedAt) return result(409, 'Account is already confirmed. Use password recovery.');
        command = { action: body.action as 'resend' | 'recover', userId: account.id, email: normalizeEmail(account.email), redirectTo: `${betaOrigin}/update-password` };
      }
      if (!validEmail(command.email)) return result(400, 'Invalid email address.');
      if (!policy.testRecipients.some(email => normalizeEmail(email) === command.email)) return result(403, 'Recipient is not approved for beta testing.');
      if (!await ports.allowRequest(actor.id, command.email)) return result(429, 'Please try again later.');
      const fingerprint = JSON.stringify(command);
      const claim = await ports.claim(actor.id, body.requestId, fingerprint, command.email);
      if (claim.kind === 'replay') return claim.result;
      if (claim.kind !== 'acquired') return result(409, claim.kind === 'uncertain' ? 'Previous outcome is unknown. Reconcile before retrying.' : 'Request is already pending or conflicts with a previous request.');
      let response: Result;
      let state: 'complete' | 'retryable' | 'uncertain' = 'complete';
      try {
        // Recheck after any queue/lock wait, immediately before privileged work.
        const fresh = await authorize(bearer);
        if ('status' in fresh || fresh.id !== actor.id) response = 'status' in fresh ? fresh : result(401, 'Sign in again.');
        else {
          // Target identity/activity may also change during a queue/lock wait.
          const target = command.action === 'create' ? null : await ports.getAccount(command.userId);
          if (command.action !== 'create' && (!target || !target.active
            || normalizeEmail(target.email) !== command.email
            || (command.action === 'resend' && target.confirmedAt))) {
            response = result(409, 'Account changed. Refresh before requesting email.');
            await ports.finish(actor.id, body.requestId, response, 'complete');
            return response;
          }
          const outcome = await ports.perform(command, `${actor.id}:${body.requestId}`);
          response = outcome.kind === 'accepted'
            ? { status: 202, body: { requestId: body.requestId, emailRequestStatus: 'accepted', emailDeliveryStatus: 'unknown' } }
            : result(503, 'Email request was rejected. Delivery was not confirmed.');
          if (outcome.kind === 'rejected' && outcome.retryable) state = 'retryable';
        }
      } catch {
        state = 'uncertain';
        response = result(409, 'Request outcome is unknown. Reconcile before retrying.');
      }
      await ports.finish(actor.id, body.requestId, response, state);
      return response;
    } catch {
      // Includes persistence failure: never leak provider details or auto-retry.
      return result(503, 'Account service is unavailable. Check request status before retrying.');
    }
  };
}
