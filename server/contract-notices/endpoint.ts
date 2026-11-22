import type { SupabaseClient } from '@supabase/supabase-js';
import { approvedTestInbox, createNoticeService, type Policy } from './service.ts';
import { createNoticePorts } from './adapter.ts';
import { matchesSingleTestPin, parseSingleTestPin } from './singleTestPin.ts';
import { singleTestActivation } from './singleTestActivation.ts';
const origin = 'https://beta.roadshowdriver.com';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
  'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function createContractNoticeEndpoint(env: (name: string) => string | undefined, makeClient: (url: string, key: string) => SupabaseClient, fetcher: typeof fetch = fetch, activation = singleTestActivation) {
  return async (request: Request) => {
    const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });
    if (request.headers.get('origin') !== origin) return reply(403, 'Origin not allowed.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'Method not allowed.');
    const project = env('CONTRACT_NOTICE_BETA_PROJECT_ID') ?? '';
    if (env('CONTRACT_NOTICE_ENABLED') !== 'true' || project !== 'exsquwjtqnirojntoxqv'
      || env('SUPABASE_URL') !== `https://${project}.supabase.co`) return reply(503, 'Contract email is disabled.');
    const secret = env('SUPABASE_SERVICE_ROLE_KEY'), bearer = request.headers.get('authorization');
    if (!secret) return reply(503, 'Notice service is not configured.');
    if (!bearer?.startsWith('Bearer ')) return reply(401, 'Sign in again.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, 'JSON required.');
    try {
      const reader = request.body?.getReader(); if (!reader) return reply(400, 'Invalid request.');
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
        if (size > 20000) { await reader.cancel(); return reply(413, 'Request too large.'); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
      let input: unknown; try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return reply(400, 'Invalid JSON.'); }
      // The old environment mail flag cannot arm sending. A manually approved
      // activation binds one exact fictional signed receipt and reviewed body.
      const pin = parseSingleTestPin(activation, Date.now());
      const testRecipient = env('CONTRACT_NOTICE_TEST_INBOX') ?? '';
      const apiKey = env('CONTRACT_NOTICE_RESEND_API_KEY') ?? '';
      const from = env('CONTRACT_NOTICE_FROM') ?? '';
      const policy: Policy = { enabled: true, mailEnabled: pin !== null && !!apiKey && !!from && testRecipient.trim().toLowerCase() === approvedTestInbox, testRecipient,
        isPinnedTarget: (contractId, actorId) => !!pin && pin.contractId === contractId && pin.actorId === actorId,
        permitsTest: (notice, actor, now) => pin ? matchesSingleTestPin(pin, notice, actor, now) : Promise.resolve(false) };
      const ports = createNoticePorts(makeClient(`https://${project}.supabase.co`, secret), policy,
        { projectId: project, approvedProjectId: project, apiKey, from }, fetcher, pin);
      const result = await createNoticeService(ports, policy)(bearer.slice(7), input);
      return new Response(JSON.stringify(result.body), { status: result.status, headers });
    } catch { return reply(503, 'Notice service unavailable. Check request history before retrying.'); }
  };
}
