import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(url && key)

// Supabase's default invite email confirms the user first, then returns the
// authenticated session to the Site URL with `type=invite` in the hash.
// Remember that signal before supabase-js consumes and clears the hash.
if (typeof window !== 'undefined') {
  const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (authHash.get('type') === 'invite') {
    sessionStorage.setItem('roadshow-auth-flow', 'invite')
    sessionStorage.setItem('roadshow-session-active', 'true')
  }
}
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
