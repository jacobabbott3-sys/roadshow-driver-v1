import type { Notice } from './noticeTypes.ts';
import { approvedTestInbox, digest } from './service.ts';

export type SingleTestPin = {
  actorId: string; contractId: string; versionId: string; evidenceFingerprint: string;
  attachmentDigest: string; bodyDigest: string; expiresAt: number; allowPriorShippingAccepted?: true;
};
const fields = ['actorId','contractId','versionId','evidenceFingerprint','attachmentDigest','bodyDigest','expiresAt'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash = /^[0-9a-f]{64}$/;
const validUntil = (expires: number, now: number) => Number.isSafeInteger(expires) && expires > now && expires <= now + 24 * 60 * 60 * 1000;
export function parseSingleTestPin(raw: string | undefined, now: number): SingleTestPin | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const row = value as Record<string, unknown>;
    if (!fields.every(key => Object.hasOwn(row,key))
      || Object.keys(row).some(key => !(fields as readonly string[]).includes(key) && key !== 'allowPriorShippingAccepted')
      || (Object.hasOwn(row, 'allowPriorShippingAccepted') && row.allowPriorShippingAccepted !== true)) return null;
    for (const key of ['actorId','contractId','versionId']) {
      if (typeof row[key] !== 'string' || !uuid.test(row[key])) return null;
    }
    for (const key of ['evidenceFingerprint','attachmentDigest','bodyDigest']) {
      if (typeof row[key] !== 'string' || !hash.test(row[key])) return null;
    }
    if (typeof row.expiresAt !== 'number' || !validUntil(row.expiresAt, now)) return null;
    return row as SingleTestPin;
  } catch { return null; }
}
export async function matchesSingleTestPin(pin: SingleTestPin, notice: Notice, actorId: string, now: number) {
  return validUntil(pin.expiresAt, now) && actorId === pin.actorId && notice.contractId === pin.contractId
    && notice.versionId === pin.versionId && notice.testRecipient === approvedTestInbox
    && notice.deliveryMode === 'approved-fixture-settings' && notice.evidenceFingerprint === pin.evidenceFingerprint && notice.attachmentDigest === pin.attachmentDigest
    && await digest(notice.message) === pin.bodyDigest;
}
