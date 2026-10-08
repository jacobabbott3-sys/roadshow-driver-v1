import { supabase } from './supabase';
import { requestAgreementConfirmation } from './agreementConfirmation';
import type { AgreementPreview, AgreementReceipt, AgreementReview } from './agreementTypes';

export async function getContractAgreement(contractId: string): Promise<AgreementReview> {
  const {data,error}=await supabase.rpc('get_contract_agreement',{target_contract:contractId});
  if (error) throw error;
  return data as AgreementReview;
}
export async function acceptContractAgreement(contractId: string,versionId: string,role: 'driver' | 'admin',name: string) {
  const {data,error}=await supabase.rpc('accept_contract_agreement',{target_contract:contractId,expected_version:versionId,acceptance_role:role,legal_name:name});
  if (error) throw error;
  return data as string;
}
export async function getMyAgreementHistory(): Promise<AgreementReceipt[]> {
  const {data,error}=await supabase.rpc('get_my_agreement_history');
  if (error) throw error;
  return data as AgreementReceipt[];
}
export async function getContractAcceptanceGate(contractId: string): Promise<boolean> {
  const {data,error}=await supabase.rpc('contract_acceptance_gate',{target_contract:contractId});
  if (error) throw error;
  return data===true;
}
export async function saveConfirmedAgreementChange(operation: 'show'|'signing'|'assign'|'template',payload: object): Promise<string> {
  const {data,error}=await supabase.rpc('preview_agreement_change',{operation,target_payload:payload});
  if (error) throw error;
  const preview=data as AgreementPreview;
  if (preview.consequences.length && !await requestAgreementConfirmation({title:'Confirm agreement changes',consequences:preview.consequences})) throw new Error('Agreement changes canceled. Nothing was saved.');
  const committed=await supabase.rpc('commit_agreement_change',{operation,target_payload:payload,preview_token:preview.token});
  if (committed.error) throw committed.error;
  return committed.data as string;
}
export async function reviewAdminAcceptance(contractId: string,name: string) {
  const review=await getContractAgreement(contractId);
  if (review.signatures.some(s=>s.signer_role==='admin')) return;
  if (await requestAgreementConfirmation({title:`Review version ${review.version.version_number} before admin acceptance as ${name}`,content:review.version.content,consequences:[]})) {
    await acceptContractAgreement(contractId,review.version.id,'admin',name);
  }
}
