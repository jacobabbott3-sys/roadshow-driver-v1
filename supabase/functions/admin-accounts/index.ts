import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createAccountEndpoint } from '../../../server/adminAccountEndpoint.ts';

// Deploy only after separate approval. Flags default off; no client is created
// until the endpoint validates activation and the isolated beta project identity.
// Staged beta deployment hold: environment values cannot enable this endpoint.
// Remove only in a separately reviewed activation change after setup acceptance.
const heldFlags = new Set(['ACCOUNT_MANAGEMENT_ENABLED', 'ACCOUNT_MAIL_ENABLED']);
Deno.serve(createAccountEndpoint(name => heldFlags.has(name) ? 'false' : Deno.env.get(name), (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })));
