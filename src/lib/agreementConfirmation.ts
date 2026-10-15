import type { AgreementContent, AgreementConsequence } from './agreementTypes';

export type AgreementConfirmationRequest = {
  title: string;
  consequences: AgreementConsequence[];
  content?: AgreementContent;
  resolve: (confirmed: boolean) => void;
};
export function requestAgreementConfirmation(input: Omit<AgreementConfirmationRequest,'resolve'>): Promise<boolean> {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent<AgreementConfirmationRequest>('roadshow-agreement-review',{detail:{...input,resolve}})));
}
