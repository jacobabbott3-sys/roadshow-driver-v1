import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../types'
type AuthValue = { session: Session | null; user: User | null; profile: Profile | null; loading: boolean; error: string | null; signIn: (email:string,password:string)=>Promise<void>; signOut:()=>Promise<void>; resetPassword:(email:string)=>Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [profile, setProfile] = useState<Profile | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!isSupabaseConfigured) { setLoading(false); return }; supabase.auth.getSession().then(({ data, error }) => { if (error) setError(error.message); setSession(data.session) }); const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next)); return () => data.subscription.unsubscribe() }, [])
  useEffect(() => { async function loadProfile() { if (!session?.user) { setProfile(null); setLoading(false); return }; setLoading(true); const { data, error } = await supabase.from('profiles').select('id,full_name,avatar_url,role,is_active').eq('id', session.user.id).single(); if (error) setError('We could not load your profile. Please try again.'); else setProfile(data as Profile); setLoading(false) }; void loadProfile() }, [session])
  const value = useMemo<AuthValue>(() => ({ session, user: session?.user ?? null, profile, loading, error, signIn: async (email,password) => { setError(null); const { error } = await supabase.auth.signInWithPassword({email,password}); if(error) throw error }, signOut: async () => { const { error } = await supabase.auth.signOut(); if(error) throw error }, resetPassword: async email => { const { error } = await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/update-password`}); if(error) throw error } }), [session, profile, loading, error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const ctx = useContext(AuthContext); if(!ctx) throw new Error('useAuth must be used inside AuthProvider'); return ctx }
