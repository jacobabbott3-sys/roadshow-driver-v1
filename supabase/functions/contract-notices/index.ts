import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createContractNoticeEndpoint } from '../../../server/contract-notices/endpoint.ts';
// No webhook, timer or database-trigger entrypoint. Explicit human requests only.
// Staged beta deployment hold: environment values cannot enable this endpoint.
// Remove only in a separately reviewed activation change after setup acceptance.
const heldFlags = new Set(['CONTRACT_NOTICE_ENABLED', 'CONTRACT_NOTICE_MAIL_ENABLED']);
Deno.serve(createContractNoticeEndpoint(name => heldFlags.has(name) ? 'false' : Deno.env.get(name), (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })));
