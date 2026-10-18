import type { SupabaseClient } from '@supabase/supabase-js';
import { createNoticeService, type Policy } from './service.ts';
import { createNoticePorts } from './adapter.ts';
const origin = 'https://beta.roadshowdriver.com';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
  'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function createContractNoticeEndpoint(env: (name: string) => string | undefined, makeClient: (url: string, key: string) => SupabaseClient, fetcher: typeof fetch = fetch) {
  return async (request: Request) => {
    const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });
    if (request.headers.get('origin') !== origin) return reply(403, 'Origin not allowed.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'Method not allowed.');
    const project = env('CONTRACT_NOTICE_BETA_PROJECT_ID') ?? '';
    if (env('CONTRACT_NOTICE_ENABLED') !== 'true' || !/^[a-z]{20}$/.test(project) || project === 'myraoovepjwhkafzdppq'
      || env('SUPABASE_URL') !== `https://${project}.supabase.co`) return reply(503, 'Contract email is disabled.');
    const secret = env('SUPABASE_SERVICE_ROLE_KEY'), bearer = request.headers.get('authorization');
    if (!secret) return reply(503, 'Notice service is not configured.');
    if (!bearer?.startsWith('Bearer ')) return reply(401, 'Sign in again.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, 'JSON required.');
    try {
      const reader = request.body?.getReader(); if (!reader) return reply(400, 'Invalid request.');
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length;
        if (size > 2048) { await reader.cancel(); return reply(413, 'Request too large.'); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
      let input: unknown; try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400, 'Invalid JSON.'); }
      const policy: Policy = { enabled: true, mailEnabled: env('CONTRACT_NOTICE_MAIL_ENABLED') === 'true', testRecipient: env('CONTRACT_NOTICE_TEST_INBOX') ?? '' };
      const ports = createNoticePorts(makeClient(`https://${project}.supabase.co`, secret), policy,
        { projectId: project, approvedProjectId: project, apiKey: env('CONTRACT_NOTICE_RESEND_API_KEY') ?? '', from: env('CONTRACT_NOTICE_FROM') ?? '' }, fetcher);
      const result = await createNoticeService(ports, policy)(bearer.slice(7), input);
      return new Response(JSON.stringify(result.body), { status: result.status, headers });
    } catch { return reply(503, 'Notice service unavailable. Check request history before retrying.'); }
  };
}
