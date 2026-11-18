import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection } from '../lib/data.js';
import { api } from '../lib/api.js';
import { parseCSV, rowsToStaff, toCSV, download } from '../lib/csv.js';
import { PHASES } from '../lib/events.js';
import { Modal, Field, Empty, Icon, useAction, useConfirm, useToast } from '../components/ui.jsx';

export default function Staff() {
  const s = useSchool();
  const members = useCollection(s.sid, 'members');
  const memberByStaff = Object.fromEntries(members.data.map((m) => [m.staffId, m]));
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const toast = useToast();

  const list = useMemo(() => s.staff.filter((x) => (showInactive || x.active !== false)
    && (phase === 'all' || x.phase === phase)
    && [x.name, x.email, x.department, x.grades, x.position].join(' ').toLowerCase().includes(q.toLowerCase())), [s.staff, q, phase, showInactive]);

  const invitable = list.filter((x) => selected.has(x.id) && x.email && !x.uid);
  const invite = () => run(async () => {
    const r = await api('invite', { schoolId: s.sid, staffIds: invitable.map((x) => x.id) });
    const ok = r.results.filter((x) => x.ok).length;
    const bad = r.results.filter((x) => !x.ok);
    toast(`${ok} invitation${ok === 1 ? '' : 's'} sent${bad.length ? `. ${bad.length} not sent: ${bad.map((b) => `${b.name || ''} (${b.error})`).join('; ')}` : ''}`, bad.length && !ok ? 'error' : 'ok');
    setSelected(new Set());
  });

  const setRole = (m, role) => run(() => s.write([{ type: 'update', coll: 'members', id: m.id, data: { role }, raw: true }], { action: 'member.role', summary: `Changed ${m.name}'s role to ${role}` }), 'Role updated');
  const removeAccount = async (m) => {
    if (await confirm({ title: 'Remove account access?', message: `${m.name} will no longer be able to sign in to ${s.school.name}. Their staff record and duty history stay.`, danger: true, confirmLabel: 'Remove access' })) {
      run(() => api('account', { action: 'remove-member', schoolId: s.sid, uid: m.id }), 'Account access removed');
    }
  };

  const exportCSV = () => download('staff.csv', toCSV([
    ['Name', 'Email', 'Phone', 'Department', 'Grades', 'Phase', 'Position', 'Active', 'Has account'],
    ...s.staff.map((x) => [x.name, x.email, x.phone, x.department, x.grades, PHASES[x.phase || 'all'], x.position, x.active !== false ? 'Yes' : 'No', x.uid ? 'Yes' : 'No']),
  ]));

  return (
    <div className="stack" style={{ gap: 18 }}>
      {confirmNode}
      <div className="page-head">
        <div><h2>Staff</h2><p className="muted small" style={{ margin: 0 }}>{s.activeStaff.length} active staff · {members.data.length} with accounts{s.plan.features.invites ? ` (of ${s.school.billing?.seats})` : ''}</p></div>
        {s.isAdmin && (
          <div className="row">
            <button className="btn secondary sm" onClick={exportCSV}><Icon name="download" />Export</button>
            <button className="btn secondary sm" disabled={!s.canWrite} onClick={() => setImporting(true)}><Icon name="upload" />Import</button>
            <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ name: '', email: '', phone: '', department: '', grades: '', phase: 'all', position: '', active: true, excludedCategories: [], maxPerWeek: '', dutyWeight: 1 })}><Icon name="plus" />Add staff</button>
          </div>
        )}
      </div>

      <div className="row">
        <input placeholder="Search name, subject, grade…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} aria-label="Search staff" />
        <select value={phase} onChange={(e) => setPhase(e.target.value)} style={{ width: 'auto' }} aria-label="Phase">{Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{k === 'all' ? 'All phases' : v}</option>)}</select>
        {s.isAdmin && <label className="check small"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />Show inactive</label>}
        <div className="spacer" />
        {s.isAdmin && s.plan.features.invites && selected.size > 0 && (
          <button className="btn brass sm" disabled={busy || !invitable.length || !s.canWrite} onClick={invite}>Invite {invitable.length} selected</button>
        )}
      </div>
      {s.isAdmin && !s.plan.features.invites && (
        <div className="info-box">On the Teacher plan, you manage the roster yourself and share it with a <Link to="/app/settings">public roster link</Link>. Upgrade to the School plan to give every teacher their own login. <Link to="/app/billing">See plans</Link></div>
      )}

      {list.length === 0 ? <div className="card"><Empty title="No staff found">{s.isAdmin ? 'Add staff one by one or import a spreadsheet.' : ''}</Empty></div> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              {s.isAdmin && s.plan.features.invites && <th style={{ width: 30 }}><input type="checkbox" aria-label="Select all" checked={list.length > 0 && list.every((x) => selected.has(x.id))} onChange={(e) => setSelected(e.target.checked ? new Set(list.map((x) => x.id)) : new Set())} /></th>}
              <th>Name</th><th className="desktop-only">Department</th><th className="desktop-only">Grades</th><th>Phase</th><th>Account</th>{s.isAdmin && <th />}
            </tr></thead>
            <tbody>
              {list.map((x) => {
                const m = memberByStaff[x.id];
                return (
                  <tr key={x.id} style={x.active === false ? { opacity: .5 } : undefined}>
                    {s.isAdmin && s.plan.features.invites && <td><input type="checkbox" aria-label={`Select ${x.name}`} checked={selected.has(x.id)} onChange={(e) => { const n = new Set(selected); e.target.checked ? n.add(x.id) : n.delete(x.id); setSelected(n); }} /></td>}
                    <td><b>{x.name}</b>{x.position && <div className="tiny muted">{x.position}</div>}{s.isAdmin && x.email && <div className="tiny muted">{x.email}</div>}</td>
                    <td className="desktop-only">{x.department}</td>
                    <td className="desktop-only">{x.grades}</td>
                    <td className="small">{x.phase && x.phase !== 'all' ? PHASES[x.phase].replace(' Phase', '') : '–'}</td>
                    <td>
                      {m ? (
                        s.isAdmin && m.role !== 'owner' && m.id !== s.actor.uid ? (
                          <select value={m.role} disabled={!s.canWrite} onChange={(e) => setRole(m, e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }} aria-label="Role">
                            <option value="teacher">Teacher</option><option value="admin">Administrator</option>
                          </select>
                        ) : <span className={'badge ' + (m.role === 'teacher' ? 'blue' : 'green')}>{m.role}</span>
                      ) : x.invitedAt ? <span className="badge brass">Invited</span> : <span className="muted tiny">No account</span>}
                    </td>
                    {s.isAdmin && (
                      <td className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {m && m.role !== 'owner' && m.id !== s.actor.uid && <button className="btn ghost sm" onClick={() => removeAccount(m)}>Remove access</button>}
                        <button className="icon-btn" aria-label={`Edit ${x.name}`} disabled={!s.canWrite} onClick={() => setEdit(x)}><Icon name="edit" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <StaffModal staff={edit} onClose={() => setEdit(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}

function StaffModal({ staff, onClose }) {
  const s = useSchool();
  const [f, setF] = useState({ excludedCategories: [], ...staff });
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = () => run(async () => {
    if (!f.name.trim()) throw new Error('Please enter a name.');
    const email = (f.email || '').trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That email address doesn’t look right.');
    if (email && s.staff.some((x) => x.id !== staff.id && x.email === email)) throw new Error('Another staff member already uses this email.');
    if (staff.uid && email !== staff.email) throw new Error('This teacher has an account; their email can’t be changed here.');
    const data = {
      name: f.name.trim(), email, phone: f.phone || '', department: f.department || '', grades: f.grades || '', phase: f.phase || 'all',
      position: f.position || '', active: f.active !== false, excludedCategories: f.excludedCategories || [],
      maxPerWeek: f.maxPerWeek ? Number(f.maxPerWeek) : null, dutyWeight: Number(f.dutyWeight) || 1,
    };
    if (staff.id) await s.write([{ type: 'update', coll: 'staff', id: staff.id, data }], { action: 'staff.update', summary: `Updated ${data.name}` });
    else await s.write([{ type: 'set', coll: 'staff', data }], { action: 'staff.create', summary: `Added ${data.name}` });
    onClose();
  }, 'Staff saved');
  const del = async () => {
    if (staff.uid) return confirm({ title: 'Remove their account first', message: 'This teacher has an account. Remove their account access first, or mark them inactive to keep their history.', confirmLabel: 'OK' });
    if (await confirm({ title: `Delete ${staff.name}?`, message: 'Their staff record will be deleted. Past duties will show “Removed staff”. To keep history, mark them inactive instead.', danger: true, confirmLabel: 'Delete' })) {
      run(async () => { await s.write([{ type: 'delete', coll: 'staff', id: staff.id }], { action: 'staff.delete', summary: `Deleted ${staff.name}` }); onClose(); }, 'Staff deleted');
    }
  };
  const toggleCat = (id) => setF({ ...f, excludedCategories: f.excludedCategories.includes(id) ? f.excludedCategories.filter((x) => x !== id) : [...f.excludedCategories, id] });

  return (
    <Modal wide title={staff.id ? `Edit ${staff.name}` : 'Add staff member'} onClose={onClose} footer={<>
      {staff.id && <button className="btn danger" onClick={del}>Delete</button>}
      <div className="spacer" />
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={busy} onClick={save}>Save</button>
    </>}>
      {confirmNode}
      <div className="form-grid">
        <Field label="Name"><input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Mrs N. Dlamini" /></Field>
        <Field label="Email" hint="needed for invitations"><input type="email" value={f.email || ''} onChange={set('email')} disabled={Boolean(staff.uid)} /></Field>
        <Field label="Phone"><input value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Position"><input value={f.position || ''} onChange={set('position')} placeholder="Teacher, HOD, Deputy…" /></Field>
        <Field label="Department / subjects"><input value={f.department || ''} onChange={set('department')} /></Field>
        <Field label="Grades"><input value={f.grades || ''} onChange={set('grades')} placeholder="e.g. Gr 4–6" /></Field>
        <Field label="Phase"><select value={f.phase || 'all'} onChange={set('phase')}>{Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{k === 'all' ? 'Not specific / whole school' : v}</option>)}</select></Field>
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={f.active !== false} onChange={set('active')} />Active (included in rosters)</label>
      </div>
      <div className="perf" />
      <div className="label mb">Duty preferences (used by the auto-scheduler)</div>
      <div className="form-grid">
        <Field label="Max duties per week" hint="blank = no limit"><input type="number" min="0" max="20" value={f.maxPerWeek ?? ''} onChange={set('maxPerWeek')} /></Field>
        <Field label="Duty load"><select value={f.dutyWeight ?? 1} onChange={set('dutyWeight')}><option value={1}>Full (100%)</option><option value={0.75}>Reduced (75%)</option><option value={0.5}>Half (50%) e.g. part-time</option><option value={0.25}>Light (25%) e.g. principal</option></select></Field>
        <div className="full">
          <div className="label" style={{ marginBottom: 6 }}>Never schedule for</div>
          <div className="row">{s.categories.map((c) => <button key={c.id} type="button" className={'chip' + (f.excludedCategories.includes(c.id) ? ' active' : '')} onClick={() => toggleCat(c.id)}>{c.name}</button>)}</div>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }) {
  const s = useSchool();
  const [rows, setRows] = useState(null);
  const [errors, setErrors] = useState([]);
  const [run, busy] = useAction();
  const existing = new Set(s.staff.map((x) => x.email).filter(Boolean));
  const existingNames = new Set(s.staff.map((x) => x.name.toLowerCase()));

  const onFile = async (file) => {
    setErrors([]); setRows(null);
    if (!file) return;
    try {
      let table;
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        table = (await readSheet(file)).map((r) => r.map((c) => (c == null ? '' : String(c))));
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        table = parseCSV(await file.text());
      } else throw new Error('Please choose a .xlsx or .csv file.');
      const r = rowsToStaff(table);
      setErrors(r.errors);
      setRows(r.staff.map((x) => ({ ...x, skip: (x.email && existing.has(x.email)) || existingNames.has(x.name.toLowerCase()) })));
    } catch (e) { setErrors([e.message || 'Could not read that file.']); }
  };

  const toAdd = (rows || []).filter((r) => !r.skip);
  const save = () => run(async () => {
    await s.write(toAdd.map((r) => ({ type: 'set', coll: 'staff', data: { name: r.name, email: r.email, phone: r.phone, department: r.department, grades: r.grades, phase: r.phase, position: r.position, active: true, excludedCategories: [], dutyWeight: 1, maxPerWeek: null } })),
      { action: 'staff.import', summary: `Imported ${toAdd.length} staff members` });
    onClose();
  }, `Imported ${toAdd.length} staff`);

  return (
    <Modal wide title="Import staff from Excel or CSV" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !toAdd.length} onClick={save}>Import {toAdd.length || ''} staff</button></>}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>Columns: <b>Name</b> (required), Surname, Email, Phone, Department, Grades, Phase, Position. <a href="/staff-import-template.csv" download>Download the template</a>.</p>
        <input type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Spreadsheet file" />
        {errors.length > 0 && <div className="info-box">{errors.slice(0, 8).map((e, i) => <div key={i}>{e}</div>)}</div>}
        {rows && (
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Phase</th><th>Status</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} style={r.skip ? { opacity: .5 } : undefined}><td>{r.name}</td><td>{r.email}</td><td>{r.department}</td><td>{PHASES[r.phase]}</td><td>{r.skip ? <span className="badge">Already exists</span> : <span className="badge green">New</span>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
