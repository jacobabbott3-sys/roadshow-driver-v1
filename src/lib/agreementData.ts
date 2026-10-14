import { supabase } from './supabase';
import type { AgreementReview } from './agreementTypes';

// This RPC can issue an initial agreement. Call only from verified online review.
export async function getContractAgreement(contractId: string): Promise<AgreementReview> {
  const { data, error } = await supabase.rpc('get_contract_agreement', { target_contract: contractId });
  if (error) throw new Error(error.message);
  return data as AgreementReview;
}

export async function acceptContractAgreement(contractId: string, versionId: string, role: 'driver' | 'admin', name: string) {
  const { data, error } = await supabase.rpc('accept_contract_agreement', {
    target_contract: contractId, expected_version: versionId, acceptance_role: role, legal_name: name,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
