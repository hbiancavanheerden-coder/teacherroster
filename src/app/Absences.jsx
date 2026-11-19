// "Away & cover": an administrator marks who is away so their duties get covered.
// Leave itself (requests, reasons, approval) stays in the school's HR/leave system (e.g. Sage), not here.
import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useAbsences, useDutiesRange } from './hooks.js';
import { addDays, fmtMed } from '../lib/dates.js';
import { suggestSubstitutes } from '../lib/scheduler.js';
import { api } from '../lib/api.js';
import { Modal, Field, Empty, Icon, useAction, useConfirm } from '../components/ui.jsx';

export default function Absences() {
  const s = useSchool();
  const absences = useAbsences();
  const duties = useDutiesRange(addDays(s.today, -30), addDays(s.today, 120));
  const [edit, setEdit] = useState(null);
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const [tab, setTab] = useState('current');

  const visible = absences.data
    .filter((a) => a.status !== 'cancelled')
    .filter((a) => (tab === 'current' ? (a.end || a.start) >= s.today : (a.end || a.start) < s.today))
    .sort((a, b) => (tab === 'current' ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)));

  const affected = (a) => duties.data.filter((d) => d.staffId === a.staffId && d.date >= a.start && d.date <= (a.end || a.start));
  const openSlots = visible.flatMap((a) => affected(a).map((d) => ({ a, d }))).filter(({ d }) => d.date >= s.today);

  const reassign = (duty, staffId) => run(async () => {
    const cat = s.catById[duty.categoryId]?.name;
    await s.write([{ type: 'update', coll: 'duties', id: duty.id, data: { staffId, note: `Cover for ${s.staffById[duty.staffId]?.name}` } }],
      { action: 'duty.cover', summary: `${s.staffById[staffId]?.name} covers ${cat} on ${fmtMed(duty.date)} for ${s.staffById[duty.staffId]?.name}` });
    api('notify', { schoolId: s.sid, kind: 'duty_changes', changes: [{ staffId, date: duty.date, categoryId: duty.categoryId, action: 'assigned' }, { staffId: duty.staffId, date: duty.date, categoryId: duty.categoryId, action: 'removed' }] }).catch(() => {});
  }, 'Cover arranged');

  const remove = async (a) => {
    if (await confirm({ title: 'Remove this?', message: `${s.staffById[a.staffId]?.name} will no longer be marked away ${fmtMed(a.start)}${a.end && a.end !== a.start ? ` – ${fmtMed(a.end)}` : ''}. Cover already arranged stays as it is.`, confirmLabel: 'Remove' })) {
      run(() => s.write([{ type: 'delete', coll: 'absences', id: a.id }], { action: 'away.remove', summary: `${s.staffById[a.staffId]?.name} no longer marked away` }), 'Removed');
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      {confirmNode}
      <div className="page-head">
        <div>
          <h2>Away &amp; cover</h2>
          <p className="muted small" style={{ margin: 0 }}>Mark who’s away and Staffboard finds cover for their duties. Leave approval stays in your usual system (e.g. Sage). We don’t store reasons for leave.</p>
        </div>
        <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ staffId: '', start: s.today, end: s.today, note: '' })}><Icon name="plus" />Mark someone away</button>
      </div>

      {openSlots.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Duties that need cover</h3><span className="badge red">{openSlots.length}</span></div>
          {openSlots.map(({ a, d }) => {
            const subs = suggestSubstitutes({ date: d.date, categoryId: d.categoryId, staff: s.activeStaff.filter((x) => x.id !== a.staffId), duties: duties.data, absences: absences.data, limit: 3 });
            return (
              <div key={d.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span className="mono small" style={{ width: 90 }}>{fmtMed(d.date)}</span>
                <span style={{ minWidth: 160 }}><b className="small">{s.catById[d.categoryId]?.name}</b><div className="tiny muted">{s.staffById[a.staffId]?.name} is away</div></span>
                <div className="spacer" />
                <span className="tiny muted">Free and least busy:</span>
                {subs.length ? subs.map((x) => <button key={x.id} disabled={busy || !s.canWrite} className="chip" onClick={() => reassign(d, x.id)} title={`${x.load} duties in this period`}>{x.name} · {x.load}</button>) : <span className="tiny muted">No one available</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        <button className={tab === 'current' ? 'active' : ''} onClick={() => setTab('current')}>Today &amp; upcoming</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>Past</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {visible.length === 0 ? <Empty title="Nobody is marked away">{tab === 'current' ? 'When a teacher will be out, mark them away here so their duties are covered.' : 'Nothing in the past.'}</Empty> : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Teacher</th><th>Dates</th><th className="desktop-only">Note</th><th>Duties affected</th><th /></tr></thead>
              <tbody>{visible.map((a) => {
                const n = affected(a);
                const uncovered = n.filter((d) => d.date >= s.today).length;
                return (
                  <tr key={a.id}>
                    <td><b>{s.staffById[a.staffId]?.name || 'Removed staff'}</b></td>
                    <td className="mono small">{fmtMed(a.start)}{a.end && a.end !== a.start ? ` – ${fmtMed(a.end)}` : ''}</td>
                    <td className="desktop-only small muted">{a.note}</td>
                    <td>{n.length ? (uncovered ? <span className="badge red">{uncovered} need cover</span> : <span className="badge green">covered</span>) : <span className="muted small">none</span>}</td>
                    <td className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" disabled={busy || !s.canWrite} onClick={() => remove(a)}>Remove</button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <AwayModal away={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AwayModal({ away, onClose }) {
  const s = useSchool();
  const [f, setF] = useState(away);
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => {
    if (!f.staffId) throw new Error('Choose a teacher.');
    if (!f.start || (f.end && f.end < f.start)) throw new Error('Check the dates.');
    const data = { staffId: f.staffId, start: f.start, end: f.end || f.start, note: (f.note || '').slice(0, 120), status: 'away', createdBy: s.actor.uid, createdAt: new Date() };
    await s.write([{ type: 'set', coll: 'absences', data }], { action: 'away.create', summary: `${s.staffById[f.staffId]?.name} away ${fmtMed(data.start)}${data.end !== data.start ? ' – ' + fmtMed(data.end) : ''}` });
    onClose();
  }, 'Marked away. Check the duties that need cover.');
  return (
    <Modal title="Mark someone away" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Teacher" className="full"><select value={f.staffId} onChange={set('staffId')}><option value="">Choose…</option>{s.activeStaff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="From"><input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="To"><input type="date" value={f.end} min={f.start} onChange={set('end')} /></Field>
        <Field label="Note" hint="optional, e.g. “district workshop”. No medical details" className="full"><input value={f.note} onChange={set('note')} maxLength={120} /></Field>
      </div>
    </Modal>
  );
}
