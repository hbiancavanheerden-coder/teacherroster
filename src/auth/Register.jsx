import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { Field, friendly } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';
import { safeNext } from './Login.jsx';
import { TRIAL_DAYS } from '../config/plans.js';

export default function Register() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: params.get('email') || '', password: '', agree: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next') || '/app/onboarding');

  const submit = async (e) => {
    e.preventDefault();
    if (f.password.length < 8) return setError('Please use at least 8 characters for your password.');
    if (!f.agree) return setError('Please accept the terms and privacy policy.');
    setBusy(true); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      await updateProfile(cred.user, { displayName: f.name.trim() });
      sendEmailVerification(cred.user).catch(() => {});
      nav(next, { replace: true });
    } catch (err) { setError(friendly(err)); } finally { setBusy(false); }
  };

  const google = async () => {
    if (!f.agree) return setError('Please accept the terms and privacy policy.');
    setBusy(true); setError('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); nav(next, { replace: true }); }
    catch (err) { setError(friendly(err)); } finally { setBusy(false); }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <AuthShell title="Create your account" subtitle={`Free for ${TRIAL_DAYS} days. No card needed.`}
      footer={<>Already have an account? <Link to={`/login${params.get('next') ? '?next=' + encodeURIComponent(next) : ''}`}>Sign in</Link></>}>
      <form className="stack" onSubmit={submit}>
        <Field label="Your name"><input required autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Work email"><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="at least 8 characters"><input type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <label className="check small"><input type="checkbox" checked={f.agree} onChange={set('agree')} /> I agree to the <Link to="/legal/terms" target="_blank">terms</Link> and <Link to="/legal/privacy" target="_blank">privacy policy</Link>.</label>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <button type="button" className="btn secondary block" disabled={busy} onClick={google}>Sign up with Google</button>
      </form>
    </AuthShell>
  );
}
