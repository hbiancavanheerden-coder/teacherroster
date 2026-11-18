import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { Field, friendly } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

export default function Reset() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, sent: false, error: '' });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, sent: false, error: '' });
    try {
      await sendPasswordResetEmail(auth, email.trim(), { url: window.location.origin + '/login' });
      setState({ busy: false, sent: true, error: '' });
    } catch (err) {
      // Don't reveal whether an account exists.
      if (err.code === 'auth/user-not-found') setState({ busy: false, sent: true, error: '' });
      else setState({ busy: false, sent: false, error: friendly(err) });
    }
  };
  return (
    <AuthShell title="Reset your password" subtitle="We’ll email you a secure link to choose a new password." footer={<Link to="/login">Back to sign in</Link>}>
      {state.sent ? (
        <div className="ok-box">If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.</div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {state.error && <div className="error-box">{state.error}</div>}
          <button className="btn block" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthShell>
  );
}
