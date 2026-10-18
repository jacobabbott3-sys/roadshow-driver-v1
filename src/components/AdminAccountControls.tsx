import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { accountManagementEnabled, accountRequest, AccountRequestError, type AccountPage, type ManagedAccount } from '../lib/adminAccounts';

export function AdminAccountControls({ enabled = accountManagementEnabled }: { enabled?: boolean }) {
  const { user, profile, session } = useAuth();
  const authorized = !!user && profile?.id === user.id && profile.is_active && profile.role === 'admin';
  const identity = authorized ? `${user.id}:${session?.access_token ?? ''}` : '';
  const [view, setView] = useState<{ identity: string; accounts: ManagedAccount[]; cursor: string | null }>({ identity: '', accounts: [], cursor: null });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ identity: string; error: boolean; text: string } | null>(null);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const requestIds = useRef(new Map<string, string>());

  useEffect(() => {
    const generation = ++epoch.current;
    requestIds.current.clear();
    inFlight.current = false;
    setName(''); setEmail(''); setBusy(false); setFeedback(null);
    if (!enabled || !identity) return;
    setBusy(true);
    void accountRequest<AccountPage>({ action: 'list', limit: 25 }).then(page => {
      if (epoch.current === generation) setView({ identity, accounts: page.accounts, cursor: page.nextCursor });
    }).catch(() => {
      if (epoch.current === generation) setFeedback({ identity, error: true, text: 'Account status is unavailable. Refresh to try again.' });
    }).finally(() => { if (epoch.current === generation) setBusy(false); });
    return () => { epoch.current = generation + 1; };
  }, [enabled, identity]);

  if (!authorized) return null;
  if (!enabled) return <section className="notice"><h2>Account invitations</h2><p>Invitations, recovery and email status controls are not enabled yet. Existing role and access controls remain available below.</p></section>;
  const accounts = view.identity === identity ? view.accounts : [];
  const cursor = view.identity === identity ? view.cursor : null;
  const notice = feedback?.identity === identity ? feedback : null;

  async function load(more = false) {
    if (inFlight.current || busy) return;
    const generation = epoch.current;
    inFlight.current = true; setBusy(true);
    try {
      const page = await accountRequest<AccountPage>({ action: 'list', limit: 25, ...(more && cursor ? { cursor } : {}) });
      if (epoch.current !== generation) return;
      setView({ identity, accounts: more ? [...accounts, ...page.accounts.filter(item => !accounts.some(old => old.id === item.id))] : page.accounts, cursor: page.nextCursor });
      setFeedback(null);
    } catch { if (epoch.current === generation) setFeedback({ identity, error: true, text: 'Account status is unavailable. Refresh to try again.' }); }
    finally { if (epoch.current === generation) { inFlight.current = false; setBusy(false); } }
  }

  async function send(action: 'create' | 'resend' | 'recover', account?: ManagedAccount) {
    if (inFlight.current || busy || !identity) return;
    const generation = epoch.current;
    const command = action === 'create' ? { action, email: email.trim(), fullName: name.trim() } : { action, userId: account!.id };
    const signature = JSON.stringify(command);
    const requestId = requestIds.current.get(signature) ?? crypto.randomUUID();
    requestIds.current.set(signature, requestId);
    inFlight.current = true; setBusy(true); setFeedback(null);
    try {
      await accountRequest({ ...command, requestId });
      if (epoch.current !== generation) return;
      setFeedback({ identity, error: false, text: 'Email request accepted. Delivery has not been confirmed. Check the test inbox and spam folder.' });
      if (action === 'create') { setName(''); setEmail(''); }
      // An explicit later click is a new operation. Only ambiguous retries retain
      // the old key; the server enforces a one-minute rate window for new requests.
      requestIds.current.delete(signature);
    } catch (error) {
      if (epoch.current !== generation) return;
      if (error instanceof AccountRequestError && error.retryAllowed) requestIds.current.delete(signature);
      setFeedback({ identity, error: true, text: error instanceof AccountRequestError ? error.message : 'Request outcome is unknown. Check its status before retrying.' });
    } finally { if (epoch.current === generation) { inFlight.current = false; setBusy(false); } }
  }
  function invite(event: FormEvent) { event.preventDefault(); void send('create'); }

  return <section className="admin-account-controls" aria-label="Account invitations and recovery">
    <h2>Account invitations and recovery</h2>
    <p className="muted">New accounts are drivers. Invitation status is separate from operational access. Email actions are limited to approved beta test recipients.</p>
    <form className="form-grid" onSubmit={invite}>
      <label>Driver name<input value={name} onChange={event => setName(event.target.value)} maxLength={120} required disabled={busy} /></label>
      <label>Invitation email<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy} /></label>
      <button className="button primary" disabled={busy}>Create driver and invite</button>
    </form>
    {notice && <p className={notice.error ? 'error' : 'success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {busy && <p role="status">Working…</p>}
    <button className="button secondary" disabled={busy} onClick={() => void load()}>Refresh account status</button>
    <div className="user-grid">{accounts.map(account => <article className="user-card" key={account.id}>
      <h3>{account.fullName || 'Unnamed user'}</h3><p>{account.email}</p>
      <p>Invitation: {account.invitationStatus} · Access: {account.active ? 'Active' : 'Inactive'}</p>
      <p>Email delivery: unknown</p>
      <button className="button secondary" disabled={busy || !account.active || account.invitationStatus === 'confirmed'} onClick={() => void send('resend', account)}>Resend invitation</button>
      <button className="button secondary" disabled={busy || !account.active || account.invitationStatus !== 'confirmed'} onClick={() => void send('recover', account)}>Send password recovery</button>
    </article>)}</div>
    {cursor && <button className="button secondary" disabled={busy} onClick={() => void load(true)}>Load more accounts</button>}
  </section>;
}
