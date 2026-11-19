// Daily staff briefing (School plan): one page with everything happening today. Print it or post it as an image.
import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useToday } from './hooks.js';
import { myDay } from '../lib/today.js';
import { addDays, fmtLong, fmtMed, isoWeekday } from '../lib/dates.js';
import { listImage, shareImage } from '../lib/shareImage.js';
import { Icon, useAction, useToast } from '../components/ui.jsx';
import SchoolOnly from './SchoolOnly.jsx';

export default function Briefing() {
  return (
    <SchoolOnly feature="briefing" title="Daily staff briefing"
      points={['One page each morning: who’s away, relief, duties, exams and events', 'Every teacher sees “your day” at the top', 'Print it for the staffroom or post it as an image in the staff group', 'Each teacher also gets their own 06:30 reminder']}>
      <BriefingInner />
    </SchoolOnly>
  );
}

function Section({ title, children, empty }) {
  return <div className="card"><div className="card-head"><h3>{title}</h3></div>{children || <p className="muted small" style={{ margin: 0 }}>{empty}</p>}</div>;
}

function BriefingInner() {
  const s = useSchool();
  const days = s.school.settings?.schoolDays || [1, 2, 3, 4, 5];
  const first = (() => { let d = s.today; while (!days.includes(isoWeekday(d))) d = addDays(d, 1); return d; })();
  const [date, setDate] = useState(first);
  const t = useToday(date);
  const me = s.myStaffId ? myDay(t, s.myStaffId) : null;
  const [run] = useAction();
  const toast = useToast();
  const mine = me && (me.duties.length + me.relief.length + me.exams.length);

  const image = () => run(async () => {
    const blob = await listImage({
      title: `Staff briefing · ${fmtMed(date)}`, subtitle: fmtLong(date), schoolName: s.school.name,
      sections: [
        { heading: 'Away', lines: t.away.length ? [t.away.join(', ')] : [] },
        { heading: 'Relief', lines: t.relief.map((r) => `${r.period}: ${r.className} ${r.subject} → ${r.cover || 'NOT COVERED'}`) },
        { heading: 'On duty', lines: t.duties.map((d) => `${d.label}${d.time ? ` (${d.time})` : ''}: ${d.names.join(', ')}`) },
        ...(t.exams.length ? [{ heading: 'Exams', lines: t.exams.map((x) => `${x.time} ${x.subject} ${x.grade} · ${x.names.join(', ')}`) }] : []),
        { heading: 'Today', lines: t.events.map((e) => `${e.time ? e.time + ' ' : ''}${e.title}`) },
      ],
    });
    const r = await shareImage(blob, `briefing-${date}.png`, `Staff briefing ${fmtLong(date)}`);
    if (r === 'downloaded') toast('Image downloaded. Post it in the staff group.');
  });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head no-print">
        <div><h2>Daily briefing</h2><p className="muted small" style={{ margin: 0 }}>{fmtLong(date)}</p></div>
        <div className="row">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} aria-label="Date" />
          <button className="btn secondary sm" onClick={() => window.print()}><Icon name="print" />Print</button>
          <button className="btn accent sm" onClick={image}>Share image</button>
        </div>
      </div>
      <div className="print-only"><h2>{s.school.name} · Staff briefing</h2><p>{fmtLong(date)}</p></div>

      {me && (
        <div className="card me-card">
          <div className="card-head"><h3>Your day</h3></div>
          {!mine ? <p className="small muted" style={{ margin: 0 }}>Nothing extra for you today.</p> : (
            <ul className="ticks">
              {me.duties.map((d) => <li key={d.id}>Duty: <b>{d.label}</b> {d.time}</li>)}
              {me.relief.map((r, i) => <li key={'r' + i}>Relief: <b>{r.className} {r.subject}</b>, {r.period}{r.room ? `, ${r.room}` : ''}</li>)}
              {me.exams.map((x, i) => <li key={'x' + i}>Invigilate: <b>{x.subject} {x.grade}</b>, {x.time}{x.venue ? `, ${x.venue}` : ''}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Section title={`Away (${t.away.length})`} empty="Everyone is in.">{t.away.length > 0 && <p style={{ margin: 0 }}>{t.away.join(', ')}</p>}</Section>
        <Section title="Relief" empty="No relief needed.">{t.relief.length > 0 && t.relief.map((r, i) => (
          <div key={i} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}><span><b>{r.period}</b> {r.className} {r.subject}</span><span>{r.cover ? <b>{r.cover}</b> : <span className="badge red">not covered</span>}</span></div>
        ))}</Section>
        <Section title="On duty" empty="No duties.">{t.duties.length > 0 && t.duties.map((d) => (
          <div key={d.id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}><span><span className="dot" style={{ background: d.color || 'var(--accent)', marginRight: 6 }} />{d.label} <span className="muted">{d.time}</span></span><b>{d.names.join(', ')}</b></div>
        ))}</Section>
        {t.exams.length > 0 && <Section title="Exams & invigilation">{t.exams.map((x, i) => (
          <div key={i} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}><b>{x.time}</b> {x.subject} {x.grade} <span className="muted">{x.venue}</span><div className="muted">{x.names.join(', ')}</div></div>
        ))}</Section>}
        <Section title="Today" empty="No events.">{t.events.length > 0 && t.events.map((e, i) => <div key={i} className="small" style={{ padding: '4px 0' }}>{e.time && <b>{e.time} </b>}{e.title}</div>)}</Section>
        <Section title="Coming up" empty="Nothing in the next week.">{t.comingUp.length > 0 && t.comingUp.map((e, i) => <div key={i} className="small" style={{ padding: '4px 0' }}><b>{fmtMed(e.date)}</b> {e.title}</div>)}</Section>
        {t.notices.length > 0 && <Section title="Notices">{t.notices.map((n, i) => <div key={i} className="small" style={{ padding: '6px 0' }}><b>{n.title}</b><div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div></div>)}</Section>}
      </div>
    </div>
  );
}
