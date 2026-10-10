import { expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({error:'Invalid native configuration',create:vi.fn()}));
vi.mock('./nativeRuntime',()=>({get nativeConfigurationError(){return mocks.error}}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.create}));
it('does not construct a client when native validation fails',async()=>{
 await expect(import('./supabase')).rejects.toThrow('Invalid native configuration');
 expect(mocks.create).not.toHaveBeenCalled();
});
