// Full-screen staffroom display. Purely presentational: give it the output of buildToday().
import { useEffect, useState } from 'react';
import { fmtLong, fmt } from '../lib/dates.js';
import { EVENT_TYPES } from '../lib/events.js';

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  return <span className="tv-clock">{now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>;
}

function Panel({ title, children, empty, wide }) {
  return (
    <section className={'tv-panel' + (wide ? ' wide' : '')}>
      <h2>{title}</h2>
      {children || <p className="tv-empty">{empty}</p>}
    </section>
  );
}

export default function TvBoard({ schoolName, today, onExit, updatedAt }) {
  const t = today;
  return (
    <div className="tv">
      <header className="tv-head">
        <div className="tv-brand"><img src="/brand/mark-128.png" alt="" width="44" height="44" /><div><small>{schoolName}</small><b>{fmtLong(t.date)}</b></div></div>
        <Clock />
        {onExit && <button className="btn glass sm tv-exit" onClick={onExit}>Exit</button>}
      </header>
      <div className="tv-grid">
        <Panel title="On duty today" empty="No duties today" wide>
          {t.duties.length > 0 && <div className="tv-duties">{t.duties.map((d) => (
            <div key={d.id} className="tv-duty"><span className="tv-dot" style={{ background: d.color || '#009BFB' }} /><div><b>{d.label}</b><small>{d.time}</small></div><span className="tv-names">{d.names.join(', ')}</span></div>
          ))}</div>}
        </Panel>
        <Panel title="Away today" empty="Everyone is in">
          {t.away.length > 0 && <ul className="tv-list">{t.away.map((n) => <li key={n}>{n}</li>)}</ul>}
        </Panel>
        <Panel title="Relief" empty="No relief needed">
          {t.relief.length > 0 && <ul className="tv-list">{t.relief.map((r, i) => <li key={i}><b>{r.period}</b> {r.className} {r.subject} <span className="tv-arrow">→</span> <b className={r.cover ? '' : 'tv-alert'}>{r.cover || 'not covered'}</b></li>)}</ul>}
        </Panel>
        {t.exams.length > 0 && (
          <Panel title="Exams & invigilation">
            <ul className="tv-list">{t.exams.map((x, i) => <li key={i}><b>{x.time}</b> {x.subject} {x.grade} <span className="tv-muted">{x.venue}</span><br /><span className="tv-muted">{x.names.join(', ') || 'Invigilators to be assigned'}</span></li>)}</ul>
          </Panel>
        )}
        <Panel title="Today" empty="No events today">
          {t.events.length > 0 && <ul className="tv-list">{t.events.map((e, i) => <li key={i}><span className="tv-dot" style={{ background: EVENT_TYPES[e.type]?.color }} />{e.time && <b>{e.time} </b>}{e.title}</li>)}</ul>}
        </Panel>
        <Panel title="Coming up" empty="Nothing in the next week">
          {t.comingUp.length > 0 && <ul className="tv-list">{t.comingUp.map((e, i) => <li key={i}><b>{fmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b> {e.title}</li>)}</ul>}
        </Panel>
        {t.notices.length > 0 && (
          <Panel title="Notices" wide>
            <div className="tv-notices">{t.notices.map((n, i) => <div key={i}><b>{n.title}</b><p>{n.body}</p></div>)}</div>
          </Panel>
        )}
      </div>
      <footer className="tv-foot">StaffBoard · updates automatically{updatedAt ? ` · last update ${updatedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : ''}</footer>
    </div>
  );
}
