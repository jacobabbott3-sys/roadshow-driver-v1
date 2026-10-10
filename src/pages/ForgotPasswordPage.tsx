import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { useAuth } from '../context/AuthContext';
import { isNativeApp, openExternalUrl } from '../lib/nativePlatform';
export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const native = isNativeApp();
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (native) await openExternalUrl('https://www.roadshowdriver.com/forgot-password');
      else { await resetPassword(email); setSent(true); }
    } catch (err) {
      setError(native ? 'Unable to open password recovery. Try again, or visit www.roadshowdriver.com in Safari.' : err instanceof Error ? err.message : 'Unable to send reset link.');
    } finally { setBusy(false); }
  }
  return <main className="center-page auth-simple"><form className="auth-card" onSubmit={submit}>
    <BackButton to="/login" label="Back to sign in"/><p className="eyebrow">ACCOUNT RECOVERY</p><h2>Reset your password</h2>
    <p className="muted">{native ? 'Reset your password on the Roadshow website in your browser. Return here to sign in with your new password.' : 'We’ll email you a secure reset link. Your administrator can trigger this too, but can never see your password.'}</p>
    {sent ? <div className="success">Check your inbox for the reset link.</div> : <>
      {!native && <label>Email address<div className="input-wrap"><Mail size={18}/><input type="email" value={email} onChange={event=>setEmail(event.target.value)} required/></div></label>}
      {error && <div className="error" role="alert">{error}</div>}
      <button className="button primary" disabled={busy}>{busy ? 'Opening…' : native ? 'Open password recovery' : 'Send reset link'}</button>
    </>}
  </form></main>;
}
