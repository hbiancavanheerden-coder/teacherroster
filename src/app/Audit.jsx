import { useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, limit } from 'firebase/firestore';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection } from '../lib/data.js';
import { toCSV, download } from '../lib/csv.js';
import { Empty, Icon } from '../components/ui.jsx';

export default function Audit() {
  const s = useSchool();
  const [n, setN] = useState(200);
  const logs = useCollection(s.sid, 'auditLogs', [orderBy('at', 'desc'), limit(n)], [n]);
  const [q, setQ] = useState('');
  if (!s.plan.features.auditLog) {
    return <div className="card"><Empty title="The audit log is part of the School plan" action={<Link to="/app/billing" className="btn">See plans</Link>}>See who changed what and when, across rosters, staff, calendar and billing.</Empty></div>;
  }
  const rows = logs.data.filter((l) => [l.actorName, l.summary, l.action].join(' ').toLowerCase().includes(q.toLowerCase()));
  const when = (l) => l.at?.toDate?.().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) || '';
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h2>Audit log</h2><p className="muted small" style={{ margin: 0 }}>A permanent, read-only record of changes in this workspace.</p></div>
        <button className="btn secondary sm" onClick={() => download('audit-log.csv', toCSV([['When', 'Who', 'Action', 'Details'], ...rows.map((l) => [when(l), l.actorName, l.action, l.summary])]))}><Icon name="download" />CSV</button>
      </div>
      <input placeholder="Filter by person or change…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} aria-label="Filter audit log" />
      <div className="table-wrap">
        {rows.length === 0 ? <Empty title="No entries" /> : (
          <table>
            <thead><tr><th>When</th><th>Who</th><th className="desktop-only">Action</th><th>Details</th></tr></thead>
            <tbody>{rows.map((l) => (
              <tr key={l.id}><td className="mono tiny" style={{ whiteSpace: 'nowrap' }}>{when(l)}</td><td className="small">{l.actorName}</td><td className="desktop-only"><span className="badge">{l.action}</span></td><td className="small">{l.summary}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {logs.data.length === n && <button className="btn secondary sm" style={{ alignSelf: 'center' }} onClick={() => setN(n + 200)}>Load more</button>}
    </div>
  );
}
