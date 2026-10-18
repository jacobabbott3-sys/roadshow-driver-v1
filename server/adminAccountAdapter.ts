import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Account, AccountPolicy, AccountPorts, Claim, Result } from './adminAccounts.ts';
const table = 'admin_account_operations';
const normalize = (value: string) => value.trim().toLowerCase();

export function createSupabaseAccountPorts(client: SupabaseClient, policy: AccountPolicy,
  config: { projectId: string; resendKey: string; from: string }, fetcher: typeof fetch = fetch): AccountPorts {
  async function profile(id: string) {
    const { data, error } = await client.from('profiles').select('id,full_name,role,is_active').eq('id', id).maybeSingle();
    if (error) throw new Error('Profile unavailable');
    return data;
  }
  async function account(user: User): Promise<Account> {
    const row = await profile(user.id);
    return { id: user.id, email: user.email ?? '', fullName: row?.full_name ?? null,
      role: row?.role === 'admin' ? 'admin' : 'driver', active: row?.is_active === true,
      invitedAt: user.invited_at ?? null, confirmedAt: user.email_confirmed_at ?? null };
  }
  return {
    projectId: config.projectId,
    verifySession: async token => {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      // getUser verifies the JWT against Auth, whose authenticated-user path
      // checks the referenced session. Require a real session claim too: legacy
      // or service/custom JWTs without session_id must not administer accounts.
      try {
        const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(atob(encoded));
        if (claims.sub !== data.user.id || claims.role !== 'authenticated'
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id ?? '')
          || claims.session_id === '00000000-0000-0000-0000-000000000000') return null;
        return { id: data.user.id };
      } catch { return null; }
    },
    getProfile: async id => { const row = await profile(id); return row ? { id: row.id, role: row.role, active: row.is_active } : null; },
    listAccounts: async (limit, cursor) => {
      const page = cursor === null ? 1 : Number(cursor);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('Invalid cursor');
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: limit });
      if (error) throw new Error('Account list unavailable');
      return { accounts: await Promise.all(data.users.map(account)), nextCursor: data.users.length === limit ? String(page + 1) : null };
    },
    getAccount: async id => {
      const { data, error } = await client.auth.admin.getUserById(id);
      if (error) { if (error.status === 404) return null; throw new Error('Account unavailable'); }
      return data.user ? account(data.user) : null;
    },
    // The claim's DB unique minute buckets enforce one operation/minute per actor
    // and recipient atomically. A preflight read/count alone is not a rate limit.
    allowRequest: async () => true,
    claim: async (actor, key, fingerprint, recipient): Promise<Claim> => {
      const { error } = await client.from(table).insert({ actor_id: actor, request_id: key, fingerprint, recipient, state: 'pending' });
      if (!error) return { kind: 'acquired' };
      if (error.code !== '23505') throw new Error('Request store unavailable');
      const { data, error: readError } = await client.from(table).select('fingerprint,state,response').eq('actor_id', actor).eq('request_id', key).maybeSingle();
      if (readError) throw new Error('Request store unavailable');
      if (!data) return { kind: 'busy' };
      if (data.fingerprint !== fingerprint) return { kind: 'conflict' };
      if (data.state === 'complete') return { kind: 'replay', result: data.response as Result };
      if (data.state === 'uncertain') return { kind: 'uncertain' };
      // This adapter conservatively never automatically retries mail. A known
      // rejection is terminal; a new explicit operation waits for the rate window.
      return { kind: 'busy' };
    },
    finish: async (actor, key, response, state) => {
      const { data, error } = await client.from(table).update({ response, state }).eq('actor_id', actor).eq('request_id', key).eq('state', 'pending').select('request_id');
      if (error || data?.length !== 1) throw new Error('Request outcome persistence failed');
    },
    perform: async (command, operationKey) => {
      if (!policy.enabled || !policy.deliveryEnabled || config.projectId !== policy.approvedBetaProjectId
        || config.projectId === 'myraoovepjwhkafzdppq' || !config.resendKey || !config.from
        || !policy.testRecipients.some(email => normalize(email) === command.email)
        || command.redirectTo !== 'https://beta.roadshowdriver.com/update-password') throw new Error('Mail disabled');
      let expectedUserId = command.action === 'create' ? '' : command.userId;
      if (command.action === 'create') {
        // Atomic Auth creation rejects existing addresses even if another writer
        // creates the same address concurrently. This does not send SMTP.
        const created = await client.auth.admin.createUser({ email: command.email, email_confirm: false, user_metadata: { full_name: command.fullName } });
        if (created.error) {
          if (created.error.status === 422) return { kind: 'rejected', retryable: false };
          throw new Error('Account creation outcome unavailable');
        }
        if (!created.data.user) throw new Error('Account creation outcome unavailable');
        expectedUserId = created.data.user.id;
        const createdProfile = await profile(expectedUserId);
        if (createdProfile?.role !== 'driver' || createdProfile.is_active !== true) throw new Error('New account profile requires review');
      }
      // generateLink does not send SMTP. Invite generation creates new users with
      // default profile role; no user_metadata role or privileged fields are passed.
      const type = command.action === 'recover' ? 'recovery' : 'invite';
      const { data, error } = await client.auth.admin.generateLink({ type, email: command.email,
        options: { redirectTo: command.redirectTo, ...(command.action === 'create' ? { data: { full_name: command.fullName } } : {}) } });
      if (error || !data.properties?.hashed_token || data.user?.id !== expectedUserId) throw new Error('Link outcome unavailable');
      // Never persist/log or return the bearer link. Build only a fixed app URL.
      const link = new URL('https://beta.roadshowdriver.com/auth/confirm');
      link.searchParams.set('token_hash', data.properties.hashed_token);
      link.searchParams.set('type', type);
      const sent = await fetcher('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify({ from: config.from, to: [command.email], subject: type === 'invite' ? 'Roadshow Driver invitation' : 'Roadshow Driver password recovery',
          text: `Open your secure Roadshow Driver account link:\n${link.toString()}\nIf you did not expect this email, contact your administrator.` }),
        signal: AbortSignal.timeout(15000) });
      if (sent.ok) return { kind: 'accepted' };
      // 5xx/timeout may follow provider acceptance. Never regenerate/retry blindly.
      if (sent.status >= 500 || sent.status === 408 || sent.status === 409) throw new Error('Mail outcome unknown');
      return { kind: 'rejected', retryable: false };
    },
  };
}
