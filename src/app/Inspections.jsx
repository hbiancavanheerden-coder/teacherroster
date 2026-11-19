// Inspection & moderation planner (School plan): book/file inspections, moderation and class visits
// with a per-teacher checklist and sign-off.
import { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection } from '../lib/data.js';
import { fmtLong, fmtMed } from '../lib/dates.js';
import { tablePDF } from '../lib/pdf.js';
import { Modal, Field, Empty, Icon, useAction, useConfirm } from '../components/ui.jsx';
import SchoolOnly from './SchoolOnly.jsx';

export const INSPECTION_TYPES = { book: 'Book inspection', file: 'File inspection', moderation: 'Moderation', visit: 'Class visit', other: 'Other' };
const STATUS = { pending: ['Pending', ''], done: ['Done', 'green'], followup: ['Follow-up', 'warm'], na: ['N/A', ''] };

export default function Inspections() {
  return (
    <SchoolOnly feature="inspections" title="Inspection & moderation planner"
      points={['Plan book and file inspections, moderation and class visits', 'Pick the teachers by department in one tap', 'Tick off each teacher with notes and follow-ups', 'Teachers see what’s due and when', 'Printable checklist for your records']}>
      <InspectionsInner />
    </SchoolOnly>
  );
}

function InspectionsInner() {
  const s = useSchool();
  const list = useCollection(s.sid, 'inspections');
  const [tab, setTab] = useState('upcoming');
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const sorted = useMemo(() => [...list.data].sort((a, b) => a.date.localeCompare(b.date)), [list.data]);
  const shown = sorted.filter((x) => (tab === 'upcoming' ? (x.dueDate || x.date) >= s.today : (x.dueDate || x.date) < s.today));
  if (tab === 'past') shown.reverse();
  const progress = (x) => {
    const items = Object.values(x.items || {});
    const done = items.filter((i) => i.status === 'done' || i.status === 'na').length;
    return { done, total: (x.staffIds || []).length };
  };
  const current = open && list.data.find((x) => x.id === open);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h2>Inspections &amp; moderation</h2><p className="muted small" style={{ margin: 0 }}>Plan the inspections, then tick off each teacher.</p></div>
        <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ title: '', type: 'book', date: s.today, dueDate: '', ownerStaffId: s.myStaffId || '', staffIds: [], notes: '' })}><Icon name="plus" />Plan inspection</button>
      </div>
      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>Upcoming &amp; open</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>Past</button>
      </div>
      {shown.length === 0 ? <div className="card"><Empty title="Nothing planned">Plan the term’s book inspections, file inspections and moderation here.</Empty></div> : (
        <div className="grid grid-2">
          {shown.map((x) => {
            const { done, total } = progress(x);
            return (
              <button key={x.id} className="card" onClick={() => setOpen(x.id)} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                <div className="row between"><span className="badge brass">{INSPECTION_TYPES[x.type] || 'Inspection'}</span><span className="mono tiny muted">{fmtMed(x.date)}{x.dueDate && x.dueDate !== x.date ? ` – ${fmtMed(x.dueDate)}` : ''}</span></div>
                <h3 style={{ margin: '10px 0 4px' }}>{x.title}</h3>
                <div className="small muted">By {s.staffById[x.ownerStaffId]?.name || '—'} · {total} teacher{total === 1 ? '' : 's'}</div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-2)', marginTop: 12 }}><div style={{ height: 6, borderRadius: 3, width: `${total ? (done / total) * 100 : 0}%`, background: done === total && total ? 'var(--green)' : 'var(--accent)' }} /></div>
                <div className="tiny muted" style={{ marginTop: 6 }}>{done} of {total} done</div>
              </button>
            );
          })}
        </div>
      )}
      {edit && <PlanModal item={edit} onClose={() => setEdit(null)} />}
      {current && <ChecklistModal item={current} onClose={() => setOpen(null)} onEdit={() => { setEdit(current); setOpen(null); }} />}
    </div>
  );
}

function PlanModal({ item, onClose }) {
  const s = useSchool();
  const [f, setF] = useState({ ...item, staffIds: [...(item.staffIds || [])] });
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const departments = [...new Set(s.activeStaff.map((p) => p.department).filter(Boolean))].sort();
  const toggle = (id) => setF({ ...f, staffIds: f.staffIds.includes(id) ? f.staffIds.filter((x) => x !== id) : [...f.staffIds, id] });
  const addDept = (d) => setF({ ...f, staffIds: [...new Set([...f.staffIds, ...s.activeStaff.filter((p) => p.department === d).map((p) => p.id)])] });
  const save = () => run(async () => {
    if (!f.title.trim() || !f.date) throw new Error('Please add a title and date.');
    if (!f.staffIds.length) throw new Error('Choose the teachers to include.');
    const data = { title: f.title.trim(), type: f.type, date: f.date, dueDate: f.dueDate || null, ownerStaffId: f.ownerStaffId || null, staffIds: f.staffIds, notes: f.notes || '', items: item.items || {} };
    if (item.id) await s.write([{ type: 'update', coll: 'inspections', id: item.id, data }], { action: 'inspection.update', summary: `Updated ${data.title}` });
    else await s.write([{ type: 'set', coll: 'inspections', data }], { action: 'inspection.create', summary: `Planned ${data.title} on ${fmtMed(data.date)} (${f.staffIds.length} teachers)` });
    onClose();
  }, 'Saved');
  const del = async () => {
    if (await confirm({ title: 'Delete this inspection?', message: `“${item.title}” and its checklist will be removed.`, danger: true, confirmLabel: 'Delete' })) {
      run(async () => { await s.write([{ type: 'delete', coll: 'inspections', id: item.id }], { action: 'inspection.delete', summary: `Deleted ${item.title}` }); onClose(); }, 'Deleted');
    }
  };
  return (
    <Modal wide title={item.id ? 'Edit inspection' : 'Plan an inspection'} onClose={onClose} footer={<>
      {item.id && <button className="btn danger" onClick={del}>Delete</button>}<div className="spacer" />
      <button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Save</button>
    </>}>
      {confirmNode}
      <div className="form-grid">
        <Field label="Title" className="full"><input autoFocus value={f.title} onChange={set('title')} placeholder="e.g. Book inspection – Mathematics" /></Field>
        <Field label="Type"><select value={f.type} onChange={set('type')}>{Object.entries(INSPECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Responsible (HOD / SMT)"><select value={f.ownerStaffId} onChange={set('ownerStaffId')}><option value="">Choose…</option>{s.activeStaff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Due / ends" hint="optional"><input type="date" value={f.dueDate || ''} min={f.date} onChange={set('dueDate')} /></Field>
        <Field label="Notes for teachers" className="full"><input value={f.notes} onChange={set('notes')} maxLength={200} placeholder="e.g. Send books to Mona’s class during register" /></Field>
      </div>
      <div className="perf" />
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="label">Teachers ({f.staffIds.length})</div>
        <div className="row" style={{ gap: 6 }}>
          {departments.map((d) => <button key={d} type="button" className="chip" onClick={() => addDept(d)}>+ {d}</button>)}
          <button type="button" className="chip" onClick={() => setF({ ...f, staffIds: s.activeStaff.map((p) => p.id) })}>+ Everyone</button>
          <button type="button" className="chip" onClick={() => setF({ ...f, staffIds: [] })}>Clear</button>
        </div>
      </div>
      <div className="row" style={{ gap: 7 }}>{s.activeStaff.map((p) => <button key={p.id} type="button" className={'chip' + (f.staffIds.includes(p.id) ? ' active' : '')} onClick={() => toggle(p.id)}>{p.name}</button>)}</div>
    </Modal>
  );
}

function ChecklistModal({ item, onClose, onEdit }) {
  const s = useSchool();
  const [items, setItems] = useState(item.items || {});
  const [run, busy] = useAction();
  const setItem = (id, patch) => setItems({ ...items, [id]: { status: 'pending', comment: '', ...(items[id] || {}), ...patch } });
  const save = () => run(async () => {
    const stamped = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { ...v, by: v.status !== (item.items?.[k]?.status) ? s.member.name : (v.by || '') }]));
    await s.write([{ type: 'update', coll: 'inspections', id: item.id, data: { items: stamped } }], { action: 'inspection.checklist', summary: `Updated checklist for ${item.title}` });
    onClose();
  }, 'Checklist saved');
  const pdf = () => run(() => tablePDF({ filename: `${item.title.replace(/\W+/g, '-').toLowerCase()}.pdf`, title: item.title, subtitle: `${INSPECTION_TYPES[item.type]} · ${fmtLong(item.date)} · ${s.school.name}`, head: ['Teacher', 'Department', 'Status', 'Comment', 'Signed'],
    body: (item.staffIds || []).map((id) => { const it = items[id] || {}; return [s.staffById[id]?.name || '', s.staffById[id]?.department || '', STATUS[it.status || 'pending'][0], it.comment || '', it.by || '']; }) }));
  return (
    <Modal wide title={item.title} onClose={onClose} footer={<>
      <button className="btn ghost" onClick={onEdit} disabled={!s.canWrite}>Edit details</button>
      <button className="btn secondary" onClick={pdf}><Icon name="print" />Checklist PDF</button>
      <div className="spacer" /><button className="btn" disabled={busy || !s.canWrite} onClick={save}>Save checklist</button>
    </>}>
      <p className="small muted" style={{ marginTop: 0 }}>{INSPECTION_TYPES[item.type]} · {fmtLong(item.date)}{item.dueDate ? ` – ${fmtLong(item.dueDate)}` : ''} · Responsible: {s.staffById[item.ownerStaffId]?.name || '—'}{item.notes ? ` · ${item.notes}` : ''}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Teacher</th><th>Status</th><th>Comment / follow-up</th></tr></thead>
          <tbody>{(item.staffIds || []).map((id) => {
            const it = items[id] || { status: 'pending' };
            return (
              <tr key={id}>
                <td><b>{s.staffById[id]?.name || 'Removed staff'}</b><div className="tiny muted">{s.staffById[id]?.department}</div></td>
                <td><select value={it.status} onChange={(e) => setItem(id, { status: e.target.value })} style={{ width: 'auto' }} aria-label="Status">{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td><input value={it.comment || ''} onChange={(e) => setItem(id, { comment: e.target.value })} maxLength={200} placeholder="e.g. Marking up to date, 2 corrections outstanding" /></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </Modal>
  );
}
