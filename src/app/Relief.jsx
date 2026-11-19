// Relief roster (School plan): cover the lessons of staff who are away, fairly, from the timetable.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection, where } from '../lib/data.js';
import { useAbsences, useDutiesRange, useTerms } from './hooks.js';
import { addDays, fmtLong, fmtMed, isoWeekday } from '../lib/dates.js';
import { lessonsNeedingCover, freeForRelief, autoAssignRelief, reliefCounts } from '../lib/relief.js';
import { isAbsent } from '../lib/scheduler.js';
import { api } from '../lib/api.js';
import { tablePDF } from '../lib/pdf.js';
import { tableImage, shareImage } from '../lib/shareImage.js';
import { Empty, Icon, useAction, useToast } from '../components/ui.jsx';
import SchoolOnly from './SchoolOnly.jsx';

const nextSchoolDay = (d, days) => { let x = d; while (!days.includes(isoWeekday(x))) x = addDays(x, 1); return x; };
const prevSchoolDay = (d, days) => { let x = addDays(d, -1); while (!days.includes(isoWeekday(x))) x = addDays(x, -1); return x; };

export default function Relief() {
  return (
    <SchoolOnly feature="relief" title="Relief roster: cover classes fairly in seconds"
      points={['See every lesson that needs cover when a teacher is away', 'Only teachers who are free that period are suggested', 'Relief shared fairly across staff, tracked all term', 'Each teacher gets a notification: “Relief: 5B Maths, Period 3, Room 12”', 'Print or WhatsApp the daily relief sheet']}>
      <ReliefInner />
    </SchoolOnly>
  );
}

function ReliefInner() {
  const s = useSchool();
  const schoolDays = s.school.settings?.schoolDays || [1, 2, 3, 4, 5];
  const [date, setDate] = useState(nextSchoolDay(s.today, schoolDays));
  const terms = useTerms();
  const termStart = terms.data.find((t) => t.start <= date && t.end >= date)?.start || addDays(date, -90);
  const absences = useAbsences();
  const timetable = useCollection(s.sid, 'timetable');
  const reliefDocs = useCollection(s.sid, 'relief', [where('date', '>=', termStart)], [termStart]);
  const duties = useDutiesRange(date, date);
  const periods = s.school.settings?.periods || [];
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [run, busy] = useAction();
  const toast = useToast();

  const saved = useMemo(() => reliefDocs.data.filter((r) => r.date === date), [reliefDocs.data, date]);
  const needs = useMemo(() => lessonsNeedingCover({ date, absences: absences.data, timetable: timetable.data }), [date, absences.data, timetable.data]);
  const counts = useMemo(() => reliefCounts(reliefDocs.data.filter((r) => r.date !== date)), [reliefDocs.data, date]);

  // Merge what's saved with what's needed whenever the date or data changes (unless editing).
  useEffect(() => {
    if (dirty) return;
    const byId = Object.fromEntries(saved.map((r) => [r.id, r]));
    setRows(needs.map((n) => ({ ...n, coverStaffId: byId[n.id]?.coverStaffId || null, note: byId[n.id]?.note || '' })));
  }, [needs, saved, dirty]);
  useEffect(() => setDirty(false), [date]);

  const ctx = { staff: s.activeStaff, absences: absences.data, timetable: timetable.data, duties: duties.data, categories: s.categories, periods };
  const awayToday = s.activeStaff.filter((p) => isAbsent(absences.data, p.id, date));
  const setCover = (id, staffId) => { setDirty(true); setRows(rows.map((r) => (r.id === id ? { ...r, coverStaffId: staffId || null } : r))); };
  const auto = () => { setDirty(true); setRows(autoAssignRelief({ needs: rows, reliefs: [], counts, ...ctx })); };

  const save = () => run(async () => {
    const keep = new Set(rows.map((r) => r.id));
    const ops = [
      ...rows.map((r) => ({ type: 'set', coll: 'relief', id: r.id, data: { date: r.date, lessonId: r.lessonId, periodIndex: r.periodIndex, absentStaffId: r.absentStaffId, className: r.className, subject: r.subject, room: r.room, coverStaffId: r.coverStaffId || null, note: r.note || '' } })),
      ...saved.filter((r) => !keep.has(r.id)).map((r) => ({ type: 'delete', coll: 'relief', id: r.id })),
    ];
    await s.write(ops, { action: 'relief.save', summary: `Relief for ${fmtMed(date)}: ${rows.filter((r) => r.coverStaffId).length} of ${rows.length} lessons covered` });
    api('notify', { schoolId: s.sid, kind: 'relief', date }).catch(() => {});
    setDirty(false);
  }, 'Relief saved. Teachers have been notified');

  const sheet = () => rows.map((r) => [`${periods[r.periodIndex]?.name || 'P' + (r.periodIndex + 1)} ${periods[r.periodIndex]?.start || ''}`, `${r.className} ${r.subject}`.trim(), r.room, s.staffById[r.absentStaffId]?.name || '', s.staffById[r.coverStaffId]?.name || 'NOT COVERED']);
  const pdf = () => run(() => tablePDF({ filename: `relief-${date}.pdf`, title: `Relief – ${fmtLong(date)}`, subtitle: s.school.name, head: ['Period', 'Class', 'Room', 'Away', 'Relief by'], body: sheet() }));
  const image = () => run(async () => {
    const blob = await tableImage({ title: `Relief · ${fmtMed(date)}`, subtitle: `${rows.length} lesson${rows.length === 1 ? '' : 's'} to cover`, schoolName: s.school.name, head: ['Period', 'Class', 'Away', 'Relief by'], rows: sheet().map((r) => [r[0], r[1], r[3], r[4]]) });
    const res = await shareImage(blob, `relief-${date}.png`, `Relief for ${fmtLong(date)}`);
    if (res === 'downloaded') toast('Image downloaded. Post it in the staff group.');
  });

  if (!periods.length || !timetable.data.length) {
    return <div className="card"><Empty title="Relief needs your timetable" action={<Link className="btn" to="/app/timetable">Set up the timetable</Link>}>Add bell times and teachers’ lessons (or import them from a document), and StaffBoard can work out who is free to cover.</Empty></div>;
  }

  const covered = rows.filter((r) => r.coverStaffId).length;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h2>Relief roster</h2>
          <p className="muted small" style={{ margin: 0 }}>Cover the lessons of staff marked away. Only teachers free that period are offered, least relief this term first.</p>
        </div>
        <div className="row">
          <button className="btn secondary sm" onClick={() => setDate(prevSchoolDay(date, schoolDays))} aria-label="Previous day"><Icon name="chevL" /></button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} aria-label="Date" />
          <button className="btn secondary sm" onClick={() => setDate(nextSchoolDay(addDays(date, 1), schoolDays))} aria-label="Next day"><Icon name="chevR" /></button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="kpi"><div className="stat">{awayToday.length}</div><div className="stat-label">Staff away {date === s.today ? 'today' : fmtMed(date)}</div></div>
        <div className="kpi"><div className="stat">{rows.length}</div><div className="stat-label">Lessons to cover</div></div>
        <div className="kpi"><div className="stat" style={{ color: covered < rows.length ? 'var(--red)' : 'var(--green)' }}>{covered}/{rows.length}</div><div className="stat-label">Covered</div></div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty title={awayToday.length ? 'No lessons to cover' : 'Nobody is away'} action={<Link className="btn secondary" to="/app/absences">Mark someone away</Link>}>{awayToday.length ? `${awayToday.map((p) => p.name).join(', ')} ${awayToday.length === 1 ? 'is' : 'are'} away but has no lessons on this day.` : `No staff are marked away for ${fmtLong(date)}.`}</Empty></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="row" style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
            <button className="btn accent sm" disabled={!s.canWrite} onClick={auto}><Icon name="wand" />Fill fairly</button>
            <button className="btn sm" disabled={busy || !s.canWrite} onClick={save}>{dirty ? 'Save & notify' : 'Saved'}</button>
            <div className="spacer" />
            <button className="btn secondary sm" onClick={pdf}><Icon name="print" />Relief sheet</button>
            <button className="btn secondary sm" onClick={image}>Share image</button>
          </div>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table>
              <thead><tr><th>Period</th><th>Class</th><th className="desktop-only">Room</th><th>Away</th><th>Relief by</th></tr></thead>
              <tbody>{rows.map((r) => {
                const free = freeForRelief({ date, periodIndex: r.periodIndex, reliefs: rows.filter((x) => x.id !== r.id), excludeId: r.absentStaffId, ...ctx });
                const p = periods[r.periodIndex];
                return (
                  <tr key={r.id} style={!r.coverStaffId ? { background: 'var(--red-tint)' } : undefined}>
                    <td><b>{p?.name || `Period ${r.periodIndex + 1}`}</b><div className="tiny muted">{p?.start}–{p?.end}</div></td>
                    <td>{r.className}<div className="tiny muted">{r.subject}</div></td>
                    <td className="desktop-only small">{r.room}</td>
                    <td className="small">{s.staffById[r.absentStaffId]?.name}</td>
                    <td>
                      <select value={r.coverStaffId || ''} disabled={!s.canWrite} onChange={(e) => setCover(r.id, e.target.value)} style={{ minWidth: 190 }} aria-label="Relief teacher">
                        <option value="">Not covered</option>
                        {r.coverStaffId && !free.some((f) => f.id === r.coverStaffId) && <option value={r.coverStaffId}>{s.staffById[r.coverStaffId]?.name} (busy!)</option>}
                        {free.sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0)).map((f) => <option key={f.id} value={f.id}>{f.name} · {counts[f.id] || 0} this term</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Relief this term</h3><span className="muted small">Lessons covered per teacher since {fmtMed(termStart)}</span></div>
        <div className="row" style={{ gap: 8 }}>
          {s.activeStaff.map((p) => ({ p, n: reliefCounts(reliefDocs.data)[p.id] || 0 })).sort((a, b) => b.n - a.n).map(({ p, n }) => (
            <span key={p.id} className="chip" style={{ cursor: 'default' }}>{p.name} · <b>{n}</b></span>
          ))}
        </div>
      </div>
    </div>
  );
}
