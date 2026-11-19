import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLANS, PLAN_ORDER, TRIAL_DAYS, formatRand } from '../config/plans.js';
import { useReveal } from '../components/motion.jsx';

export function PlanCards({ interval, onChoose, current, busy, only = PLAN_ORDER }) {
  return (
    <div className={only.length > 1 ? 'grid grid-2' : 'grid'} style={{ maxWidth: only.length > 1 ? 880 : 460, margin: '0 auto', width: '100%' }}>
      {only.map((id) => {
        const p = PLANS[id];
        const price = interval === 'annual' ? p.annual : p.monthly;
        const isCurrent = current && current.plan === id && current.interval === interval && current.status === 'active';
        return (
          <div key={id} className={'price-card' + (p.popular ? ' popular' : '')}>
            {p.popular && <span className="badge warm tag">Most popular</span>}
            <div>
              <h3 style={{ marginBottom: 4 }}>{p.name}</h3>
              <div className="muted small">{p.tagline}</div>
            </div>
            <div className="price">{formatRand(price)}<small> / {interval === 'annual' ? 'year' : 'month'}</small></div>
            <div className="small muted">{interval === 'annual' ? `Works out to ${formatRand(Math.round(p.annual / 12))}/month. Two months free.` : `or ${formatRand(p.annual)}/year, two months free`}</div>
            <ul className="ticks">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
            <div className="spacer" />
            {onChoose ? (
              <button className={'btn block ' + (p.popular ? 'light' : 'accent')} disabled={busy || isCurrent} onClick={() => onChoose(id)}>
                {isCurrent ? 'Current plan' : `Choose ${p.name}`}
              </button>
            ) : (
              <Link to="/register" className={'btn block ' + (p.popular ? 'light' : 'accent')}>Start {TRIAL_DAYS}-day free trial</Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ROWS = [
  ['Who it’s for', 'One teacher', 'The whole staff'],
  ['Login accounts', '1', `Up to ${PLANS.school.seats}`],
  ['Your duties, timetable & school calendar', '✓', '✓'],
  ['Free morning reminders on your phone', 'You', 'Every teacher'],
  ['AI import of rosters & timetables (PDF, Word, Excel, photo)', '✓', '✓'],
  ['Build & auto-schedule a fair roster', '✓', '✓'],
  ['Print / PDF / CSV export', '✓', '✓'],
  ['Shared roster link for staff (no login)', '–', '✓'],
  ['Calendar links for colleagues & school calendar feed', '–', '✓'],
  ['Staff accounts & personal dashboards', '–', '✓'],
  ['Duty swaps with approval', '–', '✓'],
  ['Absences & substitute cover for all staff', '–', '✓'],
  ['Email notifications', '–', '✓'],
  ['Audit log', '–', '✓'],
];

export default function Pricing() {
  const [interval, setInterval] = useState('monthly');
  const ref = useReveal();
  return (
    <div ref={ref}>
      <section className="section narrow center" style={{ paddingBottom: 40 }}>
        <div className="eyebrow">Pricing</div>
        <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}>Simple pricing, <em className="serif-i">in Rand.</em></h1>
        <p className="lead" style={{ margin: '0 auto 26px' }}>Every plan starts with a {TRIAL_DAYS}-day free trial of the full School plan. No card needed. Cancel any time.</p>
        <div className="toggle" role="tablist">
          <button className={interval === 'monthly' ? 'active' : ''} onClick={() => setInterval('monthly')}>Monthly</button>
          <button className={interval === 'annual' ? 'active' : ''} onClick={() => setInterval('annual')}>Annual · 2 months free</button>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <PlanCards interval={interval} />
        <p className="center small" style={{ maxWidth: 620, margin: '28px auto 0', color: 'var(--ink-2)' }}>Already on the Teacher plan and want your whole staff on board? Use <b>“Send to my principal”</b> inside the app. Your school can activate the School plan with one secure link, and everything you’ve set up is kept.</p>
        <p className="center small muted mt">Payments are processed securely by PayFast (card, Instant EFT and other methods PayFast offers).<br />
          Need more than {PLANS.school.seats} accounts, a district licence or an invoice? <Link to="/contact">Talk to us</Link>.</p>
      </section>
      <section className="section narrow reveal" style={{ paddingTop: 0 }}>
        <h3 className="center mb">Compare plans</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Included</th><th className="center">Teacher</th><th className="center">School</th></tr></thead>
            <tbody>{ROWS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'center' : ''} style={c === '✓' ? { color: 'var(--accent)', fontWeight: 700 } : undefined}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
