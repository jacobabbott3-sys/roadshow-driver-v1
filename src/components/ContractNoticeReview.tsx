import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Notice } from '../../server/contract-notices/noticeTypes';

type Preview = { reviewId: string; expiresAt: number; notice: Notice; mailEnabled: boolean };
export function ContractNoticeReview({ contractId }: { contractId: string }) {
  const { session, profile } = useAuth();
  if (import.meta.env.VITE_CONTRACT_NOTICE_ENABLED !== 'true' || !session || profile?.role !== 'admin' || !profile.is_active) return null;
  return <Review key={`${contractId}:${session.access_token}`} contractId={contractId} />;
}
function Review({ contractId }: { contractId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [editFailed, setEditFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function act(action: 'prepare' | 'send' | 'skip' | 'later' | 'edit-body') {
    if (pending.current || (action === 'send' && (draft !== null || editFailed))) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const body = action === 'prepare' ? { action, contractId } : { action, reviewId: preview?.reviewId, ...(action === 'send' ? { confirmed: true } : {}), ...(action === 'edit-body' ? { message: draft } : {}) };
      const { data, error } = await supabase.functions.invoke('contract-notices', { body });
      if (error) throw error;
      setDraft(null); setEditFailed(false);
      if (action === 'prepare' || action === 'edit-body') setPreview(data as Preview);
      else { setPreview(null); setMessage(data.message); }
    } catch {
      if (action === 'edit-body') {
        setEditFailed(true);
        setMessage('Could not update the preview. Your draft is still here. Retry, or copy it before opening a fresh review. Sending stays disabled.');
        return;
      }
      setPreview(null); setDraft(null); setEditFailed(false);
      setMessage('Request unavailable or state changed. Check request history before retrying, then review again. Nothing will retry automatically.');
    } finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Signed-contract email" className="card">
    <h3>Signed-contract email</h3>
    <p>Available for your synthetic beta test agreement only. Signing, editing and cancellation never send email automatically.</p>
    {!preview && <button disabled={busy} onClick={() => void act('prepare')}>Review signed-contract email</button>}
    {preview && <div role="dialog" aria-label="Confirm signed-contract email">
      <p>Intended recipients: {preview.notice.recipients.join(', ')}</p>
      <p><strong>TEST ONLY — actual destination: {preview.notice.testRecipient}</strong></p>
      <p>One test email goes only to the test inbox. To change the intended defaults, use Settings.</p>
      <h4>{preview.notice.subject}</h4>
      {draft === null ? <>
        <pre aria-label="Email body preview" style={{ whiteSpace: 'pre-wrap' }}>{preview.notice.message}</pre>
        <button type="button" disabled={busy} onClick={() => setDraft(preview.notice.message)}>Edit email body</button>
      </> : <>
        <label>Email body (plain text)
          <textarea rows={8} value={draft} onChange={e => setDraft(e.target.value)} maxLength={3000} disabled={busy} />
        </label>
        <button type="button" disabled={busy || !draft.trim()} onClick={() => void act('edit-body')}>Update preview</button>
        {editFailed
          ? <button type="button" disabled={busy} onClick={() => void act('prepare')}>Open fresh review</button>
          : <button type="button" disabled={busy} onClick={() => setDraft(null)}>Discard edits</button>}
      </>}
      {preview.notice.attachmentName && <p>Attachment: {preview.notice.attachmentName}</p>}
      <p>Send later saves your decision only. Reopen a fresh review and confirm Send; nothing is scheduled or queued.</p>
      {!preview.mailEnabled && <p>Sending is disabled in this beta. You can still review and edit the draft.</p>}
      <button disabled={busy || editFailed || draft !== null || !preview.mailEnabled || preview.expiresAt <= Date.now()} onClick={() => void act('send')}>Send test email</button>
      <button disabled={busy} onClick={() => void act('skip')}>Skip</button>
      <button disabled={busy} onClick={() => void act('later')}>Send later</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
