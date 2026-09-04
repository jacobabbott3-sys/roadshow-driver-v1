import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { ColorScheme, Profile, ThemePreference } from "../types";

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string, stayLoggedIn: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateAppearance: (theme: ThemePreference, color: ColorScheme, extremeConfetti: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function applyAppearance(theme: ThemePreference, color: ColorScheme) {
  const dark = theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.accent = color;
  localStorage.setItem("roadshow-theme", theme);
  localStorage.setItem("roadshow-color-scheme", color);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url,phone,role,is_active,theme_preference,color_scheme,extreme_confetti")
      .eq("id", session.user.id)
      .single();
    if (profileError) setError("We could not load your profile. Please try again.");
    else setProfile(data as Profile);
  }, [session?.user]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      const temporary = localStorage.getItem("roadshow-stay-logged-in") === "false";
      const activeTab = sessionStorage.getItem("roadshow-session-active") === "true";
      if (data.session && temporary && !activeTab) {
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
      } else {
        setSession(data.session);
        if (data.session) sessionStorage.setItem("roadshow-session-active", "true");
      }
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(true);
    void refreshProfile().finally(() => setLoading(false));
  }, [refreshProfile]);

  useEffect(() => {
    const theme = profile?.theme_preference ||
      (localStorage.getItem("roadshow-theme") as ThemePreference | null) || "light";
    const color = profile?.color_scheme ||
      (localStorage.getItem("roadshow-color-scheme") as ColorScheme | null) || "forest";
    applyAppearance(theme, color);
  }, [profile?.theme_preference, profile?.color_scheme]);

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    error,
    signIn: async (email, password, stayLoggedIn) => {
      setError(null);
      localStorage.setItem("roadshow-stay-logged-in", String(stayLoggedIn));
      sessionStorage.setItem("roadshow-session-active", "true");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    },
    signOut: async () => {
      sessionStorage.removeItem("roadshow-session-active");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    resetPassword: async (email) => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (resetError) throw resetError;
    },
    refreshProfile,
    updateAppearance: async (theme, color, extremeConfetti) => {
      applyAppearance(theme, color);
      if (!session?.user) return;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ theme_preference: theme, color_scheme: color, extreme_confetti: extremeConfetti, updated_at: new Date().toISOString() })
        .eq("id", session.user.id);
      if (updateError) throw updateError;
      await refreshProfile();
    },
  }), [session, profile, loading, error, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
