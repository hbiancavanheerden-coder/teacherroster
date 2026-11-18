import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS, PLAN_ORDER, TRIAL_DAYS, formatRand } from '../config/plans.js';

export function PlanCards({ interval, onChoose, current, busy }) {
  return (
    <div className="grid grid-3">
      {PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        const price = interval === 'annual' ? p.annual : p.monthly;
        const isCurrent = current && current.plan === id && current.interval === interval && current.status === 'active';
        return (
          <div key={id} className={'price-card' + (p.popular ? ' popular' : '')}>
            {p.popular && <span className="badge brass tag">Most popular</span>}
            <div>
              <h3 style={{ marginBottom: 4 }}>{p.name}</h3>
              <div className="muted small">{p.tagline}</div>
            </div>
            <div className="price">{formatRand(price)}<small> / {interval === 'annual' ? 'year' : 'month'}</small></div>
            {interval === 'annual'
              ? <div className="small muted">Equivalent to {formatRand(Math.round(p.annual / 12))}/month. Two months free.</div>
              : <div className="small muted">or {formatRand(p.annual)}/year, two months free</div>}
            <ul className="ticks">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
            <div className="spacer" />
            {onChoose ? (
              <button className={'btn block ' + (p.popular ? '' : 'secondary')} disabled={busy || isCurrent} onClick={() => onChoose(id)}>
                {isCurrent ? 'Current plan' : `Choose ${p.name}`}
              </button>
            ) : (
              <Link to="/register" className={'btn block ' + (p.popular ? '' : 'secondary')}>Start free trial</Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Pricing() {
  const [interval, setInterval] = useState('monthly');
  return (
    <>
      <section className="section narrow center">
        <div className="eyebrow">Pricing</div>
        <h1>Simple pricing in Rand.</h1>
        <p className="lead" style={{ margin: '0 auto 22px' }}>Every plan starts with a {TRIAL_DAYS}-day free trial of the full School plan. No card needed to start. Cancel any time.</p>
        <div className="toggle" role="tablist">
          <button className={interval === 'monthly' ? 'active' : ''} onClick={() => setInterval('monthly')}>Monthly</button>
          <button className={interval === 'annual' ? 'active' : ''} onClick={() => setInterval('annual')}>Annual · 2 months free</button>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <PlanCards interval={interval} />
        <p className="center small muted mt-lg">Prices include VAT where applicable. Payments are processed securely by PayFast (card, Instant EFT and other methods PayFast offers).<br />
          Need more than 200 accounts, a district licence or an invoice/EFT option? <Link to="/contact">Talk to us</Link>.</p>
      </section>
      <section className="section narrow" style={{ paddingTop: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Included</th><th>Teacher</th><th>School</th><th>School Plus</th></tr></thead>
            <tbody>
              {[
                ['Login accounts', '1', '60', '200'],
                ['Staff on the roster', 'Unlimited', 'Unlimited', 'Unlimited'],
                ['Automatic fair rosters', '✓', '✓', '✓'],
                ['School calendar & term dates', '✓', '✓', '✓'],
                ['Timetables & clash detection', '✓', '✓', '✓'],
                ['Absence & substitute tools', '✓', '✓', '✓'],
                ['Public roster link & calendar feeds', '✓', '✓', '✓'],
                ['PDF / CSV exports', '✓', '✓', '✓'],
                ['Import existing rosters & timetables from PDF, Word, Excel or a photo', '✓', '✓', '✓'],
                ['Staff invitations & personal dashboards', '–', '✓', '✓'],
                ['Duty swap requests', '–', '✓', '✓'],
                ['Email notifications & morning digest', '–', '✓', '✓'],
                ['Audit log', '–', '✓', '✓'],
                ['Priority support & import help', '–', '–', '✓'],
              ].map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'center' : ''}>{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
