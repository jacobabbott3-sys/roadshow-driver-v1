import { browserTargetAllowed } from './betaTarget'
import { passwordFlow } from './authFlow'
import { createClient } from '@supabase/supabase-js'
const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const allowed = browserTargetAllowed(typeof window === 'undefined' ? '' : window.location.hostname, configuredUrl)
const url = allowed ? configuredUrl : undefined
const key = allowed ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined
export const isSupabaseConfigured = Boolean(url && key)

// Supabase email links can return invitation or recovery sessions in the hash.
// Remember that signal before supabase-js consumes and clears the hash.
if (typeof window !== 'undefined') {
  const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const flow = passwordFlow(authHash.get('type'))
  if (flow) {
    sessionStorage.setItem('roadshow-auth-flow', flow)
    sessionStorage.setItem('roadshow-session-active', 'true')
  }
}
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
