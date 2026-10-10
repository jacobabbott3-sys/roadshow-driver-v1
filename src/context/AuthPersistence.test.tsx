import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({signOut:vi.fn().mockResolvedValue({error:null}),signIn:vi.fn().mockResolvedValue({error:null})}));
vi.mock('../lib/supabase',()=>({isSupabaseConfigured:true,supabase:{
 auth:{getSession:async()=>({data:{session:{user:{id:'fixture'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),signOut:mocks.signOut,signInWithPassword:mocks.signIn},
 from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'fixture',is_active:true,role:'driver'},error:null})})})})
}}));
import { AuthProvider, useAuth } from './AuthContext';
function Probe(){const auth=useAuth();return <><p>{auth.user ? 'Signed in':'Signed out'}</p><button onClick={()=>void auth.signOut()}>Sign out</button><button onClick={()=>void auth.signIn('fixture@example.test','fixture',false)}>Temporary login</button></>}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.clearAllMocks();});
it('retains a remembered session on cold launch',async()=>{
 localStorage.setItem('roadshow-stay-logged-in','true');render(<AuthProvider><Probe/></AuthProvider>);
 await screen.findByText('Signed in');expect(mocks.signOut).not.toHaveBeenCalled();
});
it('clears a temporary session after a cold launch',async()=>{
 localStorage.setItem('roadshow-stay-logged-in','false');render(<AuthProvider><Probe/></AuthProvider>);
 await waitFor(()=>expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'}));
 expect(screen.getByText('Signed out')).toBeVisible();
});
it('preserves an active temporary session and clears its marker on logout',async()=>{
 localStorage.setItem('roadshow-stay-logged-in','false');sessionStorage.setItem('roadshow-session-active','true');
 render(<AuthProvider><Probe/></AuthProvider>);await screen.findByText('Signed in');
 fireEvent.click(screen.getByRole('button',{name:'Sign out'}));
 await waitFor(()=>expect(mocks.signOut).toHaveBeenCalled());expect(sessionStorage.getItem('roadshow-session-active')).toBeNull();
});
