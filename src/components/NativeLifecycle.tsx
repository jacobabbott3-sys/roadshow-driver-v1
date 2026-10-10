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
    const resume = () => { start(); active(); };
    // Unlike Capacitor's foreground event, this also covers Control Center and alerts.
    let alive = true;
    let refreshing = false;
    const active = () => {
      if (refreshing) return;
      refreshing = true;
      void refreshProfile().finally(() => { refreshing = false; if (alive) document.dispatchEvent(new Event('roadshow:profile-refreshed')); });
    };
    document.addEventListener('roadshow:native-active', active);
    document.addEventListener('pause', pause);
    document.addEventListener('resume', resume);
    start();
    return () => {
      alive = false;
      document.removeEventListener('roadshow:native-active', active);
      document.removeEventListener('pause', pause);
      document.removeEventListener('resume', resume);
      pause();
    };
  }, [refreshProfile]);
  return null;
}
