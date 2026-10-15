import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Notice } from '../../server/contract-notices/service';

type Preview = { reviewId: string; expiresAt: number; notice: Notice; mailEnabled: boolean };
export function ContractNoticeReview({ contractId }: { contractId: string }) {
  const { session, profile } = useAuth();
  if (import.meta.env.VITE_CONTRACT_NOTICE_ENABLED !== 'true' || !session || profile?.role !== 'admin' || !profile.is_active) return null;
  return <Review key={`${contractId}:${session.access_token}`} contractId={contractId} />;
}
function Review({ contractId }: { contractId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function act(action: 'prepare' | 'send' | 'skip' | 'later') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const body = action === 'prepare' ? { action, contractId } : { action, reviewId: preview?.reviewId, ...(action === 'send' ? { confirmed: true } : {}) };
      const { data, error } = await supabase.functions.invoke('contract-notices', { body });
      if (error) throw error;
      if (action === 'prepare') setPreview(data as Preview);
      else { setPreview(null); setMessage(data.message); }
    } catch {
      setPreview(null);
      setMessage('Request unavailable or state changed. Check request history before retrying, then review again. Nothing will retry automatically.');
    } finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Signed-contract email" className="card">
    <h3>Signed-contract email</h3>
    <p>Informational only. Payment readiness is communicated separately. Signing, editing and cancellation never send email automatically.</p>
    {!preview && <button disabled={busy} onClick={() => void act('prepare')}>Review signed-contract email</button>}
    {preview && <div role="dialog" aria-label="Confirm signed-contract email">
      <p>Intended recipients: {preview.notice.recipients.join(', ')}</p>
      <p><strong>TEST ONLY — actual destination: {preview.notice.testRecipient}</strong></p>
      <p>One test message per intended recipient. Intended recipients will not be contacted.</p>
      <h4>{preview.notice.subject}</h4><pre style={{ whiteSpace: 'pre-wrap' }}>{preview.notice.message}</pre>
      <p>Send later saves your decision only. Reopen a fresh review and confirm Send; nothing is scheduled or queued.</p>
      {!preview.mailEnabled && <p>Sending is disabled.</p>}
      <button disabled={busy || !preview.mailEnabled || preview.expiresAt <= Date.now()} onClick={() => void act('send')}>Send test email</button>
      <button disabled={busy} onClick={() => void act('skip')}>Skip</button>
      <button disabled={busy} onClick={() => void act('later')}>Send later</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
