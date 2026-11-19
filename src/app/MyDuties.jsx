import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection, where } from '../lib/data.js';
import { fmtMed } from '../lib/dates.js';
import { buildICS } from '../lib/ics.js';
import { download } from '../lib/csv.js';
import { tablePDF } from '../lib/pdf.js';
import { Empty, Icon, useAction } from '../components/ui.jsx';
import CalendarFeed from './CalendarFeed.jsx';

export default function MyDuties() {
  const s = useSchool();
  const [who, setWho] = useState(s.myStaffId || s.staff[0]?.id);
  const person = s.staffById[who];
  const duties = useCollection(s.sid, 'duties', [where('staffId', '==', who || '-')], [who]);
  const swaps = useCollection(s.sid, 'swapRequests', [where('fromStaffId', '==', who || '-')], [who]);
  const myRelief = useCollection(s.plan.features.relief ? s.sid : null, 'relief', [where('coverStaffId', '==', who || '-')], [who]);
  const myExams = useCollection(s.plan.features.invigilation ? s.sid : null, 'exams', [where('invigilatorIds', 'array-contains', who || '-')], [who]);
  const periods = s.school.settings?.periods || [];
  const extra = [
    ...myRelief.data.filter((r) => r.date >= s.today).map((r) => ({ key: 'r' + r.id, date: r.date, label: `Relief: ${r.className} ${r.subject}`, detail: `${periods[r.periodIndex]?.name || ''} ${periods[r.periodIndex]?.start || ''}${r.room ? ' · ' + r.room : ''}` })),
    ...myExams.data.filter((x) => x.date >= s.today).map((x) => ({ key: 'x' + x.id, date: x.date, label: `Invigilate: ${x.subject} ${x.grade || ''}`, detail: `${x.startTime}–${x.endTime}${x.venue ? ' · ' + x.venue : ''}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const list = [...duties.data].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = list.filter((d) => d.date >= s.today);
  const past = list.filter((d) => d.date < s.today);
  const [run] = useAction();
  const [showPast, setShowPast] = useState(false);

  const byCat = {};
  list.forEach((d) => { byCat[d.categoryId] = (byCat[d.categoryId] || 0) + 1; });

  const ics = () => download(`${person?.name || 'duties'}.ics`, buildICS(`${s.school.name} – ${person?.name} duties`, upcoming.map((d) => {
    const c = s.catById[d.categoryId] || {};
    return { uid: `duty-${d.id}@staffboard`, title: `Duty: ${c.name || 'Duty'}`, date: d.date, startTime: c.startTime, endTime: c.endTime, description: d.note };
  }), s.school.timezone), 'text/calendar');

  const pdf = () => run(() => tablePDF({
    filename: `duties-${(person?.name || 'staff').replace(/\s+/g, '-').toLowerCase()}.pdf`,
    title: `${person?.name} – Duties`, subtitle: s.school.name,
    head: ['Date', 'Duty', 'Time', 'Note'],
    body: upcoming.map((d) => { const c = s.catById[d.categoryId] || {}; return [fmtMed(d.date), c.name || '', c.startTime ? `${c.startTime}–${c.endTime}` : '', d.note || '']; }),
  }));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>Browse by teacher</div>
        <div className="row" style={{ gap: 7 }}>
          {s.activeStaff.map((t) => <button key={t.id} className={'chip' + (t.id === who ? ' active' : '')} onClick={() => setWho(t.id)}>{t.id === s.myStaffId ? `${t.name} (me)` : t.name}</button>)}
        </div>
      </div>

      {!person ? <Empty title="No staff yet" /> : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', alignItems: 'start' }}>
          <div className="card">
            <div className="card-head">
              <h3>{person.name}</h3>
              <span className="mono tiny muted">{upcoming.length} upcoming · {list.length} this year</span>
            </div>
            {upcoming.length === 0 && <p className="muted small">No upcoming duties.</p>}
            {upcoming.map((d) => {
              const c = s.catById[d.categoryId] || {};
              const pendingSwap = swaps.data.find((x) => x.dutyId === d.id && ['pending', 'accepted'].includes(x.status));
              return (
                <div key={d.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', flexWrap: 'nowrap' }}>
                  <span className="mono small" style={{ color: d.date === s.today ? 'var(--brass-ink)' : undefined, fontWeight: d.date === s.today ? 700 : 400 }}>{d.date === s.today ? 'Today' : fmtMed(d.date)}</span>
                  <span style={{ textAlign: 'right' }}>
                    <b className="small">{c.name || 'Duty'}</b>{c.startTime && <span className="mono tiny muted"> {c.startTime}</span>}
                    {pendingSwap && <span className="badge brass" style={{ marginLeft: 6 }}>swap {pendingSwap.status}</span>}
                    {d.note && <div className="tiny muted">{d.note}</div>}
                  </span>
                </div>
              );
            })}
            {past.length > 0 && (
              <>
                <button className="btn ghost sm mt" onClick={() => setShowPast(!showPast)}>{showPast ? 'Hide' : 'Show'} {past.length} past duties</button>
                {showPast && past.slice().reverse().map((d) => (
                  <div key={d.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)', opacity: .55 }}>
                    <span className="mono small">{fmtMed(d.date)}</span><span className="small">{s.catById[d.categoryId]?.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="stack">
            {extra.length > 0 && (
              <div className="card">
                <h3>Relief &amp; invigilation</h3>
                {extra.map((e) => (
                  <div key={e.key} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)', flexWrap: 'nowrap' }}>
                    <span className="mono small">{e.date === s.today ? 'Today' : fmtMed(e.date)}</span>
                    <span style={{ textAlign: 'right' }}><b className="small">{e.label}</b><div className="tiny muted">{e.detail}</div></span>
                  </div>
                ))}
              </div>
            )}
            <div className="card">
              <h3>Duty mix</h3>
              {Object.keys(byCat).length === 0 ? <p className="muted small">Nothing yet.</p> : Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cid, n]) => (
                <div key={cid} className="row between small" style={{ padding: '5px 0' }}>
                  <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: s.catById[cid]?.color || 'var(--ink)' }} />{s.catById[cid]?.name || 'Removed duty'}</span><b>{n}</b>
                </div>
              ))}
            </div>
            <div className="card">
              <h3>Take it with you</h3>
              <div className="row">
                <button className="btn secondary sm" onClick={pdf}><Icon name="download" />PDF</button>
                <button className="btn secondary sm" onClick={ics}><Icon name="calendar" />Download .ics</button>
              </div>
              {(who === s.myStaffId || (s.isAdmin && s.plan.features.publicRoster)) && <CalendarFeed staffId={who} />}
            </div>
          </div>
        </div>
      )}
      <style>{`@media (max-width: 900px){ .content > .stack > .grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
