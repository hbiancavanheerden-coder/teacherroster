import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useAbsences, useDutiesRange } from './hooks.js';
import { addDays, fmtMed } from '../lib/dates.js';
import { suggestSubstitutes } from '../lib/scheduler.js';
import { api } from '../lib/api.js';
import { Modal, Field, Empty, Icon, useAction } from '../components/ui.jsx';

const REASONS = ['Sick leave', 'Family responsibility', 'Training / workshop', 'School trip / excursion', 'Personal leave', 'Other'];

export default function Absences() {
  const s = useSchool();
  const absences = useAbsences();
  const duties = useDutiesRange(addDays(s.today, -30), addDays(s.today, 120));
  const [edit, setEdit] = useState(null);
  const [run, busy] = useAction();
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
      { action: 'duty.substitute', summary: `${s.staffById[staffId]?.name} covers ${cat} on ${fmtMed(duty.date)} for ${s.staffById[duty.staffId]?.name}` });
    if (s.plan.features.emailNotifications) api('notify', { schoolId: s.sid, kind: 'duty_changes', changes: [{ staffId, date: duty.date, categoryId: duty.categoryId, action: 'assigned' }, { staffId: duty.staffId, date: duty.date, categoryId: duty.categoryId, action: 'removed' }] }).catch(() => {});
  }, 'Substitute assigned');

  const approve = (a) => run(() => s.write([{ type: 'update', coll: 'absences', id: a.id, data: { status: 'approved' } }], { action: 'absence.approve', summary: `Approved absence for ${s.staffById[a.staffId]?.name}` }), 'Absence confirmed');
  const cancel = (a) => run(() => s.write([{ type: 'update', coll: 'absences', id: a.id, data: { status: 'cancelled' } }], { action: 'absence.cancel', summary: `Cancelled absence for ${s.staffById[a.staffId]?.name}` }), 'Absence cancelled');

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h2>Absences & substitutes</h2><p className="muted small" style={{ margin: 0 }}>{s.isAdmin ? 'Record absences, then cover affected duties with one click.' : 'Let your school know when you’ll be away. Administrators will arrange cover for your duties.'}</p></div>
        <button className="btn sm" disabled={!s.canWrite || (!s.isAdmin && !s.myStaffId)} onClick={() => setEdit({ staffId: s.isAdmin ? '' : s.myStaffId, start: s.today, end: s.today, reason: REASONS[0], note: '' })}><Icon name="plus" />{s.isAdmin ? 'Record absence' : 'Report absence'}</button>
      </div>

      {s.isAdmin && openSlots.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Duties needing cover</h3><span className="badge red">{openSlots.length}</span></div>
          {openSlots.map(({ a, d }) => {
            const subs = suggestSubstitutes({ date: d.date, categoryId: d.categoryId, staff: s.activeStaff.filter((x) => x.id !== a.staffId), duties: duties.data, absences: absences.data, limit: 3 });
            return (
              <div key={d.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span className="mono small" style={{ width: 90 }}>{fmtMed(d.date)}</span>
                <span style={{ minWidth: 160 }}><b className="small">{s.catById[d.categoryId]?.name}</b><div className="tiny muted">{s.staffById[a.staffId]?.name} absent</div></span>
                <div className="spacer" />
                {subs.length ? subs.map((x) => <button key={x.id} disabled={busy || !s.canWrite} className="chip" onClick={() => reassign(d, x.id)} title={`${x.load} duties in this period`}>{x.name} · {x.load}</button>) : <span className="tiny muted">No one available</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        <button className={tab === 'current' ? 'active' : ''} onClick={() => setTab('current')}>Current & upcoming</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>Past</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {visible.length === 0 ? <Empty title="No absences">Nothing recorded {tab === 'current' ? 'for today or later' : 'in the past'}.</Empty> : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Teacher</th><th>Dates</th><th className="desktop-only">Reason</th><th>Duties affected</th><th>Status</th><th /></tr></thead>
              <tbody>{visible.map((a) => {
                const mine = a.createdBy === s.actor.uid;
                return (
                  <tr key={a.id}>
                    <td><b>{s.staffById[a.staffId]?.name || 'Removed staff'}</b></td>
                    <td className="mono small">{fmtMed(a.start)}{a.end && a.end !== a.start ? ` – ${fmtMed(a.end)}` : ''}</td>
                    <td className="desktop-only small">{a.reason}{a.note && <div className="tiny muted">{a.note}</div>}</td>
                    <td>{affected(a).length}</td>
                    <td><span className={'badge ' + (a.status === 'approved' ? 'green' : 'brass')}>{a.status === 'reported' ? 'Reported' : a.status}</span></td>
                    <td className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      {s.isAdmin && a.status === 'reported' && <button className="btn sm secondary" disabled={busy || !s.canWrite} onClick={() => approve(a)}>Confirm</button>}
                      {(s.isAdmin || (mine && a.status === 'reported')) && <button className="btn sm ghost" disabled={busy || !s.canWrite} onClick={() => cancel(a)}>Cancel</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <AbsenceModal absence={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AbsenceModal({ absence, onClose }) {
  const s = useSchool();
  const [f, setF] = useState(absence);
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => {
    if (!f.staffId) throw new Error('Choose a teacher.');
    if (!f.start || (f.end && f.end < f.start)) throw new Error('Check the dates.');
    const data = { staffId: f.staffId, start: f.start, end: f.end || f.start, reason: f.reason, note: (f.note || '').slice(0, 300), status: s.isAdmin ? 'approved' : 'reported', createdBy: s.actor.uid, createdAt: new Date() };
    const [id] = await s.write([{ type: 'set', coll: 'absences', data }], { action: 'absence.create', summary: `${s.staffById[f.staffId]?.name} absent ${fmtMed(data.start)}${data.end !== data.start ? ' – ' + fmtMed(data.end) : ''}` });
    if (s.plan.features.emailNotifications) api('notify', { schoolId: s.sid, kind: 'absence', absenceId: id }).catch(() => {});
    onClose();
  }, 'Absence saved');
  return (
    <Modal title={s.isAdmin ? 'Record absence' : 'Report absence'} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Save</button></>}>
      <div className="form-grid">
        {s.isAdmin && <Field label="Teacher" className="full"><select value={f.staffId} onChange={set('staffId')}><option value="">Choose…</option>{s.activeStaff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
        <Field label="From"><input type="date" value={f.start} onChange={set('start')} /></Field>
        <Field label="To"><input type="date" value={f.end} min={f.start} onChange={set('end')} /></Field>
        <Field label="Reason" className="full"><select value={f.reason} onChange={set('reason')}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Note" hint="optional; don't include medical details" className="full"><input value={f.note} onChange={set('note')} maxLength={300} /></Field>
      </div>
    </Modal>
  );
}
