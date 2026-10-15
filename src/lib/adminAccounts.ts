import { supabase } from './supabase';
export const accountManagementEnabled = import.meta.env.VITE_ACCOUNT_MANAGEMENT_ENABLED === 'true';
export type ManagedAccount = { id: string; email: string; fullName: string | null; role: 'driver' | 'admin'; active: boolean;
  invitationStatus: 'confirmed' | 'invited' | 'unknown'; emailDeliveryStatus: 'unknown' };
export type AccountPage = { accounts: ManagedAccount[]; nextCursor: string | null };
export class AccountRequestError extends Error {
  constructor(message: string, public readonly retryAllowed = false) { super(message); }
}
export async function accountRequest<T>(body: Record<string, unknown>): Promise<T> {
  if (!accountManagementEnabled) throw new AccountRequestError('Account management is not enabled.');
  const { data, error } = await supabase.functions.invoke('admin-accounts', { body });
  if (error) {
    // Only the endpoint's sanitized message is displayed. SDK/network errors can
    // contain implementation details and are not shown or retried automatically.
    let payload: { message?: string; retryAllowed?: boolean } = {};
    if ('context' in error && error.context instanceof Response) {
      try { payload = await error.context.json(); } catch { /* Keep generic feedback. */ }
    }
    throw new AccountRequestError(payload.message || 'Account request failed. Check its status before retrying.', payload.retryAllowed === true);
  }
  return data as T;
}
