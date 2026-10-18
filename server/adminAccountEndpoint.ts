import type { SupabaseClient } from '@supabase/supabase-js';
import { createAccountService, type AccountPolicy } from './adminAccounts.ts';
import { createSupabaseAccountPorts } from './adminAccountAdapter.ts';
type Environment = (name: string) => string | undefined;
type ClientFactory = (url: string, key: string) => SupabaseClient;
const origin = 'https://beta.roadshowdriver.com';
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
  'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' };

export function createAccountEndpoint(env: Environment, makeClient: ClientFactory, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });
    if (request.headers.get('origin') !== origin) return reply(403, 'Origin not allowed.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'Method not allowed.');
    // Check activation/identity before constructing any privileged client.
    const projectId = env('ACCOUNT_BETA_PROJECT_ID') ?? '';
    const url = env('SUPABASE_URL') ?? '';
    if (env('ACCOUNT_MANAGEMENT_ENABLED') !== 'true' || !/^[a-z]{20}$/.test(projectId)
      || projectId === 'myraoovepjwhkafzdppq' || url !== `https://${projectId}.supabase.co`) return reply(503, 'Account management is disabled.');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) return reply(503, 'Account service is not configured.');
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ') || auth.length < 8) return reply(401, 'Sign in again.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, 'JSON required.');
    if (Number(request.headers.get('content-length') ?? '0') > 4096) return reply(413, 'Request too large.');
    try {
      // Bound streamed bodies too; Content-Length is not trustworthy.
      const reader = request.body?.getReader();
      if (!reader) return reply(400, 'Invalid request.');
      const chunks: Uint8Array[] = []; let length = 0;
      for (;;) { const { value, done } = await reader.read(); if (done) break;
        length += value.length; if (length > 4096) { await reader.cancel(); return reply(413, 'Request too large.'); } chunks.push(value); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let input: unknown;
      try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400, 'Invalid JSON.'); }
      const policy: AccountPolicy = { enabled: true, deliveryEnabled: env('ACCOUNT_MAIL_ENABLED') === 'true',
        approvedBetaProjectId: projectId, testRecipients: (env('ACCOUNT_TEST_RECIPIENTS') ?? '').split(',').map(value => value.trim()).filter(Boolean) };
      const ports = createSupabaseAccountPorts(makeClient(url, serviceKey), policy,
        { projectId, resendKey: env('ACCOUNT_RESEND_API_KEY') ?? '', from: env('ACCOUNT_MAIL_FROM') ?? '' }, fetcher);
      const result = await createAccountService(ports, policy)(auth.slice(7), input);
      return new Response(JSON.stringify(result.body), { status: result.status, headers });
    } catch { return reply(503, 'Account service unavailable. Check request status before retrying.'); }
  };
}
