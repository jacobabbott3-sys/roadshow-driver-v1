import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({native:true,start:vi.fn(),stop:vi.fn(),profile:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../lib/nativePlatform',()=>({isNativeApp:()=>mocks.native,openExternalUrl:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{startAutoRefresh:mocks.start,stopAutoRefresh:mocks.stop}}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({refreshProfile:mocks.profile})}));
import { NativeLifecycle } from './NativeLifecycle';
beforeEach(()=>{vi.clearAllMocks();mocks.native=true;});
it('refreshes on native scene resume and cleans up listeners',async()=>{
 const view=render(<NativeLifecycle/>);
 expect(mocks.start).toHaveBeenCalledOnce();
 act(()=>document.dispatchEvent(new Event('pause')));expect(mocks.stop).toHaveBeenCalledOnce();
 act(()=>document.dispatchEvent(new Event('resume')));
 expect(mocks.profile).toHaveBeenCalledOnce();
 act(()=>document.dispatchEvent(new Event('roadshow:native-active')));
 await waitFor(()=>expect(mocks.profile).toHaveBeenCalledOnce());
 expect(mocks.start).toHaveBeenCalledTimes(2);
 view.unmount();const count=mocks.start.mock.calls.length;
 act(()=>document.dispatchEvent(new Event('resume')));expect(mocks.start).toHaveBeenCalledTimes(count);
});
it('leaves web session lifecycle unchanged',()=>{
 mocks.native=false;const view=render(<NativeLifecycle/>);
 act(()=>document.dispatchEvent(new Event('resume')));view.unmount();
 expect(mocks.start).not.toHaveBeenCalled();expect(mocks.stop).not.toHaveBeenCalled();expect(mocks.profile).not.toHaveBeenCalled();
});

it('reverifies after temporary inactivity without requiring a background transition',async()=>{render(<NativeLifecycle/>);act(()=>document.dispatchEvent(new Event('roadshow:native-active')));await waitFor(()=>expect(mocks.profile).toHaveBeenCalledOnce());});
