import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useTerms, useEvents } from './hooks.js';
import { fmtMed, diffDays, eachDay, isoWeekday } from '../lib/dates.js';
import { PHASES, saPublicHolidays } from '../lib/events.js';
import { Modal, Field, Empty, Icon, useAction, useConfirm } from '../components/ui.jsx';

export default function Terms() {
  const s = useSchool();
  const terms = useTerms();
  const events = useEvents();
  const [edit, setEdit] = useState(null);
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const year = Number(s.today.slice(0, 4));

  const importHolidays = (y) => run(async () => {
    const existing = new Set(events.data.filter((e) => e.type === 'holiday').map((e) => e.start));
    const add = saPublicHolidays(y).filter((h) => !existing.has(h.date));
    await s.write(add.map((h) => ({ type: 'set', coll: 'events', data: { title: h.title, type: 'holiday', phase: 'all', start: h.date, end: null, allDay: true, remindDaysBefore: -1, createdBy: s.actor.uid } })),
      { action: 'event.import', summary: `Imported ${add.length} South African public holidays for ${y}` });
    return add.length;
  }, `Public holidays for ${y} added`);

  const del = async (t) => {
    if (await confirm({ title: 'Delete term?', message: `${t.name} (${fmtMed(t.start)} – ${fmtMed(t.end)}) will be removed. Duties are not affected.`, danger: true, confirmLabel: 'Delete' })) {
      run(() => s.write([{ type: 'delete', coll: 'terms', id: t.id }], { action: 'term.delete', summary: `Deleted ${t.name}` }), 'Term deleted');
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      {confirmNode}
      <div className="page-head">
        <div><h2>Term dates</h2><p className="muted small" style={{ margin: 0 }}>Terms drive the calendar’s term view and tell the auto-scheduler which days are school days. Phases can have their own terms.</p></div>
        <div className="row">
          <button className="btn secondary sm" disabled={busy || !s.canWrite} onClick={() => importHolidays(year)}>Add {year} public holidays</button>
          <button className="btn secondary sm" disabled={busy || !s.canWrite} onClick={() => importHolidays(year + 1)}>Add {year + 1} holidays</button>
          <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ name: `Term ${terms.data.length + 1}`, start: '', end: '', phase: 'all' })}><Icon name="plus" />Add term</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {terms.data.length === 0 ? <Empty title="No terms yet">Add your school terms so the calendar and roster know when school is in session.</Empty> : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Term</th><th>Applies to</th><th>Starts</th><th>Ends</th><th>School days</th><th></th></tr></thead>
              <tbody>
                {terms.data.map((t) => {
                  const schoolDays = eachDay(t.start, t.end).filter((d) => isoWeekday(d) <= 5).length;
                  const status = t.end < s.today ? 'past' : t.start <= s.today ? 'current' : 'upcoming';
                  return (
                    <tr key={t.id} style={status === 'past' ? { opacity: .55 } : undefined}>
                      <td><b>{t.name}</b> {status === 'current' && <span className="badge green">Current</span>}</td>
                      <td>{PHASES[t.phase || 'all']}</td>
                      <td className="mono small">{fmtMed(t.start)}</td>
                      <td className="mono small">{fmtMed(t.end)}</td>
                      <td>{schoolDays} <span className="muted tiny">({diffDays(t.start, t.end) + 1} calendar days)</span></td>
                      <td className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="icon-btn" aria-label="Edit" disabled={!s.canWrite} onClick={() => setEdit(t)}><Icon name="edit" /></button>
                        <button className="icon-btn" aria-label="Delete" disabled={!s.canWrite} onClick={() => del(t)}><Icon name="trash" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <TermModal term={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TermModal({ term, onClose }) {
  const s = useSchool();
  const [f, setF] = useState(term);
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => {
    if (!f.name || !f.start || !f.end) throw new Error('Please fill in the name and both dates.');
    if (f.end < f.start) throw new Error('The term ends before it starts.');
    const data = { name: f.name.trim(), start: f.start, end: f.end, phase: f.phase || 'all' };
    if (term.id) await s.write([{ type: 'update', coll: 'terms', id: term.id, data }], { action: 'term.update', summary: `Updated ${data.name}` });
    else await s.write([{ type: 'set', coll: 'terms', data }], { action: 'term.create', summary: `Added ${data.name} (${fmtMed(data.start)} – ${fmtMed(data.end)})` });
    onClose();
  }, 'Term saved');
  return (
    <Modal title={term.id ? 'Edit term' : 'Add term'} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Name" className="full"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Starts"><input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="Ends"><input type="date" value={f.end} min={f.start} onChange={set('end')} /></Field>
        <Field label="Applies to" className="full"><select value={f.phase} onChange={set('phase')}>{Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
