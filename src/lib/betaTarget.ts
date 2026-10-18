export const betaSupabaseUrl = 'https://exsquwjtqnirojntoxqv.supabase.co';
export function assertBetaBuildTarget(branch: string, channel: string, url: string | undefined) {
  if ((branch === 'beta' || channel === 'beta') && url !== betaSupabaseUrl) {
    throw new Error('Beta requires the existing test Supabase project exsquwjtqnirojntoxqv. Correct the beta-scoped build configuration before deploying.');
  }
}
export function browserTargetAllowed(hostname: string, url: string | undefined) {
  return hostname !== 'beta.roadshowdriver.com' || url === betaSupabaseUrl;
}
