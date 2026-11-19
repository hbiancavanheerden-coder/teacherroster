import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { api } from '../lib/api.js';
import { PLANS } from '../config/plans.js';
import { PlanCards } from '../marketing/Pricing.jsx';
import { useAction, useConfirm } from '../components/ui.jsx';

const STATUS = {
  trialing: ['Free trial', 'brass'], active: ['Active', 'green'], past_due: ['Payment failed', 'red'],
  cancelled: ['Cancelled', ''], unpaid: ['No active plan', 'red'],
};

// PayFast checkout is a form POST to PayFast's hosted payment page.
function postToPayfast(url, fields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  for (const [k, v] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = k; input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export default function Billing() {
  const s = useSchool();
  const b = s.school.billing || {};
  const [params] = useSearchParams();
  const [interval, setInterval] = useState(b.interval || 'monthly');
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const [returned, setReturned] = useState(params.get('paid') ? 'paid' : params.get('cancelled') ? 'cancelled' : null);
  const [startStatus] = useState(`${b.status}|${b.lastReference || ''}`);

  // The school document is live: once PayFast's ITN is processed, this page updates by itself.
  useEffect(() => {
    if (returned === 'paid' && `${b.status}|${b.lastReference || ''}` !== startStatus && b.status === 'active') setReturned('done');
  }, [b.status, b.lastReference, returned, startStatus]);

  const choose = (plan) => run(async () => {
    const r = await api('billing', { action: 'checkout', schoolId: s.sid, plan, interval });
    postToPayfast(r.url, r.fields);
  });
  const updateCard = () => run(async () => {
    const r = await api('billing', { action: 'update-card', schoolId: s.sid });
    window.location.assign(r.url);
  });
  const cancel = async () => {
    const until = b.accessUntil?.toDate?.().toLocaleDateString('en-ZA', { dateStyle: 'long' });
    if (await confirm({ title: 'Cancel subscription?', message: `No further payments will be taken. You keep full access until ${until}; after that the workspace becomes read-only.`, danger: true, confirmLabel: 'Cancel subscription' })) {
      run(() => api('billing', { action: 'cancel', schoolId: s.sid }), 'Subscription cancelled');
    }
  };

  const until = b.accessUntil?.toDate?.();
  const [label, tone] = STATUS[b.status] || [b.status, ''];
  const p = PLANS[b.plan];
  const hasSub = Boolean(b.token) && b.status !== 'cancelled';

  return (
    <div className="stack" style={{ gap: 22 }}>
      {confirmNode}
      {returned === 'paid' && <div className="info-box">Thank you! We’re waiting for PayFast to confirm your payment. This page updates automatically, usually within a minute.</div>}
      {returned === 'done' && <div className="ok-box">Payment confirmed. Your subscription is active.</div>}
      {returned === 'cancelled' && <div className="info-box">Checkout was cancelled. You have not been charged.</div>}

      <div className="card">
        <div className="card-head"><h3>Your subscription</h3><span className={'badge ' + tone}>{label}</span></div>
        <div className="grid grid-3">
          <div><div className="stat-label">Plan</div><b>{b.status === 'trialing' ? 'School (trial)' : p?.name || '—'}</b>{b.interval && b.status !== 'trialing' && <span className="muted small"> · {b.interval}</span>}</div>
          <div><div className="stat-label">{b.status === 'trialing' ? 'Trial ends' : b.status === 'cancelled' ? 'Access until' : 'Access until'}</div><b>{until ? until.toLocaleDateString('en-ZA', { dateStyle: 'long' }) : '—'}</b>{b.status === 'active' && b.nextPaymentDate && <div className="tiny muted">Next payment around {b.nextPaymentDate}</div>}</div>
          <div><div className="stat-label">Staff accounts</div><b>up to {b.seats}</b></div>
        </div>
        {b.status === 'past_due' && <div className="error-box mt">Your last payment failed. Update your card to avoid interruption.</div>}
        {b.status === 'cancelled' && <div className="info-box mt">Your subscription won’t renew. Choose a plan below to continue after {until?.toLocaleDateString('en-ZA')}.</div>}
        {hasSub && (
          <div className="row mt">
            <button className="btn secondary" disabled={busy} onClick={updateCard}>Update card</button>
            <button className="btn ghost" disabled={busy} onClick={cancel}>Cancel subscription</button>
          </div>
        )}
        {b.lastPaymentAt && <p className="tiny muted mt" style={{ marginBottom: 0 }}>Last payment: {b.lastPaymentAt.toDate?.().toLocaleDateString('en-ZA', { dateStyle: 'medium' })}{b.lastReference ? ` · PayFast ref ${b.lastReference}` : ''}</p>}
      </div>

      <div className="row between">
        <h3 style={{ margin: 0 }}>{b.status === 'active' ? 'Change plan' : 'Choose a plan'}</h3>
        <div className="toggle">
          <button className={interval === 'monthly' ? 'active' : ''} onClick={() => setInterval('monthly')}>Monthly</button>
          <button className={interval === 'annual' ? 'active' : ''} onClick={() => setInterval('annual')}>Annual · 2 months free</button>
        </div>
      </div>
      <PlanCards interval={interval} onChoose={choose} current={b} busy={busy} only={s.school.type === 'personal' ? ['solo', 'school'] : ['school']} />
      {s.school.type === 'personal' && <p className="small muted center" style={{ margin: 0 }}>Choosing <b>School</b> turns this into your school’s workspace and shares it with all staff. Want the school to pay? Use “Share with staff” → “Send to my principal”.</p>}
      <p className="small muted">You’ll pay securely on PayFast in Rand (card, Instant EFT and other methods PayFast supports for subscriptions). Changing plan starts the new subscription immediately and cancels the old one. Need an invoice or EFT for the full year? Contact support.</p>
    </div>
  );
}
