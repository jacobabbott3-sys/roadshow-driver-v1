import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isNativeApp } from '../lib/nativePlatform';
import { supabase } from '../lib/supabase';
export function NativeLifecycle() {
  const { refreshProfile } = useAuth();
  useEffect(() => {
    if (!isNativeApp()) return;
    // Capacitor 8.5 forwards the bridge's UIScene lifecycle to these events.
    const start = () => { void supabase.auth.startAutoRefresh(); };
    const pause = () => { void supabase.auth.stopAutoRefresh(); };
    const resume = () => { start(); void refreshProfile().finally(() => document.dispatchEvent(new Event('roadshow:profile-refreshed'))); };
    document.addEventListener('pause', pause);
    document.addEventListener('resume', resume);
    start();
    return () => {
      document.removeEventListener('pause', pause);
      document.removeEventListener('resume', resume);
      pause();
    };
  }, [refreshProfile]);
  return null;
}
