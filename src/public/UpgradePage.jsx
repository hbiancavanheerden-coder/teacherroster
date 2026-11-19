// Public page a principal or bursar opens from the teacher's proposal: review and pay for the School plan.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatRand } from '../config/plans.js';
import { Field, Spinner } from '../components/ui.jsx';
import { Brand } from '../marketing/MarketingLayout.jsx';

function post(url, fields) {
  const form = document.createElement('form');
  form.method = 'POST'; form.action = url;
  Object.entries(fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); });
  document.body.appendChild(form); form.submit();
}

export default function UpgradePage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [interval, setInterval] = useState('annual');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('upgrade', { token }, { method: 'GET', authed: false }).then(setInfo).catch((e) => setError(e.message)); }, [token]);

  const pay = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { const r = await api('upgrade', { action: 'checkout', token, interval, email }, { authed: false }); post(r.url, r.fields); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  if (!info && !error) return <Spinner label="Loading proposal…" />;
  return (
    <div className="auth-wrap">
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div className="center mb"><Brand /></div>
        {!info ? <div className="card"><div className="error-box">{error}</div></div> : (
          <div className="card" style={{ padding: 28 }}>
            {params.get('paid') ? (
              <div className="stack center">
                <h2 style={{ fontSize: 28 }}>Thank you!</h2>
                <p className="muted">PayFast is confirming the payment. <b>{info.schoolName}</b> will be on the School plan within a minute, and {info.requestedBy || 'your colleague'} can start sharing the roster with all staff.</p>
              </div>
            ) : info.alreadyActive ? (
              <div className="ok-box">{info.schoolName} already has the School plan. Nothing more to do.</div>
            ) : (
              <>
                <div className="eyebrow">Proposal for {info.schoolName}</div>
                <h2 style={{ fontSize: 28, margin: '8px 0 10px' }}>Give every teacher their duties, <em className="serif-i">live.</em></h2>
                <p className="muted">{info.requestedBy || 'A colleague'} has already set up the duty roster{info.staffCount ? ` for ${info.staffCount} staff` : ''} on StaffBoard. Activating the School plan shares it with the whole staff.</p>
                <ul className="ticks" style={{ margin: '18px 0' }}>{info.plan.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                <div className="toggle" style={{ marginBottom: 14 }}>
                  <button type="button" className={interval === 'annual' ? 'active' : ''} onClick={() => setInterval('annual')}>Yearly · {formatRand(info.plan.annual)}</button>
                  <button type="button" className={interval === 'monthly' ? 'active' : ''} onClick={() => setInterval('monthly')}>Monthly · {formatRand(info.plan.monthly)}</button>
                </div>
                <p className="small muted" style={{ marginTop: 0 }}>{interval === 'annual' ? 'Two months free. Works out to ' + formatRand(Math.round(info.plan.annual / 12)) + '/month.' : 'Cancel any time.'} Up to {info.plan.seats} staff.</p>
                <form className="stack" onSubmit={pay}>
                  <Field label="Email for the receipt"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="principal@school.co.za or bursar@school.co.za" /></Field>
                  {error && <div className="error-box">{error}</div>}
                  <button className="btn accent lg" disabled={busy}>{busy ? 'Opening PayFast…' : `Activate for ${formatRand(interval === 'annual' ? info.plan.annual : info.plan.monthly)}`}</button>
                </form>
                <p className="tiny muted mt" style={{ marginBottom: 0 }}>Secure payment by card or Instant EFT through PayFast. Need a quote or invoice for the school’s records? <Link to="/contact">Contact us</Link> and we’ll send one.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
