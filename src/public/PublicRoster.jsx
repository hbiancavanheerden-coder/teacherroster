// Public read-only roster: the original "Staff Duty Register" experience, now live data from a share link.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { todayISO, toDate, dow, fmtLong, fmt } from '../lib/dates.js';
import { expandEvents, EVENT_TYPES } from '../lib/events.js';
import RegisterCard from '../components/RegisterCard.jsx';
import { Modal, Spinner } from '../components/ui.jsx';
import { SITE } from '../config/site.js';
import PushCard from '../components/PushCard.jsx';
import { setStartUrl } from '../lib/push.js';

const meKey = (token) => `sb-me-${token}`;
const readMe = (token) => { try { return localStorage.getItem(meKey(token)) || ''; } catch { return ''; } };
const writeMe = (token, id) => { try { id ? localStorage.setItem(meKey(token), id) : localStorage.removeItem(meKey(token)); } catch { /* private mode */ } };

export default function PublicRoster() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [showTerm, setShowTerm] = useState(false);
  const [me, setMe] = useState(() => readMe(token));
  const stripRef = useRef(null);

  useEffect(() => {
    setData(null); setError('');
    api('public-roster', { token }, { method: 'GET', authed: false })
      .then((d) => setData({ categories: [], duties: [], events: [], ...d }))
      .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => { if (data?.school?.name) document.title = `${data.school.name} – Duty roster`; }, [data]);
  // "Add to Home Screen" on this page should reopen this roster link.
  useEffect(() => { setStartUrl(`/r/${token}`); }, [token]);

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
    const list = data.duties.filter((d) => d.date === selected && d.categoryId === c.id);
    const names = list.map((d) => d.name);
    return { key: c.id, label: c.name, time: c.startTime ? `${c.startTime}–${c.endTime}` : '', name: names.join(', '), match: (query && names.some((n) => n.toLowerCase().includes(query))) || list.some((d) => d.staffId === me) };
  }).filter((r) => r.name);

  let next = null;
  if (query) {
    const from = selected >= today ? selected : today;
    const hit = data.duties.filter((d) => d.date >= from && d.name.toLowerCase().includes(query)).sort((a, b) => a.date.localeCompare(b.date))[0];
    next = hit ? { ...hit, cat: cats.find((c) => c.id === hit.categoryId)?.name } : 'none';
  }

  const teacherDuties = teacher ? data.duties.filter((d) => d.name === teacher).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const meStaff = (data.staff || []).find((x) => x.id === me);
  const myDuties = meStaff ? data.duties.filter((d) => d.staffId === me && d.date >= today).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const catName = (id) => cats.find((c) => c.id === id);
  const termItems = expandEvents(data.events, today.slice(0, 4) + '-01-01', (Number(today.slice(0, 4)) + 1) + '-12-31');

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(900px 420px at 50% -10%, rgba(41,82,255,.14), transparent 60%), var(--bg)', padding: '28px 16px 60px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div className="eyebrow center" style={{ marginBottom: 6 }}>{data.school.name}</div>
        <h1 className="center" style={{ fontSize: 28, margin: '0 0 18px' }}>Who’s on duty</h1>
        {data.events.length > 0 && <div className="center" style={{ marginBottom: 18 }}><button className="chip" style={{ borderColor: 'var(--brass)', color: 'var(--brass-ink)', background: 'var(--brass-tint)' }} onClick={() => setShowTerm(true)}>📅 Term dates</button></div>}

        {(data.staff || []).length > 0 && (meStaff ? (
          <div className="stack" style={{ marginBottom: 18 }}>
            <div className="card me-card">
              <div className="row between" style={{ marginBottom: 8 }}>
                <b>Hi {meStaff.name}</b>
                <button className="btn ghost sm" onClick={() => { writeMe(token, ''); setMe(''); }}>Not you?</button>
              </div>
              {myDuties.length === 0 ? <p className="small muted" style={{ margin: 0 }}>You have no upcoming duties.</p> : myDuties.slice(0, 4).map((d, i) => {
                const c = catName(d.categoryId) || {};
                return (
                  <div key={d.date + d.categoryId} className="row between" style={{ padding: '7px 0', borderTop: i ? '1px solid var(--line-2)' : 0, flexWrap: 'nowrap' }}>
                    <span className="small" style={{ fontWeight: d.date === today ? 700 : 500, color: d.date === today ? '#B5470C' : 'var(--ink-2)' }}>{d.date === today ? '☀ Today' : `${dow(d.date)}, ${fmt(d.date)}`}</span>
                    <span className="small" style={{ textAlign: 'right' }}><b>{c.name || 'Duty'}</b>{c.startTime && <span className="muted"> · {c.startTime}</span>}</span>
                  </div>
                );
              })}
            </div>
            <PushCard compact target={{ token, staffId: me }} />
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 18 }}>
            <label htmlFor="me" className="label">Who are you? <span className="hint">(we’ll remember this on this phone)</span></label>
            <select id="me" style={{ marginTop: 8 }} value="" onChange={(e) => { writeMe(token, e.target.value); setMe(e.target.value); }}>
              <option value="">Choose your name…</option>
              {data.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <p className="tiny muted" style={{ margin: '8px 0 0' }}>See your own duties first and get a free reminder every school morning.</p>
          </div>
        ))}

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
