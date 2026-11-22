import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { RecipientSettings } from '../../server/contract-notices/noticeTypes';

export function ContractNoticeSettings() {
  const { session, profile } = useAuth();
  if (import.meta.env.VITE_CONTRACT_NOTICE_ENABLED !== 'true' || !session || profile?.role !== 'admin' || !profile.is_active) return null;
  return <Settings key={session.access_token} />;
}
function Settings() {
  const [settings, setSettings] = useState<RecipientSettings | null>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function act(action: 'settings-get' | 'settings-save') {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const body = action === 'settings-get' ? { action } : { action, revision: settings?.revision, recipients: text.split(/[\n,]/).map(x => x.trim()).filter(Boolean) };
      const { data, error } = await supabase.functions.invoke('contract-notices', { body });
      if (error || !data?.settings) throw error ?? new Error('Settings unavailable.');
      const saved = data.settings as RecipientSettings;
      setSettings(saved); setText(saved.recipients.join('\n')); setMessage(data.message);
    } catch {
      setMessage('Could not save or load settings. Use Reload recipients before retrying. Enter one to seven valid email addresses.');
    } finally { pending.current = false; setBusy(false); }
  }
  return <section aria-label="Signed-contract email settings" className="card">
    <h2>Settings</h2>
    <h3>Signed-contract email recipients</h3>
    <p>These defaults appear in the Send review and cannot be changed there. These are actual destinations only in a specifically enabled fictional beta review. Check that list before pressing Send.</p>
    <button type="button" disabled={busy} onClick={() => void act('settings-get')}>{settings ? 'Reload recipients' : 'Edit default recipients'}</button>
    {settings && <form onSubmit={e => { e.preventDefault(); void act('settings-save'); }}>
      <label>Default recipients (one email per line)
        <textarea rows={4} value={text} onChange={e => setText(e.target.value)} maxLength={1800} disabled={busy} required />
      </label>
      <button type="submit" disabled={busy}>Save defaults</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
