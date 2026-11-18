import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { useSchool } from '../context/SchoolContext.jsx';
import { api } from '../lib/api.js';
import { PHASES } from '../lib/events.js';
import { WEEKDAYS } from '../lib/dates.js';
import { Modal, Field, Icon, useAction, useConfirm, useToast } from '../components/ui.jsx';

const COLORS = ['#2F6F5E', '#3B5BA5', '#C28E3F', '#8E3B7A', '#A23E2E', '#1E2638', '#5B7F2B', '#B5651D'];

export default function Settings() {
  const s = useSchool();
  const [tab, setTab] = useState('duties');
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head"><h2>Settings</h2></div>
      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        {[['duties', 'Duty points'], ['periods', 'Bell times'], ['school', 'School'], ['share', 'Sharing']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {!s.canWrite && <div className="info-box">This workspace is read-only until a plan is active.</div>}
      {tab === 'duties' && <Categories />}
      {tab === 'periods' && <Periods />}
      {tab === 'school' && <School />}
      {tab === 'share' && <Share />}
    </div>
  );
}

async function updateSchool(s, patch, summary) {
  await updateDoc(doc(db, 'schools', s.sid), patch);
  await s.write([], { action: 'settings.update', summary });
}

function Categories() {
  const s = useSchool();
  const [edit, setEdit] = useState(null);
  const [run] = useAction();
  const move = (c, dir) => run(async () => {
    const list = [...s.categories];
    const i = list.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await s.write(list.map((x, k) => ({ type: 'update', coll: 'dutyCategories', id: x.id, data: { order: k } })), { action: 'duty.reorder', summary: 'Reordered duty points' });
  });
  return (
    <div className="card">
      <div className="card-head"><div><h3>Duty points</h3><p className="small muted" style={{ margin: 0 }}>The posts teachers cover, in the order they appear on the roster.</p></div>
        <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ name: '', color: COLORS[s.categories.length % COLORS.length], startTime: '07:00', endTime: '07:45', staffNeeded: 1, days: [1, 2, 3, 4, 5], phase: 'all', active: true })}><Icon name="plus" />Add duty point</button></div>
      {s.categories.length === 0 && <p className="muted">No duty points yet.</p>}
      {s.categories.map((c, i) => (
        <div key={c.id} className="row" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)', opacity: c.active === false ? .5 : 1 }}>
          <span className="dot" style={{ background: c.color }} />
          <b style={{ minWidth: 150 }}>{c.name}</b>
          <span className="mono tiny muted">{c.startTime}–{c.endTime}</span>
          <span className="tiny muted">{c.staffNeeded || 1} staff · {(c.days || []).map((d) => WEEKDAYS[d - 1][1]).join(', ')}{c.phase && c.phase !== 'all' ? ` · ${PHASES[c.phase]}` : ''}</span>
          <div className="spacer" />
          <button className="icon-btn" aria-label="Move up" disabled={i === 0 || !s.canWrite} onClick={() => move(c, -1)}>↑</button>
          <button className="icon-btn" aria-label="Move down" disabled={i === s.categories.length - 1 || !s.canWrite} onClick={() => move(c, 1)}>↓</button>
          <button className="icon-btn" aria-label={`Edit ${c.name}`} disabled={!s.canWrite} onClick={() => setEdit(c)}><Icon name="edit" /></button>
        </div>
      ))}
      {edit && <CategoryModal c={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CategoryModal({ c, onClose }) {
  const s = useSchool();
  const [f, setF] = useState(c);
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = () => run(async () => {
    if (!f.name.trim()) throw new Error('Please name the duty point.');
    if (!f.days.length) throw new Error('Choose at least one day.');
    const data = { name: f.name.trim(), color: f.color, startTime: f.startTime, endTime: f.endTime, staffNeeded: Math.max(1, Math.min(10, Number(f.staffNeeded) || 1)), days: f.days, phase: f.phase, active: f.active !== false };
    if (c.id) await s.write([{ type: 'update', coll: 'dutyCategories', id: c.id, data }], { action: 'duty.category.update', summary: `Updated duty point ${data.name}` });
    else await s.write([{ type: 'set', coll: 'dutyCategories', data: { ...data, order: s.categories.length } }], { action: 'duty.category.create', summary: `Added duty point ${data.name}` });
    onClose();
  }, 'Saved');
  const del = async () => {
    if (await confirm({ title: `Delete ${c.name}?`, message: 'Existing duties for this point will show as “Removed duty”. To keep history, untick “Active” instead.', danger: true, confirmLabel: 'Delete' })) {
      run(async () => { await s.write([{ type: 'delete', coll: 'dutyCategories', id: c.id }], { action: 'duty.category.delete', summary: `Deleted duty point ${c.name}` }); onClose(); }, 'Deleted');
    }
  };
  return (
    <Modal title={c.id ? 'Edit duty point' : 'New duty point'} onClose={onClose} footer={<>
      {c.id && <button className="btn danger" onClick={del}>Delete</button>}<div className="spacer" />
      <button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Save</button>
    </>}>
      {confirmNode}
      <div className="form-grid">
        <Field label="Name" className="full"><input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Back gate, Taxi rank, Aftercare" /></Field>
        <Field label="Starts"><input type="time" value={f.startTime} onChange={set('startTime')} /></Field>
        <Field label="Ends"><input type="time" value={f.endTime} onChange={set('endTime')} /></Field>
        <Field label="Staff needed"><input type="number" min="1" max="10" value={f.staffNeeded} onChange={set('staffNeeded')} /></Field>
        <Field label="Phase" hint="only staff in this phase"><select value={f.phase} onChange={set('phase')}>{Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <div className="full"><div className="label" style={{ marginBottom: 6 }}>Days</div>
          <div className="row">{WEEKDAYS.map(([n, d]) => <button key={n} type="button" className={'chip' + (f.days.includes(n) ? ' active' : '')} onClick={() => setF({ ...f, days: f.days.includes(n) ? f.days.filter((x) => x !== n) : [...f.days, n].sort() })}>{d}</button>)}</div></div>
        <div className="full"><div className="label" style={{ marginBottom: 6 }}>Colour</div>
          <div className="row">{COLORS.map((col) => <button key={col} type="button" aria-label={col} onClick={() => setF({ ...f, color: col })} style={{ width: 28, height: 28, borderRadius: 8, background: col, border: f.color === col ? '3px solid var(--brass)' : '2px solid #fff', cursor: 'pointer' }} />)}</div></div>
        <label className="check full"><input type="checkbox" checked={f.active !== false} onChange={set('active')} />Active</label>
      </div>
    </Modal>
  );
}

function Periods() {
  const s = useSchool();
  const [list, setList] = useState(s.school.settings?.periods || []);
  const [run, busy] = useAction();
  const upd = (i, k, v) => setList(list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const save = () => run(async () => {
    const clean = list.filter((p) => p.name && p.start && p.end).map((p) => ({ name: p.name.trim(), start: p.start, end: p.end, isBreak: Boolean(p.isBreak) }));
    if (clean.some((p) => p.end <= p.start)) throw new Error('Each period must end after it starts.');
    await updateSchool(s, { 'settings.periods': clean }, 'Updated bell times');
  }, 'Bell times saved');
  return (
    <div className="card">
      <div className="card-head"><div><h3>Bell times</h3><p className="small muted" style={{ margin: 0 }}>Used for timetables and duty-versus-lesson clash checks. Changing the order affects existing timetables.</p></div></div>
      {list.map((p, i) => (
        <div key={i} className="row" style={{ padding: '6px 0', flexWrap: 'nowrap' }}>
          <input value={p.name} onChange={(e) => upd(i, 'name', e.target.value)} style={{ maxWidth: 180 }} aria-label="Period name" />
          <input type="time" value={p.start} onChange={(e) => upd(i, 'start', e.target.value)} style={{ width: 120 }} aria-label="Start" />
          <input type="time" value={p.end} onChange={(e) => upd(i, 'end', e.target.value)} style={{ width: 120 }} aria-label="End" />
          <label className="check small"><input type="checkbox" checked={Boolean(p.isBreak)} onChange={(e) => upd(i, 'isBreak', e.target.checked)} />Break</label>
          <button className="icon-btn" aria-label="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}><Icon name="trash" /></button>
        </div>
      ))}
      <div className="row mt">
        <button className="btn secondary sm" onClick={() => { const last = list[list.length - 1]; setList([...list, { name: `Period ${list.filter((x) => !x.isBreak).length + 1}`, start: last?.end || '08:00', end: last?.end || '08:45', isBreak: false }]); }}><Icon name="plus" />Add period</button>
        <div className="spacer" />
        <button className="btn" disabled={busy || !s.canWrite} onClick={save}>Save bell times</button>
      </div>
    </div>
  );
}

function School() {
  const s = useSchool();
  const [f, setF] = useState({ name: s.school.name, timezone: s.school.timezone || 'Africa/Johannesburg', schoolDays: s.school.settings?.schoolDays || [1, 2, 3, 4, 5] });
  const [run, busy] = useAction();
  const save = () => run(async () => {
    if (f.name.trim().length < 2) throw new Error('Please enter the school name.');
    await updateSchool(s, { name: f.name.trim(), timezone: f.timezone, 'settings.schoolDays': f.schoolDays }, `Updated school details`);
  }, 'Saved');
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3>School details</h3>
      <div className="stack">
        <Field label="School name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Time zone"><select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{['Africa/Johannesburg', 'Africa/Windhoek', 'Africa/Gaborone', 'Africa/Maputo', 'Africa/Harare', 'Africa/Lusaka', 'Africa/Nairobi', 'Europe/London'].map((z) => <option key={z}>{z}</option>)}</select></Field>
        <div><div className="label" style={{ marginBottom: 6 }}>School days</div>
          <div className="row">{WEEKDAYS.map(([n, d]) => <button key={n} type="button" className={'chip' + (f.schoolDays.includes(n) ? ' active' : '')} onClick={() => setF({ ...f, schoolDays: f.schoolDays.includes(n) ? f.schoolDays.filter((x) => x !== n) : [...f.schoolDays, n].sort() })}>{d}</button>)}</div></div>
        <button className="btn" style={{ alignSelf: 'flex-start' }} disabled={busy || !s.canWrite} onClick={save}>Save</button>
      </div>
    </div>
  );
}

function Share() {
  const s = useSchool();
  const [links, setLinks] = useState(null);
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const toast = useToast();
  const load = () => api('links', { schoolId: s.sid, action: 'list' }).then((r) => setLinks(r.links.filter((l) => l.type === 'roster'))).catch((e) => { toast(e.message, 'error'); setLinks([]); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const create = () => run(async () => { await api('links', { schoolId: s.sid, action: 'create', type: 'roster' }); await load(); }, 'Link created');
  const revoke = async (l) => {
    if (await confirm({ title: 'Revoke link?', message: 'Anyone using this link will lose access immediately.', danger: true, confirmLabel: 'Revoke' })) {
      run(async () => { await api('links', { schoolId: s.sid, action: 'revoke', token: l.token }); await load(); }, 'Link revoked');
    }
  };
  return (
    <div className="card" style={{ maxWidth: 760 }}>
      {confirmNode}
      <h3>Public roster link</h3>
      <p className="small muted">A read-only “noticeboard” page that staff can open on their phones without an account. It shows staff names, duties and school calendar events (not emails or phone numbers). Anyone with the link can view it, so share it only with your staff, for example in the staff WhatsApp group.</p>
      {links === null ? <p className="muted small">Loading…</p> : links.length === 0 ? (
        <button className="btn" disabled={busy || !s.canWrite} onClick={create}><Icon name="link" />Create roster link</button>
      ) : links.map((l) => {
        const url = `${window.location.origin}/r/${l.token}`;
        return (
          <div key={l.token} className="stack" style={{ gap: 8 }}>
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Roster link" />
            <div className="row">
              <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copied'); }}>Copy link</button>
              <a className="btn secondary sm" href={url} target="_blank" rel="noreferrer">Open</a>
              <a className="btn secondary sm" href={`https://wa.me/?text=${encodeURIComponent(`Duty roster for ${s.school.name}: ${url}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
              <button className="btn ghost sm" disabled={busy} onClick={() => revoke(l)}>Revoke</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
