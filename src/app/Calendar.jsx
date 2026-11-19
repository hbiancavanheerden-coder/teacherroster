import { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useOccurrences, useDutiesRange, useTerms } from './hooks.js';
import { addDays, eachDay, monthGrid, startOfWeek, toDate, iso, fmt, fmtLong, fmtMed, dow, WEEKDAYS } from '../lib/dates.js';
import { EVENT_TYPES, PHASES, eventsOnDay, phaseMatches } from '../lib/events.js';
import { buildICS } from '../lib/ics.js';
import { download } from '../lib/csv.js';
import { tablePDF } from '../lib/pdf.js';
import { Icon, Modal, Field, useAction, useConfirm } from '../components/ui.jsx';
import CalendarFeed from './CalendarFeed.jsx';

const TEMPLATES = [
  { title: 'Staff meeting', type: 'meeting', allDay: false, startTime: '14:00', endTime: '15:00', location: 'Staffroom', remindDaysBefore: 1 },
  { title: 'Exam', type: 'exam', allDay: true, remindDaysBefore: 2 },
  { title: 'Sport fixture', type: 'sport', allDay: false, startTime: '14:30', endTime: '17:00', remindDaysBefore: 1 },
  { title: 'Parents’ evening', type: 'meeting', allDay: false, startTime: '18:00', endTime: '20:00', location: 'Hall', remindDaysBefore: 3 },
  { title: 'Public holiday', type: 'holiday', allDay: true, remindDaysBefore: -1 },
  { title: 'Marks due', type: 'deadline', allDay: true, remindDaysBefore: 2 },
];

export default function Calendar() {
  const s = useSchool();
  const [view, setView] = useState(window.innerWidth < 700 ? 'agenda' : 'month');
  const [cursor, setCursor] = useState(s.today);
  const [phase, setPhase] = useState('all');
  const [types, setTypes] = useState(Object.keys(EVENT_TYPES));
  const [showDuties, setShowDuties] = useState(true);
  const [edit, setEdit] = useState(null);
  const terms = useTerms();
  const [run] = useAction();

  const curTerm = terms.data.find((t) => t.start <= cursor && t.end >= cursor) || terms.data.find((t) => t.end >= cursor);
  const range = useMemo(() => {
    const d = toDate(cursor);
    if (view === 'month') { const g = monthGrid(d.getFullYear(), d.getMonth()); return [g[0], g[41]]; }
    if (view === 'week') { const st = startOfWeek(cursor); return [st, addDays(st, 6)]; }
    if (view === 'day') return [cursor, cursor];
    return curTerm ? [curTerm.start, curTerm.end] : [cursor, addDays(cursor, 90)];
  }, [view, cursor, curTerm]);
  const { occ, data: rawEvents } = useOccurrences(range[0], range[1]);
  const duties = useDutiesRange(range[0], range[1]);
  const shown = occ.filter((o) => types.includes(o.type) && phaseMatches(o.phase, phase));
  const myDuties = showDuties ? duties.data.filter((d) => d.staffId === s.myStaffId) : [];

  const move = (n) => {
    const d = toDate(cursor);
    if (view === 'month') { d.setMonth(d.getMonth() + n, 1); setCursor(iso(d)); }
    else if (view === 'week') setCursor(addDays(cursor, 7 * n));
    else if (view === 'day') setCursor(addDays(cursor, n));
    else { const i = terms.data.indexOf(curTerm); const t = terms.data[i + n]; if (t) setCursor(t.start); else setCursor(addDays(cursor, 90 * n)); }
  };
  const label = view === 'month' ? fmt(cursor, { month: 'long', year: 'numeric' })
    : view === 'week' ? `${fmt(range[0])} – ${fmt(range[1], { day: 'numeric', month: 'short', year: 'numeric' })}`
      : view === 'day' ? fmtLong(cursor) : curTerm ? `${curTerm.name} (${fmt(curTerm.start)} – ${fmt(curTerm.end)})` : 'Next 90 days';

  const openNew = (date) => s.isAdmin && s.canWrite && setEdit({ start: date || cursor, type: 'activity', phase: 'all', allDay: true, title: '', remindDaysBefore: 1 });

  const exportICS = () => download(`${s.school.name}-calendar.ics`, buildICS(`${s.school.name} calendar`, shown.map((o) => ({
    uid: `ev-${o.id}-${o.occurrence}@staffboard`, title: o.title, date: o.occurrence, endDate: o.occEnd,
    startTime: o.allDay === false ? o.startTime : undefined, endTime: o.allDay === false ? o.endTime : undefined, description: o.description, location: o.location,
  })), s.school.timezone), 'text/calendar');
  const exportPDF = () => run(() => tablePDF({
    filename: `calendar-${range[0]}.pdf`, title: `${s.school.name} – School calendar`, subtitle: label,
    head: ['Date', 'Event', 'Type', 'Phase', 'Time'],
    body: shown.map((o) => [o.occEnd !== o.occurrence ? `${fmtMed(o.occurrence)} – ${fmtMed(o.occEnd)}` : fmtMed(o.occurrence), o.title, EVENT_TYPES[o.type]?.label || '', PHASES[o.phase || 'all'], o.allDay === false ? `${o.startTime}–${o.endTime}` : 'All day']),
  }));

  const Ev = ({ o }) => (
    <button className="ev" style={{ background: EVENT_TYPES[o.type]?.color }} onClick={(e) => { e.stopPropagation(); setEdit({ ...rawEvents.find((x) => x.id === o.id), _occ: o.occurrence }); }}>
      {o.allDay === false && o.startTime ? o.startTime + ' ' : ''}{o.title}
    </button>
  );
  const DutyChip = ({ d }) => <span className="ev duty">Duty: {s.catById[d.categoryId]?.name}</span>;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head no-print">
        <div className="row">
          <button className="btn secondary sm" onClick={() => move(-1)} aria-label="Previous"><Icon name="chevL" /></button>
          <button className="btn secondary sm" onClick={() => setCursor(s.today)}>Today</button>
          <button className="btn secondary sm" onClick={() => move(1)} aria-label="Next"><Icon name="chevR" /></button>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{label}</b>
        </div>
        <div className="row">
          <div className="tabs">{[['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Term']].map(([v, l]) => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{l}</button>)}</div>
          <button className="btn secondary sm" onClick={exportPDF}><Icon name="download" />PDF</button>
          <button className="btn secondary sm desktop-only" onClick={exportICS}>.ics</button>
          {s.isAdmin && <button className="btn sm" disabled={!s.canWrite} onClick={() => openNew()}><Icon name="plus" />Event</button>}
        </div>
      </div>

      <div className="row no-print">
        <select value={phase} onChange={(e) => setPhase(e.target.value)} style={{ width: 'auto' }} aria-label="Phase filter">
          {Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="legend">
          {Object.entries(EVENT_TYPES).map(([k, t]) => (
            <label key={k} style={{ cursor: 'pointer', opacity: types.includes(k) ? 1 : .4 }}>
              <input type="checkbox" className="sr-only" checked={types.includes(k)} onChange={() => setTypes(types.includes(k) ? types.filter((x) => x !== k) : [...types, k])} />
              <span className="dot" style={{ background: t.color }} />{t.label}
            </label>
          ))}
          <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={showDuties} onChange={(e) => setShowDuties(e.target.checked)} />My duties</label>
        </div>
      </div>

      {view === 'month' && (
        <div className="cal-month">
          {WEEKDAYS.map(([, d]) => <div key={d} className="dow">{d}</div>)}
          {monthGrid(toDate(cursor).getFullYear(), toDate(cursor).getMonth()).map((d) => {
            const inMonth = toDate(d).getMonth() === toDate(cursor).getMonth();
            const evs = eventsOnDay(shown, d);
            const md = myDuties.filter((x) => x.date === d);
            return (
              <div key={d} className={'cal-day' + (inMonth ? '' : ' other') + (d === s.today ? ' today' : '')} onClick={() => { setCursor(d); setView('day'); }}>
                <div className="num">{toDate(d).getDate()}</div>
                {md.map((x) => <DutyChip key={x.id} d={x} />)}
                {evs.slice(0, 3).map((o, i) => <Ev key={o.id + i} o={o} />)}
                {evs.length > 3 && <div className="tiny muted">+{evs.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      )}

      {(view === 'week' || view === 'day') && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {eachDay(range[0], range[1]).map((d) => {
            const evs = eventsOnDay(shown, d);
            const md = myDuties.filter((x) => x.date === d);
            return (
              <div key={d} className="agenda-day" style={{ padding: '14px 18px', background: d === s.today ? 'var(--brass-tint)' : undefined }}>
                <div className="d">{dow(d).toUpperCase()}<br /><span style={{ fontSize: 20, fontFamily: 'var(--serif)' }}>{toDate(d).getDate()}</span> {fmt(d, { month: 'short' })}
                  {s.isAdmin && s.canWrite && <div><button className="btn ghost sm no-print" style={{ padding: '4px 0' }} onClick={() => openNew(d)}>+ Add</button></div>}
                </div>
                <div>
                  {md.map((x) => <div key={x.id} className="agenda-item"><span className="badge brass">Duty</span><b className="small">{s.catById[x.categoryId]?.name}</b><span className="mono tiny muted">{s.catById[x.categoryId]?.startTime}</span></div>)}
                  {evs.map((o, i) => <AgendaItem key={o.id + i} o={o} onClick={() => setEdit({ ...rawEvents.find((x) => x.id === o.id), _occ: o.occurrence })} />)}
                  {!evs.length && !md.length && <span className="muted small">Nothing scheduled</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'agenda' && (
        <div className="card">
          {shown.length === 0 && <p className="muted">No events in this term{terms.data.length ? '' : '. Add term dates to use the term view'}.</p>}
          {Object.entries(shown.reduce((acc, o) => { (acc[o.occurrence] ||= []).push(o); return acc; }, {})).map(([d, list]) => (
            <div key={d} className="agenda-day" style={d < s.today ? { opacity: .5 } : undefined}>
              <div className="d">{fmtMed(d)}</div>
              <div>{list.map((o, i) => <AgendaItem key={o.id + i} o={o} onClick={() => setEdit({ ...rawEvents.find((x) => x.id === o.id), _occ: o.occurrence })} />)}</div>
            </div>
          ))}
        </div>
      )}

      {s.isAdmin && s.plan.features.publicRoster && <div className="card no-print"><CalendarFeed scope="school" /></div>}
      {edit && <EventModal ev={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AgendaItem({ o, onClick }) {
  return (
    <button className="agenda-item" onClick={onClick} style={{ background: 'none', border: 0, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
      <span className="dot" style={{ background: EVENT_TYPES[o.type]?.color, marginTop: 6 }} />
      <span>
        <b className="small">{o.title}</b>
        <span className="tiny muted"> · {EVENT_TYPES[o.type]?.label}{o.phase && o.phase !== 'all' ? ` · ${PHASES[o.phase]}` : ''}{o.allDay === false && o.startTime ? ` · ${o.startTime}–${o.endTime}` : ''}{o.occEnd !== o.occurrence ? ` · until ${fmtMed(o.occEnd)}` : ''}{o.location ? ` · ${o.location}` : ''}</span>
        {o.description && <div className="tiny muted" style={{ whiteSpace: 'pre-wrap' }}>{o.description}</div>}
      </span>
    </button>
  );
}

function EventModal({ ev, onClose }) {
  const s = useSchool();
  const [f, setF] = useState({ end: '', startTime: '', endTime: '', location: '', description: '', recurrence: null, ...ev });
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const canEdit = s.isAdmin && s.canWrite;
  const recurring = Boolean(ev.id && ev.recurrence?.freq);
  const savedTemplates = s.school.settings?.eventTemplates || [];

  const save = () => run(async () => {
    if (!f.title.trim() || !f.start) throw new Error('Please add a title and start date.');
    if (f.end && f.end < f.start) throw new Error('The end date is before the start date.');
    const data = {
      title: f.title.trim(), type: f.type, phase: f.phase || 'all', start: f.start, end: f.end || null,
      allDay: f.allDay !== false, startTime: f.allDay === false ? f.startTime : '', endTime: f.allDay === false ? f.endTime : '',
      location: f.location || '', description: f.description || '', private: Boolean(f.private),
      remindDaysBefore: Number(f.remindDaysBefore ?? 1),
      recurrence: f.recurrence?.freq ? { freq: f.recurrence.freq, until: f.recurrence.until || null, weekdaysOnly: f.recurrence.freq === 'daily' } : null,
      exceptions: f.exceptions || [],
    };
    if (ev.id) await s.write([{ type: 'update', coll: 'events', id: ev.id, data }], { action: 'event.update', summary: `Updated event “${data.title}”` });
    else await s.write([{ type: 'set', coll: 'events', data: { ...data, createdBy: s.actor.uid } }], { action: 'event.create', summary: `Added event “${data.title}” on ${fmtMed(data.start)}` });
    onClose();
  }, 'Calendar updated');

  const del = async (onlyThis) => {
    const ok = await confirm({ title: onlyThis ? 'Remove this occurrence?' : 'Delete event?', message: onlyThis ? `Only ${fmtMed(ev._occ)} will be removed from the series.` : `“${ev.title}” will be removed from the calendar${recurring ? ', including all repeats' : ''}.`, danger: true, confirmLabel: 'Delete' });
    if (!ok) return;
    run(async () => {
      if (onlyThis) await s.write([{ type: 'update', coll: 'events', id: ev.id, data: { exceptions: [...(ev.exceptions || []), ev._occ] } }], { action: 'event.update', summary: `Removed ${fmtMed(ev._occ)} from “${ev.title}”` });
      else await s.write([{ type: 'delete', coll: 'events', id: ev.id }], { action: 'event.delete', summary: `Deleted event “${ev.title}”` });
      onClose();
    }, 'Event deleted');
  };

  const saveTemplate = () => run(async () => {
    const t = { title: f.title, type: f.type, phase: f.phase, allDay: f.allDay, startTime: f.startTime, endTime: f.endTime, location: f.location, remindDaysBefore: f.remindDaysBefore };
    const { docUpdate } = await import('../lib/data.js');
    await docUpdate(['schools', s.sid], { 'settings.eventTemplates': [...savedTemplates.filter((x) => x.title !== t.title), t].slice(-20) });
  }, 'Saved as template');

  if (!canEdit) {
    return (
      <Modal title={ev.title} onClose={onClose}>
        <p className="small"><span className="badge" style={{ background: EVENT_TYPES[ev.type]?.color, color: '#fff' }}>{EVENT_TYPES[ev.type]?.label}</span> {PHASES[ev.phase || 'all']}</p>
        <p>{fmtLong(ev._occ || ev.start)}{ev.end && ev.end !== ev.start ? ` – ${fmtLong(ev.end)}` : ''}{ev.allDay === false ? ` · ${ev.startTime}–${ev.endTime}` : ''}</p>
        {ev.location && <p className="small">📍 {ev.location}</p>}
        {ev.description && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</p>}
      </Modal>
    );
  }

  return (
    <Modal wide title={ev.id ? 'Edit event' : 'New event'} onClose={onClose} footer={<>
      {ev.id && <button className="btn danger" onClick={() => del(false)}>Delete{recurring ? ' series' : ''}</button>}
      {recurring && ev._occ && <button className="btn secondary" onClick={() => del(true)}>Delete this date only</button>}
      <div className="spacer" />
      <button className="btn ghost" onClick={saveTemplate} disabled={!f.title}>Save as template</button>
      <button className="btn" disabled={busy} onClick={save}>Save</button>
    </>}>
      {confirmNode}
      {!ev.id && (
        <div className="row mb">
          <span className="tiny muted">Templates:</span>
          {[...TEMPLATES, ...savedTemplates].map((t, i) => <button key={i} className="chip" onClick={() => setF({ ...f, ...t })}>{t.title}</button>)}
        </div>
      )}
      <div className="form-grid">
        <Field label="Title" className="full"><input autoFocus value={f.title} onChange={set('title')} maxLength={140} /></Field>
        <Field label="Type"><select value={f.type} onChange={set('type')}>{Object.entries(EVENT_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></Field>
        <Field label="Applies to"><select value={f.phase || 'all'} onChange={set('phase')}>{Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Start date"><input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="End date" hint="multi-day events"><input type="date" value={f.end || ''} min={f.start} onChange={set('end')} /></Field>
        <label className="check full"><input type="checkbox" checked={f.allDay !== false} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />All day</label>
        {f.allDay === false && <>
          <Field label="Starts"><input type="time" value={f.startTime} onChange={set('startTime')} /></Field>
          <Field label="Ends"><input type="time" value={f.endTime} onChange={set('endTime')} /></Field>
        </>}
        <Field label="Repeats">
          <select value={f.recurrence?.freq || ''} onChange={(e) => setF({ ...f, recurrence: e.target.value ? { ...(f.recurrence || {}), freq: e.target.value } : null })}>
            <option value="">Does not repeat</option><option value="daily">Every school day</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          </select>
        </Field>
        {f.recurrence?.freq ? <Field label="Repeat until"><input type="date" value={f.recurrence.until || ''} min={f.start} onChange={(e) => setF({ ...f, recurrence: { ...f.recurrence, until: e.target.value } })} /></Field> : <div />}
        <Field label="Location"><input value={f.location} onChange={set('location')} maxLength={100} /></Field>
        <Field label="Reminder email">
          <select value={f.remindDaysBefore ?? 1} onChange={set('remindDaysBefore')}>
            <option value={-1}>No reminder</option><option value={0}>Morning of the event</option><option value={1}>1 day before</option><option value={2}>2 days before</option><option value={7}>1 week before</option>
          </select>
        </Field>
        <Field label="Details" className="full"><textarea value={f.description} onChange={set('description')} maxLength={2000} /></Field>
        <label className="check full small"><input type="checkbox" checked={Boolean(f.private)} onChange={set('private')} />Staff only (hide from public roster link and calendar feeds)</label>
      </div>
    </Modal>
  );
}
