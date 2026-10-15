import { useRef, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { useAuth } from '../context/AuthContext';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || sent) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch {
      setError('We couldn’t request a reset link. Use the stable Roadshow Driver site and try again shortly.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <main className="center-page auth-simple"><form className="auth-card" onSubmit={submit}>
    <BackButton to="/login" label="Back to sign in" />
    <p className="eyebrow">ACCOUNT RECOVERY</p><h2>Reset your password</h2>
    <p className="muted">Request a secure reset link. Administrators can never see your password.</p>
    {sent ? <div className="success" role="status">If an account matches this address, a reset link has been requested. Check your inbox and spam folder. This does not confirm email delivery.</div> : <>
      <label>Email address<div className="input-wrap"><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} required /></div></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="button primary" disabled={busy}>{busy ? 'Requesting…' : 'Send reset link'}</button>
    </>}
  </form></main>;
}
