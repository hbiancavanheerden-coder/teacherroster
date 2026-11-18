// Public read-only roster: the original "Staff Duty Register" experience, now live data from a share link.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { todayISO, toDate, dow, fmtLong, fmt } from '../lib/dates.js';
import { expandEvents, EVENT_TYPES } from '../lib/events.js';
import RegisterCard from '../components/RegisterCard.jsx';
import { Modal, Spinner } from '../components/ui.jsx';
import { SITE } from '../config/site.js';

export default function PublicRoster() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [showTerm, setShowTerm] = useState(false);
  const stripRef = useRef(null);

  useEffect(() => {
    setData(null); setError('');
    api('public-roster', { token }, { method: 'GET', authed: false })
      .then((d) => setData({ categories: [], duties: [], events: [], ...d }))
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => { if (data?.school?.name) document.title = `${data.school.name} – Duty roster`; }, [data]);

  const today = todayISO(data?.school?.timezone || 'Africa/Johannesburg');
  const cats = useMemo(() => (data?.categories || []).filter((c) => c.active).sort((a, b) => a.order - b.order), [data]);
  const dates = useMemo(() => [...new Set((data?.duties || []).map((d) => d.date))].sort(), [data]);
  const teachers = useMemo(() => [...new Set((data?.duties || []).map((d) => d.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [data]);
  const selected = sel || dates.find((d) => d >= today) || dates[dates.length - 1];

  useEffect(() => {
    stripRef.current?.querySelector('.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selected, data]);

  if (error) return <div className="auth-wrap"><div className="card auth-card center"><h3>Roster unavailable</h3><p className="muted">{error}</p><Link to="/">About {SITE.name}</Link></div></div>;
  if (!data) return <Spinner label="Loading roster…" />;

  const query = q.trim().toLowerCase();
  const rows = cats.map((c) => {
    const names = data.duties.filter((d) => d.date === selected && d.categoryId === c.id).map((d) => d.name);
    return { key: c.id, label: c.name, time: c.startTime ? `${c.startTime}–${c.endTime}` : '', name: names.join(', '), match: query && names.some((n) => n.toLowerCase().includes(query)) };
  }).filter((r) => r.name);

  let next = null;
  if (query) {
    const from = selected >= today ? selected : today;
    const hit = data.duties.filter((d) => d.date >= from && d.name.toLowerCase().includes(query)).sort((a, b) => a.date.localeCompare(b.date))[0];
    next = hit ? { ...hit, cat: cats.find((c) => c.id === hit.categoryId)?.name } : 'none';
  }

  const teacherDuties = teacher ? data.duties.filter((d) => d.name === teacher).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const termItems = expandEvents(data.events, today.slice(0, 4) + '-01-01', (Number(today.slice(0, 4)) + 1) + '-12-31');

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top, rgba(194,142,63,.10), transparent 55%), var(--paper)', padding: '28px 16px 60px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div className="eyebrow center" style={{ marginBottom: 6 }}>{data.school.name}</div>
        <h1 className="center" style={{ fontSize: 28, margin: '0 0 18px' }}>Who’s on duty</h1>
        {data.events.length > 0 && <div className="center" style={{ marginBottom: 18 }}><button className="chip" style={{ borderColor: 'var(--brass)', color: 'var(--brass-ink)', background: 'var(--brass-tint)' }} onClick={() => setShowTerm(true)}>📅 Term dates</button></div>}

        {dates.length === 0 ? <div className="card center muted">No duties have been published yet.</div> : (
          <>
            <div ref={stripRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px 18px', scrollbarWidth: 'none' }}>
              {dates.map((d) => (
                <button key={d} className={'chip' + (d === selected ? ' sel' : '')} onClick={() => setSel(d)} style={{ flex: '0 0 auto', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5, textAlign: 'center', ...(d === selected ? { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' } : d === today ? { borderColor: 'var(--brass)', boxShadow: 'inset 0 0 0 1px var(--brass)' } : {}) }}>
                  <span style={{ display: 'block', fontSize: 9, opacity: .65 }}>{dow(d).toUpperCase()}</span><b style={{ fontSize: 14 }}>{toDate(d).getDate()}</b>
                  <span style={{ display: 'block', fontSize: 9, opacity: .65 }}>{fmt(d, { month: 'short' })}</span>
                </button>
              ))}
            </div>
            <RegisterCard date={selected} isToday={selected === today} rows={rows} />
          </>
        )}

        <div style={{ marginTop: 22 }}>
          <label htmlFor="find" className="mono tiny muted center" style={{ display: 'block', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 7 }}>Find my duty</label>
          <input id="find" placeholder="Type your name…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          {next && <div className="small center" style={{ marginTop: 10, color: 'var(--ink-2)' }}>{next === 'none' ? 'No upcoming duties found for that name.' : <>Next duty for <b>{next.name}</b>: <b>{next.cat}</b> — {next.date === today ? 'today' : fmtLong(next.date)}</>}</div>}
        </div>

        {teachers.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div className="mono tiny muted center" style={{ letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Browse by teacher</div>
            <div className="row" style={{ justifyContent: 'center', gap: 7 }}>
              {teachers.map((t) => <button key={t} className={'chip' + (t === teacher ? ' active' : '')} onClick={() => setTeacher(t === teacher ? null : t)}>{t}</button>)}
            </div>
            {teacher && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="row between" style={{ borderBottom: '2px dashed var(--line)', paddingBottom: 10, marginBottom: 6 }}>
                  <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{teacher}</b>
                  <span className="mono tiny muted">{teacherDuties.length} {teacherDuties.length === 1 ? 'DUTY' : 'DUTIES'}</span>
                </div>
                {teacherDuties.map((d, i) => (
                  <div key={i} className="row between small" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)', opacity: d.date < today ? .45 : 1 }}>
                    <span className="mono" style={{ color: d.date === today ? 'var(--brass-ink)' : 'var(--ink-2)', fontWeight: d.date === today ? 700 : 400 }}>{dow(d.date)}, {fmt(d.date)}</span>
                    <b>{cats.find((c) => c.id === d.categoryId)?.name}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <footer className="center mono tiny muted" style={{ marginTop: 30 }}>Read-only roster · powered by <Link to="/">{SITE.name}</Link></footer>
      </div>

      {showTerm && (
        <Modal title="Term dates" onClose={() => setShowTerm(false)}>
          {Object.entries(termItems.reduce((acc, o) => { (acc[fmt(o.occurrence, { month: 'long', year: 'numeric' })] ||= []).push(o); return acc; }, {})).map(([m, list]) => (
            <div key={m}>
              <div className="mono tiny muted" style={{ letterSpacing: '.12em', textTransform: 'uppercase', margin: '14px 0 4px' }}>{m}</div>
              {list.map((o, i) => (
                <div key={i} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap', alignItems: 'flex-start', opacity: o.occEnd < today ? .4 : 1 }}>
                  <span className="mono small" style={{ width: 70, flex: '0 0 auto', fontWeight: 700, color: o.occurrence <= today && o.occEnd >= today ? 'var(--brass-ink)' : 'var(--ink-2)' }}>{fmt(o.occurrence)}{o.occEnd !== o.occurrence ? `–${toDate(o.occEnd).getDate()}` : ''}</span>
                  <span className="dot" style={{ background: EVENT_TYPES[o.type]?.color, marginTop: 6 }} />
                  <span className="small">{o.title}{o.startTime ? `, ${o.startTime}${o.endTime ? '–' + o.endTime : ''}` : ''}</span>
                </div>
              ))}
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
