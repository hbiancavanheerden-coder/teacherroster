import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection } from '../lib/data.js';
import { timetableConflicts } from '../lib/conflicts.js';
import { WEEKDAYS } from '../lib/dates.js';
import { tablePDF } from '../lib/pdf.js';
import { Modal, Field, Empty, Icon, useAction } from '../components/ui.jsx';
import DocumentImport from './DocumentImport.jsx';

export default function Timetable() {
  const s = useSchool();
  const tt = useCollection(s.sid, 'timetable');
  const periods = s.school.settings?.periods || [];
  const days = WEEKDAYS.filter(([n]) => (s.school.settings?.schoolDays || [1, 2, 3, 4, 5]).includes(n));
  const classes = useMemo(() => [...new Set(tt.data.map((e) => e.className).filter(Boolean))].sort(), [tt.data]);
  const [mode, setMode] = useState('teacher');
  const [who, setWho] = useState(s.myStaffId || s.activeStaff[0]?.id || '');
  const [cls, setCls] = useState('');
  const [edit, setEdit] = useState(null);
  const [importing, setImporting] = useState(false);
  const [run] = useAction();
  const conflicts = useMemo(() => timetableConflicts(tt.data, s.staffById), [tt.data, s.staffById]);
  const clashIds = new Set(conflicts.flatMap((c) => c.ids));
  const selClass = cls || classes[0] || '';
  const entries = tt.data.filter((e) => (mode === 'teacher' ? e.staffId === who : e.className === selClass));
  const title = mode === 'teacher' ? s.staffById[who]?.name : selClass;
  const lessonCount = entries.length;
  const canEdit = s.isAdmin && s.canWrite;

  const pdf = () => run(() => tablePDF({
    filename: `timetable-${(title || 'timetable').replace(/\s+/g, '-').toLowerCase()}.pdf`, title: `Timetable – ${title}`, subtitle: s.school.name, landscape: true,
    head: ['Period', ...days.map(([, d]) => d)],
    body: periods.map((p, pi) => [`${p.name}\n${p.start}–${p.end}`, ...days.map(([n]) => p.isBreak ? 'Break' : entries.filter((e) => Number(e.day) === n && e.periodIndex === pi)
      .map((e) => [e.subject, mode === 'teacher' ? e.className : s.staffById[e.staffId]?.name, e.room].filter(Boolean).join(' · ')).join('\n'))]),
  }));

  if (!periods.length) return <div className="card"><Empty title="No periods set up" action={s.isAdmin && <Link className="btn" to="/app/settings">Set up periods</Link>}>Add your bell times in Settings first.</Empty></div>;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="row">
          <div className="tabs"><button className={mode === 'teacher' ? 'active' : ''} onClick={() => setMode('teacher')}>By teacher</button><button className={mode === 'class' ? 'active' : ''} onClick={() => setMode('class')}>By class</button></div>
          {mode === 'teacher'
            ? <select value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 'auto' }} aria-label="Teacher">{s.activeStaff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            : classes.length ? <select value={selClass} onChange={(e) => setCls(e.target.value)} style={{ width: 'auto' }} aria-label="Class">{classes.map((c) => <option key={c}>{c}</option>)}</select> : <span className="muted small">No classes yet. Add lessons by teacher first.</span>}
          <span className="badge">{lessonCount} lessons / week</span>
        </div>
        <div className="row">
          {conflicts.length > 0 && <span className="badge red"><Icon name="alert" size={12} />{conflicts.length} clash{conflicts.length === 1 ? '' : 'es'}</span>}
          {canEdit && <button className="btn secondary sm" onClick={() => setImporting(true)}><Icon name="upload" />Import document</button>}
          <button className="btn secondary sm" onClick={pdf}><Icon name="download" />PDF</button>
          <button className="btn secondary sm desktop-only" onClick={() => window.print()}><Icon name="print" />Print</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div className="tt" style={{ gridTemplateColumns: `110px repeat(${days.length}, minmax(120px, 1fr))`, minWidth: 110 + days.length * 120 }}>
          <div className="cell hd">Period</div>
          {days.map(([n, d]) => <div key={n} className="cell hd">{d}</div>)}
          {periods.map((p, pi) => (
            <Row key={pi} p={p} pi={pi} days={days} entries={entries} mode={mode} s={s} clashIds={clashIds} canEdit={canEdit}
              onAdd={(day) => setEdit({ day, periodIndex: pi, staffId: mode === 'teacher' ? who : '', className: mode === 'class' ? selClass : '', subject: '', room: '' })}
              onEdit={(e) => canEdit && setEdit(e)} />
          ))}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="card">
          <h3>Clashes</h3>
          {conflicts.map((c, i) => <div key={i} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line-2)' }}><span className="badge red">{WEEKDAYS.find(([n]) => n === Number(c.day))?.[1]} · {periods[c.periodIndex]?.name}</span> {c.message}</div>)}
        </div>
      )}
      {importing && <DocumentImport kind="timetable" onClose={() => setImporting(false)} />}
      {edit && <LessonModal lesson={edit} classes={classes} onClose={() => setEdit(null)} all={tt.data} />}
    </div>
  );
}

function Row({ p, pi, days, entries, mode, s, clashIds, canEdit, onAdd, onEdit }) {
  return (
    <>
      <div className="cell" style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}<div className="mono tiny muted">{p.start}–{p.end}</div></div>
      {days.map(([n]) => {
        if (p.isBreak) return <div key={n} className="cell brk">Break</div>;
        const list = entries.filter((e) => Number(e.day) === n && e.periodIndex === pi);
        return (
          <div key={n} className="cell">
            {list.map((e) => (
              <button key={e.id} className={'lesson' + (clashIds.has(e.id) ? ' clash' : '')} onClick={() => onEdit(e)} style={{ marginBottom: 3 }}>
                <b>{e.subject || 'Lesson'}</b>
                <div className="tiny">{mode === 'teacher' ? e.className : s.staffById[e.staffId]?.name}{e.room ? ` · ${e.room}` : ''}</div>
              </button>
            ))}
            {!list.length && canEdit && <button className="add" onClick={() => onAdd(n)} aria-label="Add lesson">+</button>}
          </div>
        );
      })}
    </>
  );
}

function LessonModal({ lesson, classes, onClose, all }) {
  const s = useSchool();
  const [f, setF] = useState(lesson);
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const periods = s.school.settings?.periods || [];
  const clashes = timetableConflicts([...all.filter((x) => x.id !== lesson.id), { ...f, id: '_new' }], s.staffById).filter((c) => c.ids.includes('_new'));
  const save = () => run(async () => {
    if (!f.staffId || !f.className) throw new Error('Choose a teacher and class.');
    const data = { staffId: f.staffId, className: f.className.trim(), subject: (f.subject || '').trim(), room: (f.room || '').trim(), day: Number(f.day), periodIndex: Number(f.periodIndex) };
    const label = `${data.subject} ${data.className} (${s.staffById[data.staffId]?.name})`;
    if (lesson.id) await s.write([{ type: 'update', coll: 'timetable', id: lesson.id, data }], { action: 'timetable.update', summary: `Updated lesson ${label}` });
    else await s.write([{ type: 'set', coll: 'timetable', data }], { action: 'timetable.create', summary: `Added lesson ${label}` });
    onClose();
  }, 'Timetable saved');
  const del = () => run(async () => { await s.write([{ type: 'delete', coll: 'timetable', id: lesson.id }], { action: 'timetable.delete', summary: `Removed a ${lesson.subject} lesson` }); onClose(); }, 'Lesson removed');
  return (
    <Modal title={lesson.id ? 'Edit lesson' : 'Add lesson'} onClose={onClose} footer={<>
      {lesson.id && <button className="btn danger" onClick={del} disabled={busy}>Delete</button>}<div className="spacer" />
      <button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" onClick={save} disabled={busy}>Save</button>
    </>}>
      <div className="form-grid">
        <Field label="Day"><select value={f.day} onChange={set('day')}>{WEEKDAYS.slice(0, 5).map(([n, d]) => <option key={n} value={n}>{d}</option>)}</select></Field>
        <Field label="Period"><select value={f.periodIndex} onChange={set('periodIndex')}>{periods.map((p, i) => !p.isBreak && <option key={i} value={i}>{p.name} ({p.start})</option>)}</select></Field>
        <Field label="Teacher"><select value={f.staffId} onChange={set('staffId')}><option value="">Choose…</option>{s.activeStaff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Class"><input list="classes" value={f.className} onChange={set('className')} placeholder="e.g. 5B" /><datalist id="classes">{classes.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Subject"><input value={f.subject} onChange={set('subject')} placeholder="e.g. Mathematics" /></Field>
        <Field label="Room"><input value={f.room} onChange={set('room')} /></Field>
      </div>
      {clashes.length > 0 && <div className="error-box mt">{clashes.map((c, i) => <div key={i}>{c.message}</div>)}</div>}
    </Modal>
  );
}
