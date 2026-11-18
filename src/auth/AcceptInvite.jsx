import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Spinner } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

export default function AcceptInvite() {
  const { token } = useParams();
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('accept-invite', { token }, { method: 'GET', authed: false }).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  const accept = async () => {
    setBusy(true); setError('');
    try { await api('accept-invite', { token }); nav('/app', { replace: true }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (loading || (!info && !error)) return <Spinner />;
  const here = `/invite/${token}`;
  return (
    <AuthShell title={info ? `Join ${info.schoolName}` : 'Invitation'} subtitle={info ? `${info.invitedBy} invited ${info.email} to the staff duty register.` : null}>
      {error && <div className="error-box mb">{error}</div>}
      {info && !user && (
        <div className="stack">
          <p className="small">Create an account with <b>{info.email}</b>, or sign in if you already have one.</p>
          <Link className="btn block" to={`/register?email=${encodeURIComponent(info.email)}&next=${encodeURIComponent(here)}`}>Create account</Link>
          <Link className="btn secondary block" to={`/login?next=${encodeURIComponent(here)}`}>I already have an account</Link>
        </div>
      )}
      {info && user && (
        <div className="stack">
          {user.email?.toLowerCase() !== info.email ? (
            <>
              <div className="info-box">You’re signed in as {user.email}, but this invitation is for {info.email}.</div>
              <button className="btn secondary block" onClick={() => signOut()}>Sign out and switch account</button>
            </>
          ) : (
            <button className="btn block" onClick={accept} disabled={busy}>{busy ? 'Joining…' : `Join ${info.schoolName}`}</button>
          )}
        </div>
      )}
    </AuthShell>
  );
}
