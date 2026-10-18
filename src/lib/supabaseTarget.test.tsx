import { afterEach, expect, it, vi } from 'vitest';
const mocked=vi.hoisted(()=>({createClient:vi.fn<(...args: unknown[]) => object>(()=>({}))}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocked.createClient}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();mocked.createClient.mockClear();});
for(const [url,allowed] of [['https://myraoovepjwhkafzdppq.supabase.co',false],['https://exsquwjtqnirojntoxqv.supabase.co',true]] as const){
 it(`stable beta browser ${allowed?'uses test':'refuses production'} client`,async()=>{
 vi.stubGlobal('window',{location:{hostname:'beta.roadshowdriver.com',hash:''}});
 vi.stubEnv('VITE_SUPABASE_URL',url);vi.stubEnv('VITE_SUPABASE_ANON_KEY','synthetic-key');
 const module=await import('./supabase');expect(module.isSupabaseConfigured).toBe(allowed);
 expect(mocked.createClient.mock.calls[0]?.[0]).toBe(allowed?url:'https://placeholder.supabase.co');
 });
}
