import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { createAccountEndpoint } from '../../../server/adminAccountEndpoint.ts';

// Deploy only after separate approval. Flags default off; no client is created
// until the endpoint validates activation and the isolated beta project identity.
Deno.serve(createAccountEndpoint(name => Deno.env.get(name), (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })));
