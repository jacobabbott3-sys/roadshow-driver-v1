import { beforeEach, expect, test, vi } from 'vitest';
import { saveConfirmedAgreementChange } from './agreementData';
import { supabase } from './supabase';
import { requestAgreementConfirmation } from './agreementConfirmation';

vi.mock('./supabase',()=>({supabase:{rpc:vi.fn()}}));
vi.mock('./agreementConfirmation',()=>({requestAgreementConfirmation:vi.fn()}));
beforeEach(()=>{vi.mocked(supabase.rpc).mockReset();vi.mocked(requestAgreementConfirmation).mockReset();});
test('canceling consequences never sends a commit',async()=>{
  vi.mocked(supabase.rpc).mockResolvedValueOnce({data:{token:'ticket',consequences:[{contract_id:'contract'}]},error:null} as never);
  vi.mocked(requestAgreementConfirmation).mockResolvedValue(false);
  await expect(saveConfirmedAgreementChange('assign',{driver_ids:[]})).rejects.toThrow('Nothing was saved');
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
test('confirmed save commits the exact preview payload and token, exposing stale rejection',async()=>{
  const payload={contract_pay:0,bonus_pay:null};
  vi.mocked(supabase.rpc).mockResolvedValueOnce({data:{token:'ticket',consequences:[{contract_id:'contract'}]},error:null} as never)
    .mockResolvedValueOnce({data:null,error:new Error('Stale preview')} as never);
  vi.mocked(requestAgreementConfirmation).mockResolvedValue(true);
  await expect(saveConfirmedAgreementChange('show',payload)).rejects.toThrow('Stale preview');
  expect(supabase.rpc).toHaveBeenLastCalledWith('commit_agreement_change',{operation:'show',target_payload:payload,preview_token:'ticket'});
});
