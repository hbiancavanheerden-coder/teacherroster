import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Field } from '../components/ui.jsx';
import { Brand } from '../marketing/MarketingLayout.jsx';
import { TRIAL_DAYS } from '../config/plans.js';

export default function Onboarding({ allowNew }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ type: 'school', name: '', ownerName: user.displayName || '', useTemplate: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('create-school', { ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg' });
      nav('/app', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const form = (
    <form className="stack" onSubmit={submit}>
      <div className="grid grid-2">
        {[['school', 'For my school', 'Invite your staff. Everyone sees their own duties.'], ['personal', 'Just for me', 'My own duties, timetable and reminders. Share with staff later.']].map(([v, t, d]) => (
          <label key={v} className="card flat" style={{ cursor: 'pointer', borderColor: f.type === v ? 'var(--ink)' : undefined, borderWidth: f.type === v ? 2 : 1 }}>
            <div className="row"><input type="radio" name="type" value={v} checked={f.type === v} onChange={set('type')} /><b>{t}</b></div>
            <div className="small muted" style={{ marginTop: 6 }}>{d}</div>
          </label>
        ))}
      </div>
      <Field label="School name"><input required minLength={2} value={f.name} onChange={set('name')} placeholder="e.g. Laerskool Hoëveld" /></Field>
      <Field label="Your name" hint="as staff know you, e.g. Mrs Botha"><input required value={f.ownerName} onChange={set('ownerName')} /></Field>
      <label className="check small"><input type="checkbox" checked={f.useTemplate} onChange={set('useTemplate')} /> Start with common duty points (front gates, back gates, taxi, devotion). You can edit them later.</label>
      {error && <div className="error-box">{error}</div>}
      <button className="btn lg" disabled={busy}>{busy ? 'Setting up…' : 'Create workspace'}</button>
    </form>
  );

  if (allowNew) {
    return <div className="card" style={{ maxWidth: 640 }}><h3>Create another workspace</h3>{form}</div>;
  }
  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div className="center mb"><Brand /></div>
        <div className="card">
          <div className="eyebrow">Step 1 of 1</div>
          <h3 style={{ fontSize: 26 }}>Set up your workspace</h3>
          <p className="muted small">Your {TRIAL_DAYS}-day free trial includes every School feature. No card needed.</p>
          {form}
        </div>
        <p className="center small muted mt">Were you invited by your school? Open the link in your invitation email instead. <br />
          <Link to="/app/account">Account settings</Link> · <button className="btn ghost sm" onClick={() => signOut()}>Sign out</button></p>
      </div>
    </div>
  );
}
