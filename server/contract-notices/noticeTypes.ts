export type RecipientSettings = { recipients: string[]; revision: number };
export type Notice = { contractId: string; versionId: string; versionNumber: number; recipients: string[];
  testRecipient: string; subject: string; message: string; attachmentName: string; attachmentDigest: string; fingerprint: string };
export const singleTestShowName = '[BETA TEST] Nonbinding signed email delivery check';
