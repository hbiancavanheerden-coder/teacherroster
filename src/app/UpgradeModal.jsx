// Shown when a Teacher-plan user tries to share with colleagues. Two ways forward:
// upgrade the workspace herself, or send a proposal + secure pay link to the principal.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { api } from '../lib/api.js';
import { PLANS, formatRand } from '../config/plans.js';
import { Modal, Field, Icon, useToast } from '../components/ui.jsx';

export default function UpgradeModal({ onClose, reason }) {
  const s = useSchool();
  const toast = useToast();
  const [f, setF] = useState({ principalName: '', principalEmail: '', note: '' });
  const [state, setState] = useState({ busy: false, error: '', sent: false, url: '' });
  const p = PLANS.school;

  const getLink = async () => {
    if (state.url) return state.url;
    const r = await api('upgrade', { action: 'link', schoolId: s.sid });
    setState((x) => ({ ...x, url: r.url }));
    return r.url;
  };
  const send = async (e) => {
    e.preventDefault();
    setState((x) => ({ ...x, busy: true, error: '' }));
    try {
      const r = await api('upgrade', { action: 'send', schoolId: s.sid, ...f });
      setState({ busy: false, error: '', sent: true, url: r.url });
    } catch (err) { setState((x) => ({ ...x, busy: false, error: err.message })); }
  };
  const copy = async () => {
    try { const url = await getLink(); await navigator.clipboard?.writeText(url); toast('Link copied'); } catch (err) { toast(err.message, 'error'); }
  };
  const whatsapp = async () => {
    try {
      const url = await getLink();
      const text = `Hi! I've been using Staffboard for our duty roster. With the School plan every teacher sees their duties live on their phone and gets a reminder each morning (${formatRand(p.monthly)}/month). You can review and activate it here: ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <Modal wide title="Share Staffboard with your whole staff" onClose={onClose}>
      <div className="grid grid-2" style={{ alignItems: 'start', gap: 20 }}>
        <div className="stack">
          {reason && <div className="info-box">{reason}</div>}
          <p style={{ margin: 0 }}>Sharing live with colleagues is part of the <b>School plan</b>:</p>
          <ul className="ticks">{p.highlights.slice(1, 6).map((h) => <li key={h}>{h}</li>)}</ul>
          <div className="price" style={{ fontSize: 36 }}>{formatRand(p.monthly)}<small> / month for the whole school</small></div>
          <p className="small muted" style={{ margin: 0 }}>Everything you’ve already set up is kept. Upgrading simply turns on sharing.</p>
          {s.isOwner && <Link to="/app/billing" className="btn secondary" onClick={onClose}>Upgrade this workspace myself</Link>}
        </div>
        <div className="card flat" style={{ background: 'var(--bg)' }}>
          <h3 style={{ marginTop: 0 }}>Ask your principal</h3>
          {state.sent ? (
            <div className="ok-box">Sent! Your principal will get a short proposal and a secure link to activate it for the school. You’ll be copied in on replies.</div>
          ) : (
            <form className="stack" onSubmit={send}>
              <p className="small muted" style={{ margin: 0 }}>We’ll email a one-page proposal with the price, what the school gets and a secure link they (or the bursar) can use to activate it. No account needed.</p>
              <Field label="Principal’s name"><input required value={f.principalName} onChange={(e) => setF({ ...f, principalName: e.target.value })} placeholder="e.g. Mr de Villiers" /></Field>
              <Field label="Principal’s email"><input required type="email" value={f.principalEmail} onChange={(e) => setF({ ...f, principalEmail: e.target.value })} /></Field>
              <Field label="A personal note" hint="optional"><textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={600} placeholder="This would save us hours every term, and teachers will never miss gate duty again." style={{ minHeight: 80 }} /></Field>
              {state.error && <div className="error-box">{state.error}</div>}
              <button className="btn accent" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send proposal'}</button>
            </form>
          )}
          <div className="perf" />
          <div className="label" style={{ marginBottom: 8 }}>Or share the activation link yourself</div>
          <div className="row">
            <button className="btn secondary sm" onClick={copy}><Icon name="link" />Copy link</button>
            <button className="btn secondary sm" onClick={whatsapp}>Share on WhatsApp</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Small inline card used on pages where sharing is locked on the Teacher plan.
export function ShareLocked({ title = 'Share this with your staff', text, onOpen }) {
  return (
    <div className="card push-card">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
        <span className="ic-badge"><Icon name="users" /></span>
        <div style={{ flex: 1 }}>
          <b>{title}</b>
          <p className="small muted" style={{ margin: '4px 0 12px' }}>{text || 'Let every teacher see their duties live on their phone and get a reminder each morning. This is part of the School plan.'}</p>
          <button className="btn accent sm" onClick={onOpen}>See how to share with staff</button>
        </div>
      </div>
    </div>
  );
}
