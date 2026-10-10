import { isNativeApp } from './nativePlatform';
import { validateNativeConfig } from './nativeConfig';
export const nativeConfigurationError = isNativeApp() ? validateNativeConfig({
  url: import.meta.env.VITE_SUPABASE_URL || '', key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  channel: __RELEASE_CHANNEL__, version: __APP_VERSION__,
}) : null;
