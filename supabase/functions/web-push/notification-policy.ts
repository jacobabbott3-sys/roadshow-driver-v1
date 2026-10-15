export function isInAppOnlyNotification(kind: string | undefined): boolean {
  return kind === 'agreement_removed' || kind === 'agreement_revision';
}
