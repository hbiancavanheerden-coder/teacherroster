// Platform owner dashboard: MRR, users and growth across every school on Staffboard.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { formatRand, PLANS } from '../config/plans.js';
import { Spinner, Icon } from '../components/ui.jsx';
import { isPlatformOwner } from './AppLayout.jsx';
import { toCSV, download } from '../lib/csv.js';

const monthLabel = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-ZA', { month: 'short' });
const monthLong = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

// Single-series bar chart: thin rounded bars, recessive grid, hover tooltip, table fallback.
function BarChart({ data, format, label }) {
  const [tip, setTip] = useState(null);
  const W = 640, H = 220, pad = { l: 8, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p; })();
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const slot = iw / data.length, bw = Math.min(28, slot * 0.56);
  const y = (v) => pad.t + ih - (v / nice) * ih;
  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} />)}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {data.map((d, i) => {
          const x = pad.l + slot * i + (slot - bw) / 2;
          const top = y(d.value), h = Math.max(0, y(0) - top), r = Math.min(4, h);
          const path = h ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z` : '';
          return (
            <g key={d.key}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent"
                onMouseEnter={() => setTip({ i, x: ((x + bw / 2) / W) * 100, y: (top / H) * 100 })} />
              {path && <path className="bar" d={path} style={{ opacity: tip && tip.i !== i ? 0.45 : 1, pointerEvents: 'none' }} />}
              <text className="axis" x={x + bw / 2} y={H - 8} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {tip && <div className="chart-tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}><b>{format(data[tip.i].value)}</b><br /><span style={{ opacity: .7 }}>{data[tip.i].long}</span></div>}
    </div>
  );
}

function Panel({ title, children, data, columns }) {
  const [table, setTable] = useState(false);
  return (
    <div className="card">
      <div className="card-head"><h3>{title}</h3>{data && <button className="btn ghost sm" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>}</div>
      {table && data ? (
        <div className="table-wrap"><table><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{data.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      ) : children}
    </div>
  );
}

const STATUS = [['active', 'Paying', 'green'], ['trialing', 'In trial', 'blue'], ['past_due', 'Payment failed', 'warm'], ['cancelled', 'Cancelled', ''], ['expired', 'Expired / unpaid', 'red']];

export default function Platform() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('platform-stats', null, { method: 'GET' }).then(setStats).catch((e) => setError(e.message)); }, []);
  if (!isPlatformOwner(user)) return <Navigate to="/app" replace />;
  if (error) return <div className="error-box">{error} Make sure your email is listed in PLATFORM_ADMIN_EMAILS (server) and VITE_PLATFORM_ADMIN_EMAILS, and that it is verified.</div>;
  if (!stats) return <Spinner label="Crunching the numbers…" />;
  const k = stats.kpis;
  const rev = stats.revenueByMonth.map((r) => ({ key: r.month, label: monthLabel(r.month), long: monthLong(r.month), value: r.amount }));
  const sign = stats.signupsByMonth.map((r) => ({ key: r.month, label: monthLabel(r.month), long: monthLong(r.month), value: r.count }));
  const last = rev[rev.length - 1]?.value || 0, prev = rev[rev.length - 2]?.value || 0;
  const growth = prev ? Math.round(((last - prev) / prev) * 100) : null;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Platform owner</div>
          <h2>Business overview</h2>
          <p className="muted small" style={{ margin: 0 }}>Across every workspace on Staffboard · updated {new Date(stats.generatedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button className="btn secondary sm" onClick={() => download('workspaces.csv', toCSV([['Workspace', 'Type', 'Plan', 'Billing', 'Status', 'MRR (R)', 'Created'], ...stats.recentSchools.map((s) => [s.name, s.type, s.plan, s.interval || '', s.status, s.mrr, s.createdAt?.slice(0, 10)])]))}><Icon name="download" />Export</button>
      </div>

      <div className="grid grid-4">
        <div className="kpi hero-kpi"><div className="stat">{formatRand(k.mrr)}</div><div className="stat-label">Monthly recurring revenue{growth !== null && <> · <span style={{ color: growth >= 0 ? '#7CE7D6' : '#FFB4B4' }}>{growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}%</span></>}</div></div>
        <div className="kpi"><div className="stat">{formatRand(k.arr)}</div><div className="stat-label">Annual run rate</div></div>
        <div className="kpi"><div className="stat">{k.users.toLocaleString('en-ZA')}</div><div className="stat-label">Registered users</div></div>
        <div className="kpi"><div className="stat">{k.payingSchools}</div><div className="stat-label">Paying workspaces</div></div>
        <div className="kpi"><div className="stat">{k.trialing}</div><div className="stat-label">In free trial</div></div>
        <div className="kpi"><div className="stat">{k.newLast30}</div><div className="stat-label">New workspaces (30 days)</div></div>
        <div className="kpi"><div className="stat">{k.trialConversion === null ? '–' : k.trialConversion + '%'}</div><div className="stat-label">Trial → paid conversion</div></div>
        <div className="kpi"><div className="stat">{formatRand(k.arpa)}</div><div className="stat-label">Average revenue per paying workspace</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
        <Panel title="Revenue collected per month" data={rev.map((r) => [r.long, formatRand(r.value)])} columns={['Month', 'Revenue']}>
          <BarChart data={rev} format={formatRand} label="Revenue collected per month, last 12 months" />
        </Panel>
        <div className="card">
          <div className="card-head"><h3>Workspaces by status</h3><span className="muted small">{k.workspaces} total</span></div>
          {STATUS.map(([key, label, tone]) => {
            const n = stats.status[key] || 0;
            return (
              <div key={key} style={{ padding: '8px 0' }}>
                <div className="row between small"><span className={'badge ' + tone}>{label}</span><b>{n}</b></div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-2)', marginTop: 6 }}><div style={{ height: 6, borderRadius: 3, width: `${k.workspaces ? (n / k.workspaces) * 100 : 0}%`, background: 'var(--ink-2)' }} /></div>
              </div>
            );
          })}
          <div className="perf" />
          <div className="small"><b>{k.staffAccounts.toLocaleString('en-ZA')}</b> <span className="muted">staff accounts across all schools</span></div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <Panel title="New workspaces per month" data={sign.map((r) => [r.long, r.value])} columns={['Month', 'New workspaces']}>
          <BarChart data={sign} format={(v) => `${v} new`} label="New workspaces per month, last 12 months" />
        </Panel>
        <div className="card">
          <div className="card-head"><h3>MRR by plan</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Plan</th><th>Paying</th><th>MRR</th><th>Share</th></tr></thead>
              <tbody>{Object.entries(stats.byPlan).map(([id, p]) => (
                <tr key={id}><td><b>{PLANS[id]?.name || id}</b></td><td>{p.schools}</td><td>{formatRand(Math.round(p.mrr))}</td><td>{k.mrr ? Math.round((p.mrr / k.mrr) * 100) : 0}%</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="tiny muted mt" style={{ marginBottom: 0 }}>MRR counts paying and payment-failed workspaces; annual plans are divided by 12.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: '18px 20px 0' }}><h3>Latest workspaces</h3></div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table>
            <thead><tr><th>Workspace</th><th>Plan</th><th>Status</th><th>MRR</th><th>Joined</th></tr></thead>
            <tbody>{stats.recentSchools.map((s) => {
              const st = STATUS.find(([key]) => key === s.status) || [s.status, s.status, ''];
              return (
                <tr key={s.id}>
                  <td><b>{s.name}</b><div className="tiny muted">{s.type === 'personal' ? 'Teacher workspace' : 'School'}</div></td>
                  <td>{PLANS[s.plan]?.name || '—'}{s.interval ? <span className="tiny muted"> · {s.interval}</span> : ''}</td>
                  <td><span className={'badge ' + st[2]}>{st[1]}</span></td>
                  <td>{s.mrr ? formatRand(s.mrr) : '—'}</td>
                  <td className="small muted">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : ''}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
      <style>{'@media (max-width: 900px){ .content .grid[style] { grid-template-columns: 1fr !important; } }'}</style>
    </div>
  );
}
