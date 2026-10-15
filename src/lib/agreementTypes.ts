import type { ChecklistSection } from './driverData';

export type AgreementContent = {
  contract: { kind: string; service_date: string; service_time: string | null; contract_pay: number | null; bonus_pay: number | null; terms: string | null; document_path: string | null };
  work: Record<string, string | number | boolean | null>;
  linked_show_ids: string[];
  linked_work?: Record<string,string|number|boolean|null>[];
  checklist: ChecklistSection[];
};
export type AgreementVersion = { id: string; version_number: number; content: AgreementContent; created_at: string };
export type AgreementSignature = { id: string; version_id: string; signer_id: string; signer_role: 'driver' | 'admin'; assignment_period_id: string | null; signer_name: string; signed_at: string };
export type AgreementReceipt = { version: AgreementVersion; signatures: AgreementSignature[] };
export type AgreementReview = AgreementReceipt & { legacy_missing: boolean; legacy_evidence: { signature_name: string | null; signed_at: string | null; admin_signature_name: string | null; admin_signed_at: string | null } | null };
export type AgreementConsequence = { contract_id: string; work_name: string; before: AgreementContent; after: AgreementContent; removed_signer: string | null; requires_both_signatures: boolean };
export type AgreementPreview = { token: string; consequences: AgreementConsequence[]; resulting_content: {contract_id: string; content: AgreementContent}[] };
