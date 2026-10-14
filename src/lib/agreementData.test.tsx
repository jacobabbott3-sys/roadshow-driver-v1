import {beforeEach,expect,test,vi} from 'vitest';
import {supabase} from './supabase';
import {getContractAgreement,acceptContractAgreement} from './agreementData';
vi.mock('./supabase',()=>({supabase:{rpc:vi.fn()}}));
beforeEach(()=>vi.mocked(supabase.rpc).mockReset());
test('review uses only the existing issuing RPC with the authoritative parameter name',async()=>{
 const fixture={version:{id:'displayed-version'}};
 vi.mocked(supabase.rpc).mockResolvedValue({data:fixture,error:null} as never);
 expect(await getContractAgreement('contract')).toBe(fixture);
 expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('get_contract_agreement',{target_contract:'contract'});
});
test('acceptance binds the exact displayed version, role and legal name',async()=>{
 vi.mocked(supabase.rpc).mockResolvedValue({data:'receipt',error:null} as never);
 expect(await acceptContractAgreement('contract','displayed-version','driver','Driver Name')).toBe('receipt');
 expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('accept_contract_agreement',{target_contract:'contract',expected_version:'displayed-version',acceptance_role:'driver',legal_name:'Driver Name'});
});
test('plain Supabase errors surface without any legacy signing fallback',async()=>{
 vi.mocked(supabase.rpc).mockResolvedValue({data:null,error:{message:'Agreement changed: review is required'}} as never);
 await expect(acceptContractAgreement('contract','old','driver','Driver Name')).rejects.toThrow('Agreement changed: review is required');
 expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
test('failed review cannot return agreement data',async()=>{
 vi.mocked(supabase.rpc).mockResolvedValue({data:null,error:{message:'Assigned contract access required'}} as never);
 await expect(getContractAgreement('contract')).rejects.toThrow('Assigned contract access required');
 expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
