export type NativeConfig = { url: string; key: string; channel: string; version: string };
export const PUBLIC_SUPABASE_URL = 'https://myraoovepjwhkafzdppq.supabase.co';
export function validateNativeConfig(config: NativeConfig): string | null {
  if (config.url !== PUBLIC_SUPABASE_URL) return 'This iPhone build is not configured for Roadshow Driver. Rebuild with the public app configuration.';
  if (config.channel !== 'public' || config.version !== '5') return 'This iPhone build requires the Public 5 release configuration.';
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) return null;
  try {
    const parts = config.key.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
    const decode = (value: string) => JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')));
    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    if (header.alg === 'HS256' && payload.role === 'anon' && payload.ref === 'myraoovepjwhkafzdppq') return null;
  } catch { /* Only sanitized errors may leave configuration validation. */ }
  return 'This iPhone build requires a public client key for Roadshow Driver.';
}
