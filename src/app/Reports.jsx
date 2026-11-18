import { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useDutiesRange, useAbsences, useTerms } from './hooks.js';
import { addDays, fmtMed, eachDay } from '../lib/dates.js';
import { tablePDF } from '../lib/pdf.js';
import { toCSV, download } from '../lib/csv.js';
import { Icon, useAction } from '../components/ui.jsx';

export default function Reports() {
  const s = useSchool();
  const terms = useTerms();
  const cur = terms.data.find((t) => t.start <= s.today && t.end >= s.today);
  const [from, setFrom] = useState(cur?.start || addDays(s.today, -60));
  const [to, setTo] = useState(cur?.end || addDays(s.today, 30));
  const duties = useDutiesRange(from, to);
  const absences = useAbsences();
  const [sort, setSort] = useState('total');
  const [run] = useAction();
  const cats = s.activeCategories;

  const rows = useMemo(() => {
    const r = s.staff.filter((x) => x.active !== false || duties.data.some((d) => d.staffId === x.id)).map((x) => {
      const mine = duties.data.filter((d) => d.staffId === x.id);
      const per = Object.fromEntries(cats.map((c) => [c.id, mine.filter((d) => d.categoryId === c.id).length]));
      const absentDays = absences.data.filter((a) => a.staffId === x.id && a.status !== 'cancelled')
        .reduce((n, a) => n + eachDay(a.start > from ? a.start : from, (a.end || a.start) < to ? (a.end || a.start) : to).length, 0);
      const minutes = mine.reduce((m, d) => {
        const c = s.catById[d.categoryId];
        if (!c?.startTime || !c?.endTime) return m;
        const [h1, m1] = c.startTime.split(':').map(Number); const [h2, m2] = c.endTime.split(':').map(Number);
        return m + Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
      }, 0);
      return { x, total: mine.length, per, absentDays, hours: Math.round(minutes / 6) / 10, done: mine.filter((d) => d.date < s.today).length };
    });
    return r.sort((a, b) => (sort === 'name' ? a.x.name.localeCompare(b.x.name) : b.total - a.total));
  }, [s.staff, duties.data, absences.data, cats, from, to, sort, s.catById, s.today]);

  const totals = rows.map((r) => r.total);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const max = Math.max(1, ...totals);

  const head = ['Teacher', 'Total', ...cats.map((c) => c.name), 'Hours', 'Absent days'];
  const body = rows.map((r) => [r.x.name, r.total, ...cats.map((c) => r.per[c.id]), r.hours, r.absentDays]);
  const pdf = () => run(() => tablePDF({ filename: `workload-${from}-${to}.pdf`, title: `${s.school.name} – Duty workload`, subtitle: `${fmtMed(from)} – ${fmtMed(to)} · average ${avg.toFixed(1)} duties per teacher`, head, body: body.map((r) => r.map(String)), landscape: cats.length > 4 }));
  const csv = () => download(`workload-${from}-${to}.csv`, toCSV([head, ...body]));
  const history = () => download(`duty-history-${from}-${to}.csv`, toCSV([
    ['Date', 'Duty', 'Teacher', 'Note'],
    ...[...duties.data].sort((a, b) => a.date.localeCompare(b.date)).map((d) => [d.date, s.catById[d.categoryId]?.name || '', s.staffById[d.staffId]?.name || '', d.note || '']),
  ]));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h2>Workload report</h2><p className="muted small" style={{ margin: 0 }}>Duty distribution across staff for any period.</p></div>
        <div className="row">
          <button className="btn secondary sm" onClick={pdf}><Icon name="download" />PDF</button>
          <button className="btn secondary sm" onClick={csv}>CSV</button>
          <button className="btn secondary sm" onClick={history}>Full duty history</button>
        </div>
      </div>
      <div className="row">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} aria-label="From" />
        <span>to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} aria-label="To" />
        {terms.data.map((t) => <button key={t.id} className="chip" onClick={() => { setFrom(t.start); setTo(t.end); }}>{t.name}</button>)}
      </div>
      <div className="grid grid-4">
        <div className="card flat"><div className="stat">{duties.data.length}</div><div className="stat-label">Duties in period</div></div>
        <div className="card flat"><div className="stat">{avg.toFixed(1)}</div><div className="stat-label">Average per teacher</div></div>
        <div className="card flat"><div className="stat">{totals.length ? Math.max(...totals) - Math.min(...totals) : 0}</div><div className="stat-label">Spread (max − min)</div></div>
        <div className="card flat"><div className="stat">{rows.filter((r) => r.total > avg * 1.25 + 0.5).length}</div><div className="stat-label">Above average load</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th><button className="btn ghost sm" style={{ padding: 0 }} onClick={() => setSort('name')}>Teacher</button></th>
            <th><button className="btn ghost sm" style={{ padding: 0 }} onClick={() => setSort('total')}>Total ▾</button></th>
            <th style={{ width: '22%' }} />
            {cats.map((c) => <th key={c.id} className="desktop-only">{c.name}</th>)}
            <th>Hours</th><th className="desktop-only">Absent days</th>
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.x.id}>
              <td><b>{r.x.name}</b>{r.x.dutyWeight && Number(r.x.dutyWeight) !== 1 && <span className="badge" style={{ marginLeft: 6 }}>{Math.round(r.x.dutyWeight * 100)}%</span>}</td>
              <td><b>{r.total}</b> <span className="tiny muted">({r.done} done)</span></td>
              <td><div style={{ height: 8, background: 'var(--paper-2)', borderRadius: 4 }}><div style={{ height: 8, width: `${(r.total / max) * 100}%`, background: r.total > avg * 1.25 + 0.5 ? 'var(--red)' : 'var(--brass)', borderRadius: 4 }} /></div></td>
              {cats.map((c) => <td key={c.id} className="desktop-only">{r.per[c.id] || ''}</td>)}
              <td>{r.hours}</td><td className="desktop-only">{r.absentDays || ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
