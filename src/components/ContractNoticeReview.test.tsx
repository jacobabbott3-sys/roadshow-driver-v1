import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContractNoticeReview } from './ContractNoticeReview';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),auth:{session:{access_token:'session-one'},profile:{role:'admin',is_active:true}}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>mocks.auth}));
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
const preview={reviewId:'r',expiresAt:Date.now()+600000,mailEnabled:true,notice:{recipients:['admin@example.com','accounting@havenlight.com'],testRecipient:'test@example.net',subject:'Signed version 1',message:'Informational only. Not payment authorization.'}};
beforeEach(()=>{vi.stubEnv('VITE_CONTRACT_NOTICE_ENABLED','true');mocks.auth.session.access_token='session-one';mocks.invoke.mockReset();mocks.invoke.mockResolvedValue({data:preview,error:null});});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
it('default off and mounting never request delivery',()=>{vi.stubEnv('VITE_CONTRACT_NOTICE_ENABLED','false');render(<ContractNoticeReview contractId="c"/>);expect(screen.queryByRole('button')).toBeNull();expect(mocks.invoke).not.toHaveBeenCalled();});
it('explicit review displays recipients, actual test destination and message before Send',async()=>{
 render(<ContractNoticeReview contractId="c"/>);expect(mocks.invoke).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Review signed-contract email'));await screen.findByRole('dialog');expect(screen.getByText(/actual destination: test@example.net/)).toBeTruthy();expect(screen.getByText(/Intended recipients:/).textContent).toContain('accounting@havenlight.com');expect(screen.getByText(preview.notice.message)).toBeTruthy();expect(mocks.invoke).toHaveBeenCalledTimes(1);
 mocks.invoke.mockResolvedValue({data:{message:'Accepted'},error:null});fireEvent.click(screen.getByText('Send test email'));await screen.findByText('Accepted');expect(mocks.invoke).toHaveBeenLastCalledWith('contract-notices',{body:{action:'send',reviewId:'r',confirmed:true}});
});
for(const [label,action] of [['Skip','skip'],['Send later','later']])it(`${label} records only the decision`,async()=>{
 render(<ContractNoticeReview contractId="c"/>);fireEvent.click(screen.getByText('Review signed-contract email'));await screen.findByRole('dialog');mocks.invoke.mockResolvedValue({data:{message:'Nothing sent or queued'},error:null});fireEvent.click(screen.getByText(label));await screen.findByText('Nothing sent or queued');expect(mocks.invoke).toHaveBeenLastCalledWith('contract-notices',{body:{action,reviewId:'r'}});
});
it('blocks duplicate pending requests and requires new review after failure',async()=>{
 let resolve!:(value:unknown)=>void;mocks.invoke.mockReturnValue(new Promise(r=>resolve=r));render(<ContractNoticeReview contractId="c"/>);const button=screen.getByText('Review signed-contract email');fireEvent.click(button);fireEvent.click(button);expect(mocks.invoke).toHaveBeenCalledTimes(1);resolve({error:Error('stale')});await screen.findByRole('status');expect(screen.queryByRole('dialog')).toBeNull();
});
it('new session discards old preview and does not make an automatic request',async()=>{
 const {rerender}=render(<ContractNoticeReview contractId="c"/>);fireEvent.click(screen.getByText('Review signed-contract email'));await screen.findByRole('dialog');mocks.auth.session.access_token='session-two';rerender(<ContractNoticeReview contractId="c"/>);await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
it('server disabled delivery cannot be confirmed',async()=>{
 mocks.invoke.mockResolvedValue({data:{...preview,mailEnabled:false},error:null});render(<ContractNoticeReview contractId="c"/>);fireEvent.click(screen.getByText('Review signed-contract email'));await screen.findByRole('dialog');expect((screen.getByText('Send test email') as HTMLButtonElement).disabled).toBe(true);
});
