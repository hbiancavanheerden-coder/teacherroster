// Exam invigilation roster (School plan).
import { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection, where } from '../lib/data.js';
import { useAbsences, useDutiesRange } from './hooks.js';
import { addDays, fmtLong, fmtMed } from '../lib/dates.js';
import { autoAssignInvigilators, invigilationBlock, invigilationLoad, minutes } from '../lib/invigilation.js';
import { api } from '../lib/api.js';
import { tablePDF } from '../lib/pdf.js';
import { tableImage, shareImage } from '../lib/shareImage.js';
import { Modal, Field, Empty, Icon, useAction, useConfirm, useToast } from '../components/ui.jsx';
import SchoolOnly from './SchoolOnly.jsx';

export default function Invigilation() {
  return (
    <SchoolOnly feature="invigilation" title="Exam invigilation roster, built for you"
      points={['Add exam sessions once, or for the whole exam timetable', 'Invigilators assigned fairly by time, never two places at once', 'Teachers don’t invigilate their own subject', 'Away staff and duty clashes are avoided automatically', 'Reminders on each teacher’s phone, plus a printable roster']}>
      <InvigilationInner />
    </SchoolOnly>
  );
}

function InvigilationInner() {
  const s = useSchool();
  const exams = useCollection(s.sid, 'exams', [where('date', '>=', addDays(s.today, -60))]);
  const absences = useAbsences();
  const timetable = useCollection(s.sid, 'timetable');
  const sorted = useMemo(() => [...exams.data].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')), [exams.data]);
  const upcoming = sorted.filter((x) => x.date >= s.today);
  const range = upcoming.length ? [upcoming[0].date, upcoming[upcoming.length - 1].date] : [s.today, s.today];
  const duties = useDutiesRange(range[0], range[1]);
  const [edit, setEdit] = useState(null);
  const [allowOwn, setAllowOwn] = useState(false);
  const [run, busy] = useAction();
  const toast = useToast();
  const load = invigilationLoad(sorted);
  const ctx = { staff: s.activeStaff, absences: absences.data, timetable: timetable.data, duties: duties.data, categories: s.categories, periods: s.school.settings?.periods || [] };
  const missing = upcoming.reduce((n, x) => n + Math.max(0, (Number(x.needed) || 1) - (x.invigilatorIds || []).length), 0);

  const autoFill = () => run(async () => {
    const { sessions, unfilled } = autoAssignInvigilators({ sessions: upcoming, allowOwnSubject: allowOwn, ...ctx });
    const changed = sessions.filter((x) => JSON.stringify(x.invigilatorIds) !== JSON.stringify(upcoming.find((u) => u.id === x.id)?.invigilatorIds || []));
    if (!changed.length) { toast(unfilled.length ? 'No one else is available for the remaining slots.' : 'Every session already has its invigilators.'); return; }
    await s.write(changed.map((x) => ({ type: 'update', coll: 'exams', id: x.id, data: { invigilatorIds: x.invigilatorIds } })), { action: 'invigilation.auto', summary: `Assigned invigilators to ${changed.length} exam session(s)` });
    api('notify', { schoolId: s.sid, kind: 'invigilation', examIds: changed.map((x) => x.id) }).catch(() => {});
    toast(unfilled.length ? `Filled what we could. ${unfilled.reduce((n, u) => n + u.missing, 0)} slot(s) still need someone.` : 'All sessions filled. Invigilators have been notified.', unfilled.length ? 'error' : 'ok');
  });

  const rowsFor = (list) => list.map((x) => [fmtMed(x.date), `${x.startTime}–${x.endTime}`, `${x.subject} ${x.grade || ''}`.trim(), x.venue || '', (x.invigilatorIds || []).map((id) => s.staffById[id]?.name).filter(Boolean).join(', ')]);
  const pdf = () => run(() => tablePDF({ filename: 'invigilation.pdf', title: `${s.school.name} – Invigilation roster`, subtitle: `${fmtLong(range[0])} – ${fmtLong(range[1])}`, head: ['Date', 'Time', 'Exam', 'Venue', 'Invigilators'], body: rowsFor(upcoming), landscape: true }));
  const image = () => run(async () => {
    const blob = await tableImage({ title: 'Invigilation roster', subtitle: `${fmtMed(range[0])} – ${fmtMed(range[1])}`, schoolName: s.school.name, head: ['Date & time', 'Exam', 'Invigilators'], rows: upcoming.slice(0, 18).map((x) => [`${fmtMed(x.date)} ${x.startTime}`, `${x.subject} ${x.grade || ''}`.trim(), (x.invigilatorIds || []).map((id) => s.staffById[id]?.name).join(', ')]) });
    await shareImage(blob, 'invigilation.png', 'Invigilation roster');
  });

  const byDate = upcoming.reduce((acc, x) => { (acc[x.date] ||= []).push(x); return acc; }, {});
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h2>Exam invigilation</h2><p className="muted small" style={{ margin: 0 }}>Add the exam sessions, then let StaffBoard assign invigilators fairly.</p></div>
        <div className="row">
          <button className="btn secondary sm" disabled={!upcoming.length} onClick={pdf}><Icon name="print" />PDF</button>
          <button className="btn secondary sm" disabled={!upcoming.length} onClick={image}>Share image</button>
          <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ date: s.today, startTime: '08:00', endTime: '10:00', subject: '', grade: '', venue: '', needed: 2, invigilatorIds: [] })}><Icon name="plus" />Add session</button>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="kpi"><div className="stat">{upcoming.length}</div><div className="stat-label">Upcoming sessions</div></div>
        <div className="kpi"><div className="stat" style={{ color: missing ? 'var(--red)' : 'var(--green)' }}>{missing}</div><div className="stat-label">Invigilator slots open</div></div>
        <div className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn accent" disabled={busy || !s.canWrite || !upcoming.length} onClick={autoFill}><Icon name="wand" />Assign fairly</button>
          <label className="check small"><input type="checkbox" checked={allowOwn} onChange={(e) => setAllowOwn(e.target.checked)} />Allow teachers to invigilate their own subject</label>
        </div>
      </div>

      {!upcoming.length ? <div className="card"><Empty title="No exam sessions yet">Add each paper’s date, time, subject and venue. You can copy a session to add the next one quickly.</Empty></div> : Object.entries(byDate).map(([d, list]) => (
        <div key={d} className="card" style={{ padding: 0 }}>
          <div className="card-head" style={{ padding: '14px 18px 0' }}><h3>{fmtLong(d)}</h3></div>
          {list.map((x) => {
            const need = Number(x.needed) || 1;
            const have = (x.invigilatorIds || []).length;
            return (
              <button key={x.id} onClick={() => s.canWrite && setEdit(x)} className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, borderTop: '1px solid var(--line-2)', padding: '12px 18px', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                <span className="mono small" style={{ width: 110 }}>{x.startTime}–{x.endTime}</span>
                <span style={{ minWidth: 180 }}><b>{x.subject}</b> <span className="muted small">{x.grade}</span><div className="tiny muted">{x.venue}</div></span>
                <span className="row" style={{ gap: 6, flex: 1 }}>{(x.invigilatorIds || []).map((id) => <span key={id} className="chip" style={{ cursor: 'inherit' }}>{s.staffById[id]?.name || '?'}</span>)}</span>
                <span className={'badge ' + (have >= need ? 'green' : 'red')}>{have}/{need}</span>
              </button>
            );
          })}
        </div>
      ))}

      <div className="card">
        <div className="card-head"><h3>Invigilation time per teacher</h3><span className="muted small">this exam period</span></div>
        <div className="row" style={{ gap: 8 }}>{s.activeStaff.map((p) => ({ p, m: load[p.id] || 0 })).sort((a, b) => b.m - a.m).map(({ p, m }) => <span key={p.id} className="chip" style={{ cursor: 'default' }}>{p.name} · <b>{Math.round(m / 6) / 10}h</b></span>)}</div>
      </div>
      {edit && <SessionModal session={edit} sessions={sorted} ctx={ctx} allowOwn={allowOwn} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SessionModal({ session, sessions, ctx, allowOwn, onClose }) {
  const s = useSchool();
  const [f, setF] = useState({ ...session, invigilatorIds: [...(session.invigilatorIds || [])] });
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (id) => setF({ ...f, invigilatorIds: f.invigilatorIds.includes(id) ? f.invigilatorIds.filter((x) => x !== id) : [...f.invigilatorIds, id] });
  const probe = { ...f, id: session.id || '_new' };
  const options = ctx.staff.map((p) => ({ p, block: invigilationBlock({ person: p, session: probe, sessions: sessions.filter((x) => x.id !== session.id), allowOwnSubject: allowOwn, ...ctx }) }));
  const load = invigilationLoad(sessions);

  const save = (copy) => run(async () => {
    if (!f.subject.trim() || !f.date || !f.startTime || !f.endTime) throw new Error('Please fill in the subject, date and times.');
    if (f.endTime <= f.startTime) throw new Error('The session must end after it starts.');
    const data = { date: f.date, startTime: f.startTime, endTime: f.endTime, subject: f.subject.trim(), grade: f.grade.trim(), venue: f.venue.trim(), needed: Math.max(1, Math.min(20, Number(f.needed) || 1)), invigilatorIds: f.invigilatorIds };
    let id = session.id;
    if (session.id) await s.write([{ type: 'update', coll: 'exams', id, data }], { action: 'exam.update', summary: `Updated exam session ${data.subject} on ${fmtMed(data.date)}` });
    else [id] = await s.write([{ type: 'set', coll: 'exams', data }], { action: 'exam.create', summary: `Added exam session ${data.subject} on ${fmtMed(data.date)}` });
    if (data.invigilatorIds.join() !== (session.invigilatorIds || []).join()) api('notify', { schoolId: s.sid, kind: 'invigilation', examIds: [id] }).catch(() => {});
    if (copy) setF({ ...f, subject: '', invigilatorIds: [], id: undefined }); else onClose();
  }, copy ? 'Saved. Add the next one' : 'Session saved');
  const del = async () => {
    if (await confirm({ title: 'Delete this session?', message: `${session.subject} on ${fmtMed(session.date)} will be removed.`, danger: true, confirmLabel: 'Delete' })) {
      run(async () => { await s.write([{ type: 'delete', coll: 'exams', id: session.id }], { action: 'exam.delete', summary: `Deleted exam session ${session.subject}` }); onClose(); }, 'Deleted');
    }
  };
  return (
    <Modal wide title={session.id ? 'Exam session' : 'Add exam session'} onClose={onClose} footer={<>
      {session.id && <button className="btn danger" onClick={del}>Delete</button>}
      <div className="spacer" />
      {!session.id && <button className="btn secondary" disabled={busy} onClick={() => save(true)}>Save & add another</button>}
      <button className="btn" disabled={busy} onClick={() => save(false)}>Save</button>
    </>}>
      {confirmNode}
      <div className="form-grid">
        <Field label="Subject / paper"><input autoFocus value={f.subject} onChange={set('subject')} placeholder="e.g. Mathematics P1" /></Field>
        <Field label="Grade or classes"><input value={f.grade} onChange={set('grade')} placeholder="e.g. Gr 7" /></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Venue"><input value={f.venue} onChange={set('venue')} placeholder="e.g. Hall" /></Field>
        <Field label="Starts"><input type="time" value={f.startTime} onChange={set('startTime')} /></Field>
        <Field label="Ends"><input type="time" value={f.endTime} onChange={set('endTime')} /></Field>
        <Field label="Invigilators needed"><input type="number" min="1" max="20" value={f.needed} onChange={set('needed')} /></Field>
        <div className="small muted" style={{ alignSelf: 'end', paddingBottom: 10 }}>{minutes(f)} minutes</div>
      </div>
      <div className="perf" />
      <div className="label" style={{ marginBottom: 8 }}>Invigilators ({f.invigilatorIds.length}/{f.needed}) · tap to add or remove</div>
      <div className="row" style={{ gap: 7 }}>
        {options.sort((a, b) => Number(Boolean(a.block)) - Number(Boolean(b.block)) || (load[a.p.id] || 0) - (load[b.p.id] || 0)).map(({ p, block }) => {
          const on = f.invigilatorIds.includes(p.id);
          return <button key={p.id} type="button" className={'chip' + (on ? ' active' : '')} onClick={() => toggle(p.id)} style={!on && block ? { opacity: .45 } : undefined} title={block || `${Math.round((load[p.id] || 0) / 6) / 10}h so far`}>{p.name}{block && !on ? ` · ${block}` : ` · ${Math.round((load[p.id] || 0) / 6) / 10}h`}</button>;
        })}
      </div>
    </Modal>
  );
}
