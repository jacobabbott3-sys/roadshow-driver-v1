import type { SupabaseClient } from '@supabase/supabase-js';
import { singleTestShowName } from './noticeTypes.ts';
import type { SingleTestPin } from './singleTestPin.ts';
import { approvedTestInbox, canonicalRecipients, digest, type Notice, type Policy, type Ports, type Review } from './service.ts';
type Config = { projectId: string; approvedProjectId: string; apiKey: string; from: string };
export function createNoticePorts(client: SupabaseClient, policy: Policy, config: Config, fetcher: typeof fetch = fetch, pin: SingleTestPin | null = null): Ports {
  const legacyScope = `test:${policy.testRecipient.trim().toLowerCase()}`;
  const scopedSettings = policy.deliveryMode === 'approved-fixture-settings';
  const scope = scopedSettings ? 'test:approved-fixture-settings:v1' : legacyScope;
  const batchScope = 'test:approved-fixture-settings-batch:v1';
  const batchMarker = '__frozen_settings_batch__';
  const permittedRecipient = (notice: Notice, recipient: string) => scopedSettings
    ? notice.deliveryMode === 'approved-fixture-settings' && canonicalRecipients(notice.recipients).includes(recipient) && !(pin?.allowPriorShippingAccepted && notice.recipients.includes(approvedTestInbox))
    : recipient === approvedTestInbox;
  const payload = (notice: Notice, attachment: string, recipient: string) => ({ from: config.from, to: [recipient],
    subject: `[BETA TEST] ${notice.subject}`, text: notice.message,
    attachments: [{ filename: notice.attachmentName, content: attachment }] });
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
      const contract = await client.from('contracts').select('id,driver_id,current_agreement_id,cancelled_at,show_id').eq('id', contractId).single();
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
      const show = await client.from('shows').select('is_test,test_owner,created_by,name,cancelled_at').eq('id', contract.data.show_id).single();
      const contents = version.data.content;
      if (show.error || show.data.cancelled_at || contents?.work?.id !== contract.data.show_id
        || !Array.isArray(contents.linked_work) || contents.linked_work.length !== 0
        || !Array.isArray(contents.linked_show_ids) || contents.linked_show_ids.length !== 0)
        throw new Error('Only an unlinked synthetic beta fixture is eligible.');
      let testOwner = show.data.is_test === true ? show.data.test_owner : null;
      if (!testOwner) {
        if (!pin || pin.expiresAt <= Date.now() || pin.contractId !== contractId || pin.versionId !== version.data.id
          || show.data.is_test !== false || show.data.test_owner || (show.data.created_by !== null && show.data.created_by !== pin.actorId)
          || contract.data.driver_id !== pin.actorId || show.data.name !== singleTestShowName || contents.work.name !== singleTestShowName
          || signatures.data.length !== 2 || signatures.data.some(s => s.signer_id !== pin.actorId))
          throw new Error('Only the exact explicitly pinned fictional fixture is eligible.');
        const [released, otherDrivers, external] = await Promise.all([
          client.from('availability_release_item_shows').select('show_id').eq('show_id', contract.data.show_id).limit(1),
          client.from('contract_drivers').select('driver_id').eq('contract_id', contractId).neq('driver_id', pin.actorId).limit(1),
          client.from('contract_external_assignees').select('contract_id').eq('contract_id', contractId).limit(1),
        ]);
        if ([released, otherDrivers, external].some(check => check.error || !check.data || check.data.length > 0))
          throw new Error('The pinned fixture was published or assigned outside the test.');
        testOwner = pin.actorId;
      }
      const current = await client.from('contracts').select('current_agreement_id,cancelled_at,driver_id').eq('id', contractId).single();
      if (current.error || (!show.data.is_test && current.data.driver_id !== testOwner)) throw new Error('Current agreement unavailable');
      return { contractId, currentVersionId: current.data.current_agreement_id, versionId: version.data.id, versionNumber: version.data.version_number,
        contents, testOwner, cancelled: !!current.data.cancelled_at,
        driverEligible, signatures: signatures.data.map(s => ({ id: s.id, versionId: s.version_id, role: s.signer_role, name: s.signer_name, signedAt: s.signed_at })) };
    },
    settings: async () => {
      const { data, error } = await client.from('contract_notice_settings').select('recipients,revision').eq('singleton', true).single();
      if (error || !Number.isInteger(data.revision)) throw new Error('Recipient settings unavailable.');
      return { recipients: canonicalRecipients(data.recipients), revision: data.revision };
    },
    saveSettings: async (settings, actorId) => {
      const { data, error } = await client.rpc('save_contract_notice_settings', {
        expected_revision: settings.revision, new_recipients: canonicalRecipients(settings.recipients), actor: actorId,
      });
      if (error || (data !== null && !Number.isInteger(data))) throw new Error('Recipient settings unavailable.');
      return data;
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
      if (!permittedRecipient(notice, recipient)) return 'blocked';
      // Legacy delivery rows could label admins/accounting even though actual To was Shipping.
      // Never reinterpret or replay them for a newly scoped multi-destination test.
      let history = client.from('contract_notice_deliveries').select('recipient,state').eq('environment_scope', legacyScope)
        .eq('version_id', notice.versionId);
      if (!scopedSettings) history = history.neq('recipient', approvedTestInbox);
      const legacy = await history.limit(2);
      if (legacy.error) throw new Error('Delivery history unavailable.');
      if (pin?.allowPriorShippingAccepted && scopedSettings) {
        if (legacy.data.length !== 1 || legacy.data[0].recipient !== approvedTestInbox || legacy.data[0].state !== 'accepted')
          return 'blocked';
      } else if (legacy.data.length !== 0) return 'blocked';
      if (scopedSettings) {
        // Freeze the first explicitly confirmed batch per version across all
        // requests. A settings edit cannot grow the lifetime 7-address limit.
        const payloadHash = await digest(notice.recipients);
        const lock = await client.from('contract_notice_deliveries').insert({
          environment_scope: batchScope, version_id: notice.versionId, recipient: batchMarker,
          payload_hash: payloadHash, state: 'accepted',
        });
        if (lock.error?.code === '23505') {
          const prior = await client.from('contract_notice_deliveries').select('payload_hash,state')
            .eq('environment_scope', batchScope).eq('version_id', notice.versionId).eq('recipient', batchMarker).maybeSingle();
          if (prior.error || prior.data?.payload_hash !== payloadHash || prior.data.state !== 'accepted') return 'blocked';
        } else if (lock.error) throw new Error('Could not freeze destinations.');
      }
      const hash = await digest(scopedSettings
        ? [config.from, recipient, notice.subject, notice.message, notice.attachmentName, notice.attachmentDigest]
        : [config.from, notice.subject, notice.message, notice.attachmentName, notice.attachmentDigest]);
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
    send: async (notice, recipient, attachment, actorId) => {
      // Only the explicitly armed fictional beta fixture may use the
      // reviewed Settings destinations, one envelope at a time.
      if (!policy.enabled || !policy.mailEnabled || !config.apiKey || !config.from
        || config.projectId !== config.approvedProjectId || config.projectId === 'myraoovepjwhkafzdppq'
        || notice.testRecipient !== approvedTestInbox
        || policy.testRecipient.trim().toLowerCase() !== approvedTestInbox
        || !permittedRecipient(notice, recipient) || (scopedSettings && (!pin || !policy.permitsTest)) || !attachment || await digest(attachment) !== notice.attachmentDigest
        || (policy.permitsTest && (!actorId || !await policy.permitsTest(notice, actorId, Date.now())))) throw new Error('Mail disabled');
      const key = await digest([scope, notice.versionId, recipient]);
      const sent = await fetcher('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `contract-notice-${key}` },
        body: JSON.stringify(payload(notice, attachment, recipient)), signal: AbortSignal.timeout(15000) });
      if (sent.ok) return 'accepted';
      if (sent.status >= 500 || [408, 409].includes(sent.status)) throw new Error('Provider outcome unknown');
      return 'rejected';
    },
  };
}
