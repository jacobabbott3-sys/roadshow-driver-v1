/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_RELEASE_CHANNEL?: "beta" | "public";
  readonly VITE_RELEASE_VERSION?: string;
}

declare const __RELEASE_CHANNEL__: "beta" | "public";
declare const __APP_VERSION__: string;
