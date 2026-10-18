import type { SupabaseClient } from '@supabase/supabase-js';
import { digest, type Notice, type Policy, type Ports, type Review } from './service.ts';
type Config = { projectId: string; approvedProjectId: string; apiKey: string; from: string };
export function createNoticePorts(client: SupabaseClient, policy: Policy, config: Config, fetcher: typeof fetch = fetch): Ports {
  const scope = `test:${policy.testRecipient.trim().toLowerCase()}`;
  const payload = (notice: Notice, recipient: string) => ({ from: config.from, to: [notice.testRecipient],
    subject: `[BETA TEST] ${notice.subject}`, text: `TEST ONLY — intended recipient: ${recipient}\n\n${notice.message}` });
  const matchingDelivery = (notice: Notice, recipient: string) => client.from('contract_notice_deliveries')
    .select('state,payload_hash').eq('environment_scope', scope).eq('version_id', notice.versionId).eq('recipient', recipient).maybeSingle();
  return {
    authorize: async token => {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      try {
        const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (claims.sub !== data.user.id || claims.role !== 'authenticated'
          || !/^[0-9a-f-]{36}$/i.test(claims.session_id ?? '') || claims.session_id === '00000000-0000-0000-0000-000000000000') return null;
      } catch { return null; }
      const { data: profile, error: denied } = await client.from('profiles').select('id,role,is_active').eq('id', data.user.id).maybeSingle();
      return !denied && profile?.is_active === true && profile.role === 'admin' ? profile.id : null;
    },
    snapshot: async contractId => {
      // SELECT-only inventory of existing evidence. Do not call agreement review
      // RPCs here: some historical read paths can issue an initial agreement.
      const contract = await client.from('contracts').select('id,driver_id,current_agreement_id,cancelled_at').eq('id', contractId).single();
      if (contract.error || !contract.data.current_agreement_id) throw new Error('Current agreement unavailable');
      const version = await client.from('agreement_versions').select('id,contract_id,version_number,content').eq('id', contract.data.current_agreement_id).eq('contract_id', contractId).single();
      const signatures = await client.from('agreement_signatures').select('id,version_id,signer_id,signer_role,assignment_period_id,signer_name,signed_at').eq('version_id', contract.data.current_agreement_id);
      if (version.error || signatures.error) throw new Error('Agreement evidence unavailable');
      const driver = signatures.data.find(s => s.signer_role === 'driver');
      let driverEligible = false;
      if (driver?.assignment_period_id) {
        const period = await client.from('agreement_assignment_periods').select('id').eq('id', driver.assignment_period_id).eq('contract_id', contractId).eq('driver_id', driver.signer_id).is('ended_at', null).maybeSingle();
        const roster = await client.from('contract_drivers').select('driver_id').eq('contract_id', contractId).eq('driver_id', driver.signer_id).maybeSingle();
        if (period.error || roster.error) throw new Error('Assignment evidence unavailable');
        driverEligible = !!period.data && (contract.data.driver_id === driver.signer_id || !!roster.data);
      }
      const current = await client.from('contracts').select('current_agreement_id,cancelled_at').eq('id', contractId).single();
      if (current.error) throw new Error('Current agreement unavailable');
      return { contractId, currentVersionId: current.data.current_agreement_id, versionId: version.data.id, versionNumber: version.data.version_number,
        workLabel: String(version.data.content?.work?.name ?? `Contract ${contractId}`), cancelled: !!current.data.cancelled_at,
        driverEligible, signatures: signatures.data.map(s => ({ id: s.id, versionId: s.version_id, role: s.signer_role, name: s.signer_name, signedAt: s.signed_at })) };
    },
    admins: async () => {
      const { data, error } = await client.from('profiles').select('id').eq('role', 'admin').eq('is_active', true).limit(101);
      if (error || data.length > 100) throw new Error('Admin recipient list unavailable');
      return Promise.all(data.map(async profile => {
        const account = await client.auth.admin.getUserById(profile.id);
        if (account.error || !account.data.user.email) throw new Error('Admin email unavailable');
        return { email: account.data.user.email, active: true };
      }));
    },
    saveReview: async review => {
      const { error } = await client.from('contract_notice_reviews').insert({ id: review.id, actor_id: review.actorId, expires_at: review.expiresAt, notice: review.notice, state: 'reviewed' });
      if (error) throw new Error('Review unavailable');
    },
    getReview: async id => {
      const { data, error } = await client.from('contract_notice_reviews').select('id,actor_id,expires_at,notice,state').eq('id', id).maybeSingle();
      if (error) throw new Error('Review unavailable');
      return data ? { id: data.id, actorId: data.actor_id, expiresAt: Number(data.expires_at), notice: data.notice, state: data.state } as Review : null;
    },
    decideReview: async (id, actorId, state) => {
      const { data, error } = await client.from('contract_notice_reviews').update({ state }).eq('id', id).eq('actor_id', actorId).eq('state', 'reviewed').select('id');
      if (error) throw new Error('Review unavailable'); return data.length === 1;
    },
    finishReview: async (id, state) => {
      const { data, error } = await client.from('contract_notice_reviews').update({ state }).eq('id', id).eq('state', 'sending').select('id');
      if (error || data.length !== 1) throw new Error('Review result unavailable');
    },
    claimDelivery: async (notice, recipient) => {
      const hash = await digest(payload(notice, recipient));
      const { error } = await client.from('contract_notice_deliveries').insert({ environment_scope: scope, version_id: notice.versionId, recipient, payload_hash: hash, state: 'pending' });
      if (!error) return 'acquired'; if (error.code !== '23505') throw new Error('Delivery ledger unavailable');
      const prior = await matchingDelivery(notice, recipient);
      if (prior.error || !prior.data || prior.data.payload_hash !== hash) return 'blocked';
      if (prior.data.state === 'accepted') return 'accepted';
      if (prior.data.state !== 'rejected') return 'blocked';
      const retried = await client.from('contract_notice_deliveries').update({ state: 'pending', updated_at: new Date().toISOString() })
        .eq('environment_scope', scope).eq('version_id', notice.versionId).eq('recipient', recipient).eq('payload_hash', hash).eq('state', 'rejected').select('recipient');
      if (retried.error) throw new Error('Delivery ledger unavailable');
      return retried.data.length === 1 ? 'acquired' : 'blocked';
    },
    finishDelivery: async (notice, recipient, state) => {
      const { data, error } = await client.from('contract_notice_deliveries').update({ state, updated_at: new Date().toISOString() })
        .eq('environment_scope', scope).eq('version_id', notice.versionId).eq('recipient', recipient).eq('state', 'pending').select('recipient');
      if (error || data.length !== 1) throw new Error('Delivery outcome unavailable');
    },
    send: async (notice, recipient) => {
      // This increment has NO live-recipient mode. Every send targets the separate
      // test inbox shown during confirmation; actual admin/accounting addresses
      // appear only as intended recipients in the review and test message.
      if (!policy.enabled || !policy.mailEnabled || !config.apiKey || !config.from
        || config.projectId !== config.approvedProjectId || config.projectId === 'myraoovepjwhkafzdppq'
        || notice.testRecipient !== policy.testRecipient.trim().toLowerCase()
        || notice.recipients.includes(notice.testRecipient) || !notice.recipients.includes(recipient)) throw new Error('Mail disabled');
      const key = await digest([scope, notice.versionId, recipient]);
      const sent = await fetcher('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `contract-notice-${key}` },
        body: JSON.stringify(payload(notice, recipient)), signal: AbortSignal.timeout(15000) });
      if (sent.ok) return 'accepted';
      if (sent.status >= 500 || [408, 409].includes(sent.status)) throw new Error('Provider outcome unknown');
      return 'rejected';
    },
  };
}
