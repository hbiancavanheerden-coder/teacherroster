import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useDutiesRange, useAbsences, useEvents, useTerms } from './hooks.js';
import { addDays, eachDay, isoWeekday, startOfWeek, fmt, fmtMed, fmtLong, dow, toDate } from '../lib/dates.js';
import { closedDays } from '../lib/events.js';
import { dutyConflicts } from '../lib/conflicts.js';
import { generateRoster, isAbsent, loadSpread, suggestSubstitutes } from '../lib/scheduler.js';
import { useCollection } from '../lib/data.js';
import { api } from '../lib/api.js';
import { tablePDF } from '../lib/pdf.js';
import { toCSV, download } from '../lib/csv.js';
import { Icon, Modal, Field, Empty, useAction, useToast } from '../components/ui.jsx';
import DocumentImport from './DocumentImport.jsx';

// Closed = holidays, plus days outside configured terms (when terms exist).
export function useClosedDays(events, terms, from, to) {
  return useMemo(() => {
    const set = closedDays(events, from, to);
    if (terms.length) {
      for (const d of eachDay(from, to)) if (!terms.some((t) => t.start <= d && t.end >= d)) set.add(d);
    }
    return set;
  }, [events, terms, from, to]);
}

export default function Roster() {
  const s = useSchool();
  const [anchor, setAnchor] = useState(startOfWeek(s.today));
  const [span, setSpan] = useState(window.innerWidth < 700 ? 1 : 1); // weeks
  const [highlight, setHighlight] = useState('');
  const [editing, setEditing] = useState(null);
  const [gen, setGen] = useState(false);
  const [importing, setImporting] = useState(false);
  const from = anchor;
  const to = addDays(anchor, span * 7 - 1);
  const duties = useDutiesRange(from, to);
  const absences = useAbsences();
  const events = useEvents();
  const terms = useTerms();
  const timetable = useCollection(s.sid, 'timetable');
  const closed = useClosedDays(events.data, terms.data, from, to);
  const schoolDays = s.school.settings?.schoolDays || [1, 2, 3, 4, 5];
  const days = eachDay(from, to).filter((d) => schoolDays.includes(isoWeekday(d)));
  const [run] = useAction();
  const toast = useToast();

  const conflicts = useMemo(() => dutyConflicts({
    duties: duties.data, categories: s.categories, absences: absences.data, timetable: timetable.data,
    periods: s.school.settings?.periods || [], staffById: s.staffById,
  }), [duties.data, s.categories, absences.data, timetable.data, s.school, s.staffById]);
  const conflictIds = new Set(conflicts.flatMap((c) => c.dutyIds));

  const exportRows = () => days.filter((d) => !closed.has(d)).map((d) => [
    fmtMed(d),
    ...s.activeCategories.map((c) => duties.data.filter((x) => x.date === d && x.categoryId === c.id).map((x) => s.staffById[x.staffId]?.name || '').join(', ')),
  ]);
  const pdf = () => run(() => tablePDF({
    filename: `duty-roster-${from}.pdf`, title: `${s.school.name} – Duty roster`, subtitle: `${fmtLong(from)} to ${fmtLong(to)}`,
    head: ['Date', ...s.activeCategories.map((c) => c.name)], body: exportRows(), landscape: s.activeCategories.length > 4,
  }), 'PDF downloaded');
  const csv = () => download(`duty-roster-${from}.csv`, toCSV([['Date', ...s.activeCategories.map((c) => c.name)], ...exportRows()]));

  const requestSwap = (d) => setEditing({ swap: d });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head no-print">
        <div className="row">
          <button className="btn secondary sm" onClick={() => setAnchor(addDays(anchor, -7 * span))} aria-label="Previous"><Icon name="chevL" /></button>
          <button className="btn secondary sm" onClick={() => setAnchor(startOfWeek(s.today))}>This week</button>
          <button className="btn secondary sm" onClick={() => setAnchor(addDays(anchor, 7 * span))} aria-label="Next"><Icon name="chevR" /></button>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{fmt(from)} – {fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
        </div>
        <div className="row">
          <div className="tabs">
            {[1, 2, 4].map((n) => <button key={n} className={span === n ? 'active' : ''} onClick={() => setSpan(n)}>{n === 1 ? 'Week' : `${n} weeks`}</button>)}
          </div>
          <button className="btn secondary sm" onClick={pdf}><Icon name="download" />PDF</button>
          <button className="btn secondary sm desktop-only" onClick={csv}>CSV</button>
          <button className="btn secondary sm desktop-only" onClick={() => window.print()}><Icon name="print" />Print</button>
          {s.isAdmin && <button className="btn secondary sm" disabled={!s.canWrite} onClick={() => setImporting(true)}><Icon name="upload" />Import document</button>}
          {s.isAdmin && <button className="btn sm" disabled={!s.canWrite} onClick={() => setGen(true)}><Icon name="wand" />Auto-schedule</button>}
        </div>
      </div>
      <div className="print-only"><h2>{s.school.name} – Duty roster</h2><p>{fmtLong(from)} – {fmtLong(to)}</p></div>

      <div className="row no-print">
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <input placeholder="Find a teacher's duties…" value={highlight} onChange={(e) => setHighlight(e.target.value)} aria-label="Highlight teacher" />
        </div>
        {conflicts.length > 0 && <span className="badge red"><Icon name="alert" size={12} />{conflicts.length} issue{conflicts.length === 1 ? '' : 's'}</span>}
        {!s.isAdmin && s.plan.features.swaps && <span className="small muted">Tip: tap one of your own duties to ask a colleague to swap.</span>}
      </div>

      {s.activeCategories.length === 0 ? (
        <div className="card"><Empty title="No duty points yet" action={s.isAdmin && <Link to="/app/settings" className="btn">Set up duty points</Link>}>Duty points are the posts teachers cover, like gates, the taxi rank or devotion.</Empty></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div className="roster-grid" style={{ gridTemplateColumns: `minmax(130px, 1.1fr) repeat(${days.length}, minmax(${span > 1 ? 110 : 130}px, 1fr))`, minWidth: 130 + days.length * (span > 1 ? 110 : 130) }}>
            <div className="cell hd">Duty</div>
            {days.map((d) => <div key={d} className={'cell hd' + (d === s.today ? ' today' : '')}>{dow(d)} {toDate(d).getDate()} {span > 1 && fmt(d, { month: 'short' })}</div>)}
            {s.activeCategories.map((c) => (
              <Row key={c.id} c={c} days={days} closed={closed} duties={duties.data} s={s} highlight={highlight.trim().toLowerCase()}
                conflictIds={conflictIds}
                onSlot={(date, duty) => {
                  if (s.isAdmin) { if (s.canWrite) setEditing({ date, category: c, duty }); }
                  else if (duty && duty.staffId === s.myStaffId && s.plan.features.swaps && date >= s.today) requestSwap(duty);
                }} />
            ))}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="card no-print">
          <div className="card-head"><h3>Issues to resolve</h3></div>
          {conflicts.slice(0, 30).map((c, i) => (
            <div key={i} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line-2)', flexWrap: 'nowrap' }}>
              <span className={'badge ' + (c.severity === 'error' ? 'red' : 'brass')}>{c.type.replace('-', ' ')}</span>
              <span className="mono tiny" style={{ flex: '0 0 auto' }}>{fmtMed(c.date)}</span>
              <span className="small">{c.message}</span>
            </div>
          ))}
        </div>
      )}

      {editing?.date && (
        <AssignModal {...editing} onClose={() => setEditing(null)} duties={duties.data} absences={absences.data} closed={closed} />
      )}
      {editing?.swap && <SwapRequestModal duty={editing.swap} onClose={() => setEditing(null)} />}
      {importing && <DocumentImport kind="roster" onClose={() => setImporting(false)} />}
      {gen && <GenerateModal onClose={() => setGen(false)} defaultFrom={from} terms={terms.data} events={events.data} absences={absences.data} onDone={(r) => { setGen(false); toast(`Scheduled ${r} duties`); }} />}
    </div>
  );
}

function Row({ c, days, closed, duties, s, highlight, conflictIds, onSlot }) {
  return (
    <>
      <div className="cell" style={{ fontWeight: 600 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><span className="dot" style={{ background: c.color || 'var(--ink)' }} />{c.name}</div>
        {c.startTime && <div className="mono tiny muted">{c.startTime}–{c.endTime}</div>}
      </div>
      {days.map((d) => {
        if (closed.has(d)) return <div key={d} className="cell closed">Closed</div>;
        if (!(c.days || [1, 2, 3, 4, 5]).includes(isoWeekday(d))) return <div key={d} className="cell" style={{ background: '#FAF6EC' }} />;
        const list = duties.filter((x) => x.date === d && x.categoryId === c.id);
        const need = Math.max(c.staffNeeded || 1, list.length);
        return (
          <div key={d} className="cell">
            {Array.from({ length: need }, (_, i) => {
              const duty = list[i];
              const name = duty ? s.staffById[duty.staffId]?.name || 'Removed staff' : '';
              const isMatch = highlight && name.toLowerCase().includes(highlight);
              const cls = ['slot', !duty && 'empty', duty && conflictIds.has(duty.id) && 'conflict', duty && (duty.staffId === s.myStaffId || isMatch) && 'mine', !s.isAdmin && !(duty && duty.staffId === s.myStaffId) && 'readonly'].filter(Boolean).join(' ');
              return (
                <button key={i} className={cls} onClick={() => onSlot(d, duty)} title={duty?.note || ''}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{duty ? name : s.isAdmin ? '+ Assign' : '—'}</span>
                  {duty?.note && <span className="mono tiny muted">•</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function AssignModal({ date, category, duty, onClose, duties, absences }) {
  const s = useSchool();
  const [staffId, setStaffId] = useState(duty?.staffId || '');
  const [note, setNote] = useState(duty?.note || '');
  const [notify, setNotify] = useState(true);
  const [run, busy] = useAction();
  const subs = suggestSubstitutes({ date, categoryId: category.id, staff: s.activeStaff, duties, absences, limit: 4 });
  const busyThatDay = new Set(duties.filter((d) => d.date === date && d.id !== duty?.id).map((d) => d.staffId));

  const send = (changes) => notify && s.plan.features.emailNotifications && api('notify', { schoolId: s.sid, kind: 'duty_changes', changes }).catch(() => {});

  const save = () => run(async () => {
    if (!staffId) return;
    const name = s.staffById[staffId]?.name;
    if (duty) {
      await s.write([{ type: 'update', coll: 'duties', id: duty.id, data: { staffId, note } }], { action: 'duty.update', summary: `${category.name} on ${fmtMed(date)}: ${s.staffById[duty.staffId]?.name || '—'} → ${name}` });
      if (duty.staffId !== staffId) send([{ staffId: duty.staffId, date, categoryId: category.id, action: 'removed' }, { staffId, date, categoryId: category.id, action: 'assigned' }]);
    } else {
      await s.write([{ type: 'set', coll: 'duties', data: { date, categoryId: category.id, staffId, note, createdBy: s.actor.uid } }], { action: 'duty.assign', summary: `Assigned ${name} to ${category.name} on ${fmtMed(date)}` });
      send([{ staffId, date, categoryId: category.id, action: 'assigned' }]);
    }
    onClose();
  }, 'Roster updated');

  const remove = () => run(async () => {
    await s.write([{ type: 'delete', coll: 'duties', id: duty.id }], { action: 'duty.remove', summary: `Removed ${s.staffById[duty.staffId]?.name || '—'} from ${category.name} on ${fmtMed(date)}` });
    send([{ staffId: duty.staffId, date, categoryId: category.id, action: 'removed' }]);
    onClose();
  }, 'Duty removed');

  return (
    <Modal title={`${category.name} · ${fmtMed(date)}`} onClose={onClose} footer={<>
      {duty && <button className="btn danger" disabled={busy} onClick={remove}>Remove</button>}
      <div className="spacer" />
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={busy || !staffId} onClick={save}>Save</button>
    </>}>
      <div className="stack">
        <Field label="Teacher">
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Choose…</option>
            {s.activeStaff.map((t) => {
              const flags = [isAbsent(absences, t.id, date) && 'absent', busyThatDay.has(t.id) && 'already on duty', (t.excludedCategories || []).includes(category.id) && 'excluded'].filter(Boolean);
              return <option key={t.id} value={t.id}>{t.name}{flags.length ? ` (${flags.join(', ')})` : ''}</option>;
            })}
          </select>
        </Field>
        {subs.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Suggested (available, lowest load this period)</div>
            <div className="row">{subs.map((x) => <button key={x.id} type="button" className={'chip' + (staffId === x.id ? ' active' : '')} onClick={() => setStaffId(x.id)}>{x.name} · {x.load}</button>)}</div>
          </div>
        )}
        <Field label="Note" hint="optional, visible to staff"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Covering for Mr Naidoo" /></Field>
        {s.plan.features.emailNotifications && <label className="check small"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Notify the teachers affected</label>}
      </div>
    </Modal>
  );
}

function SwapRequestModal({ duty, onClose }) {
  const s = useSchool();
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [run, busy] = useAction();
  const candidates = s.activeStaff.filter((x) => x.id !== s.myStaffId && x.uid);
  const submit = () => run(async () => {
    const [id] = await s.write([{ type: 'set', coll: 'swapRequests', data: {
      dutyId: duty.id, date: duty.date, categoryId: duty.categoryId, fromStaffId: s.myStaffId, toStaffId: to,
      message: message.slice(0, 300), status: 'pending', createdBy: s.actor.uid, createdAt: new Date(),
    } }], { action: 'swap.request', summary: `${s.member.name} asked ${s.staffById[to]?.name} to take ${s.catById[duty.categoryId]?.name} on ${fmtMed(duty.date)}` });
    api('notify', { schoolId: s.sid, kind: 'swap', swapId: id }).catch(() => {});
    onClose();
  }, 'Swap request sent');
  return (
    <Modal title="Ask a colleague to swap" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={!to || busy} onClick={submit}>Send request</button></>}>
      <div className="stack">
        <p className="small" style={{ margin: 0 }}><b>{s.catById[duty.categoryId]?.name}</b> on {fmtLong(duty.date)}</p>
        <Field label="Who should take it?">
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose a colleague…</option>
            {candidates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Message" hint="optional"><textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="I have a dentist appointment, can you cover? I’ll take your Thursday." /></Field>
        <p className="tiny muted" style={{ margin: 0 }}>Once your colleague accepts, an administrator approves the swap and the roster updates.</p>
      </div>
    </Modal>
  );
}

function GenerateModal({ onClose, defaultFrom, terms, events, absences, onDone }) {
  const s = useSchool();
  const term = terms.find((t) => t.end >= s.today);
  const [from, setFrom] = useState(term && term.start > s.today ? term.start : defaultFrom < s.today ? s.today : defaultFrom);
  const [to, setTo] = useState(term ? term.end : addDays(defaultFrom, 27));
  const [replace, setReplace] = useState(false);
  const [oneDutyPerDay, setOne] = useState(true);
  const [avoidConsecutive, setAvoid] = useState(true);
  const [notify, setNotify] = useState(true);
  const [seed, setSeed] = useState(1);
  const [preview, setPreview] = useState(null);
  const [run, busy] = useAction();
  const valid = from && to && from <= to && eachDay(from, to).length <= 200;

  const build = () => run(async () => {
    const { getDocs, query, where } = await import('firebase/firestore');
    const { col } = await import('../lib/data.js');
    // Prior load this term (for balancing) and existing duties in the range.
    const termStart = terms.find((t) => t.start <= from && t.end >= from)?.start || addDays(from, -90);
    const snap = await getDocs(query(col(s.sid, 'duties'), where('date', '>=', termStart), where('date', '<=', to)));
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const inRange = all.filter((d) => d.date >= from);
    const prior = {};
    all.filter((d) => d.date < from).forEach((d) => { prior[d.staffId] = (prior[d.staffId] || 0) + 1; });
    const closed = closedDays(events, from, to);
    if (terms.length) eachDay(from, to).forEach((d) => { if (!terms.some((t) => t.start <= d && t.end >= d)) closed.add(d); });
    const schoolDays = s.school.settings?.schoolDays || [1, 2, 3, 4, 5];
    eachDay(from, to).forEach((d) => { if (!schoolDays.includes(isoWeekday(d))) closed.add(d); });
    const result = generateRoster({
      start: from, end: to, categories: s.activeCategories, staff: s.activeStaff, absences, closed,
      existing: replace ? [] : inRange, priorLoad: prior, options: { oneDutyPerDay, avoidConsecutive, seed },
    });
    setPreview({ ...result, inRange, closedCount: closed.size });
  });

  const apply = () => run(async () => {
    const ops = [];
    if (replace) preview.inRange.forEach((d) => ops.push({ type: 'delete', coll: 'duties', id: d.id }));
    preview.assignments.forEach((a) => ops.push({ type: 'set', coll: 'duties', data: { ...a, note: '', createdBy: s.actor.uid, auto: true } }));
    await s.write(ops, { action: 'roster.generate', summary: `Auto-scheduled ${preview.assignments.length} duties ${fmtMed(from)} – ${fmtMed(to)}${replace ? ` (replaced ${preview.inRange.length})` : ''}` });
    if (notify && s.plan.features.emailNotifications) api('notify', { schoolId: s.sid, kind: 'roster_published', from, to }).catch(() => {});
    onDone(preview.assignments.length);
  });

  const spread = preview ? loadSpread(preview.load, s.activeStaff.map((x) => x.id)) : null;
  return (
    <Modal wide title="Auto-schedule duties" onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      {preview && <button className="btn secondary" disabled={busy} onClick={() => { setSeed(seed + 1); setPreview(null); }}>Try another arrangement</button>}
      {preview ? <button className="btn" disabled={busy || !preview.assignments.length} onClick={apply}>{busy ? 'Saving…' : `Apply ${preview.assignments.length} duties`}</button>
        : <button className="btn" disabled={busy || !valid} onClick={build}>{busy ? 'Calculating…' : 'Preview roster'}</button>}
    </>}>
      {!preview ? (
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>Staffboard fills every open duty slot, choosing the available teacher with the lowest load so far this term. It skips weekends, holidays, days outside your terms, absences, excluded duties and weekly limits.</p>
          <div className="form-grid">
            <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          {term && <div className="row"><button className="chip" onClick={() => { setFrom(term.start > s.today ? term.start : s.today); setTo(term.end); }}>Rest of {term.name}</button></div>}
          {!valid && <div className="error-box">Choose a date range of up to 200 days.</div>}
          <label className="check"><input type="checkbox" checked={!replace} onChange={(e) => setReplace(!e.target.checked)} />Keep duties already assigned (only fill empty slots)</label>
          <label className="check"><input type="checkbox" checked={oneDutyPerDay} onChange={(e) => setOne(e.target.checked)} />At most one duty per teacher per day</label>
          <label className="check"><input type="checkbox" checked={avoidConsecutive} onChange={(e) => setAvoid(e.target.checked)} />Avoid duties on consecutive days</label>
          {s.plan.features.emailNotifications && <label className="check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email each teacher their duties when I apply</label>}
          {s.activeStaff.length < 2 && <div className="info-box">Add your staff first. There’s no one to roster yet. <Link to="/app/staff">Add staff</Link></div>}
        </div>
      ) : (
        <div className="stack">
          <div className="grid grid-4">
            <div className="card flat"><div className="stat">{preview.assignments.length}</div><div className="stat-label">New duties</div></div>
            <div className="card flat"><div className="stat" style={{ color: preview.unfilled.length ? 'var(--red)' : undefined }}>{preview.unfilled.length}</div><div className="stat-label">Can’t fill</div></div>
            <div className="card flat"><div className="stat">{spread.min}–{spread.max}</div><div className="stat-label">Duties per teacher</div></div>
            <div className="card flat"><div className="stat">{replace ? preview.inRange.length : 0}</div><div className="stat-label">Replaced</div></div>
          </div>
          {preview.unfilled.length > 0 && (
            <div className="info-box">{preview.unfilled.slice(0, 5).map((u, i) => <div key={i}>{fmtMed(u.date)} · {s.catById[u.categoryId]?.name}: {u.reason}</div>)}{preview.unfilled.length > 5 && <div>…and {preview.unfilled.length - 5} more</div>}</div>
          )}
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Teacher</th><th>Total load this term (incl. new)</th><th>New in this period</th></tr></thead>
              <tbody>
                {s.activeStaff.map((t) => ({ t, total: preview.load[t.id] || 0, n: preview.assignments.filter((a) => a.staffId === t.id).length }))
                  .sort((a, b) => b.total - a.total).map(({ t, total, n }) => (
                    <tr key={t.id}><td>{t.name}{t.dutyWeight && Number(t.dutyWeight) !== 1 ? <span className="badge" style={{ marginLeft: 6 }}>{Math.round(t.dutyWeight * 100)}%</span> : null}</td><td>{total}</td><td>{n}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
