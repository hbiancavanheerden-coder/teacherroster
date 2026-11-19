import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { Field, friendly } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

export function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export default function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));

  const go = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); nav(next, { replace: true }); } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your StaffBoard workspace."
      footer={<>New here? <Link to={`/register${params.get('next') ? '?next=' + encodeURIComponent(next) : ''}`}>Start a free trial</Link></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); go(() => signInWithEmailAndPassword(auth, email.trim(), password)); }}>
        <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="btn secondary block" disabled={busy} onClick={() => go(() => signInWithPopup(auth, new GoogleAuthProvider()))}>Continue with Google</button>
        <Link to="/reset" className="small center">Forgot your password?</Link>
      </form>
    </AuthShell>
  );
}
