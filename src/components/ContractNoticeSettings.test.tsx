import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContractNoticeSettings } from './ContractNoticeSettings';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),auth:{session:{access_token:'session'},profile:{role:'admin',is_active:true}}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>mocks.auth}));
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
beforeEach(()=>{vi.stubEnv('VITE_CONTRACT_NOTICE_ENABLED','true');mocks.auth.profile.role='admin';mocks.invoke.mockReset();});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('active admin loads and saves defaults explicitly without sending',async()=>{
 mocks.invoke.mockResolvedValueOnce({data:{settings:{recipients:['accounting@havenlight.com'],revision:0},message:'Loaded'}})
   .mockResolvedValueOnce({data:{settings:{recipients:['finance@example.net'],revision:1},message:'Saved'}});
 render(<ContractNoticeSettings />);
 expect(mocks.invoke).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Edit default recipients'}));
 const text=await screen.findByRole('textbox');expect((text as HTMLTextAreaElement).value).toBe('accounting@havenlight.com');
 fireEvent.change(text,{target:{value:'finance@example.net'}});
 fireEvent.click(screen.getByRole('button',{name:'Save defaults'}));
 await screen.findByText('Saved');
 expect(mocks.invoke.mock.calls).toEqual([['contract-notices',{body:{action:'settings-get'}}],['contract-notices',{body:{action:'settings-save',revision:0,recipients:['finance@example.net']}}]]);
});
it('driver cannot access recipient settings',()=>{
 mocks.auth.profile.role='driver';render(<ContractNoticeSettings />);expect(screen.queryByRole('button')).toBeNull();expect(mocks.invoke).not.toHaveBeenCalled();
});
