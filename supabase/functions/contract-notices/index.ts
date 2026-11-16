import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createContractNoticeEndpoint } from '../../../server/contract-notices/endpoint.ts';
// No webhook, timer or database-trigger entrypoint. Explicit human requests only.
// Activation remains default-off and isolated-beta-only in the endpoint.
Deno.serve(createContractNoticeEndpoint(name => Deno.env.get(name), (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })));
