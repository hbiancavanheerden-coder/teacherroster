// "Import from document": upload a PDF / Word / Excel / photo of an existing duty roster or timetable,
// let Claude read it, then review and confirm every name before anything is saved.
import { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useDoc, ref, fetchCollection, where, docUpdate } from '../lib/data.js';
import { api } from '../lib/api.js';
import { matchStaff, matchByName, matchPeriod } from '../lib/matching.js';
import { fmtMed, WEEKDAYS } from '../lib/dates.js';
import { Modal, Icon, useAction } from '../components/ui.jsx';

const MAX_MB = 4;
const NEW = '__new';
const SKIP = '__skip';
const ACCEPT = '.pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.webp';

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}

export default function DocumentImport({ kind, onClose }) {
  const s = useSchool();
  const [importId, setImportId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const imp = useDoc(importId ? ['schools', s.sid, 'imports', importId] : null);
  const label = kind === 'roster' ? 'duty roster' : 'timetable';

  const start = async (file) => {
    setError('');
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { setError(`That file is larger than ${MAX_MB} MB. Save it as a smaller PDF or split it into parts.`); return; }
    setBusy(true);
    try {
      const data = await readBase64(file);
      const r = await api('import-upload', { schoolId: s.sid, kind, fileName: file.name, mediaType: file.type, data });
      setImportId(r.importId);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const status = imp.data?.status;
  return (
    <Modal wide title={`Import ${label} from a document`} onClose={onClose}>
      {!importId && (
        <div className="stack">
          <p className="small" style={{ margin: 0 }}>Upload the {label} you already have, as a PDF, Word document, Excel sheet or a clear photo. AI reads it and matches names to your staff list. <b>Nothing is saved until you have checked it.</b></p>
          <label className="card flat center" style={{ borderStyle: 'dashed', cursor: busy ? 'wait' : 'pointer', padding: 32 }}>
            <Icon name="upload" size={28} />
            <div style={{ fontWeight: 600, marginTop: 8 }}>{busy ? 'Uploading…' : 'Choose a file'}</div>
            <div className="tiny muted">PDF, Word (.docx), Excel (.xlsx), CSV, PNG or JPG · up to {MAX_MB} MB</div>
            <input type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => start(e.target.files?.[0])} />
          </label>
          {error && <div className="error-box">{error}</div>}
          <p className="tiny muted" style={{ margin: 0 }}>Tip: add your staff, duty points{kind === 'timetable' ? ', bell times' : ''} and term dates first. Matching works best when they exist. The document is processed by Anthropic’s Claude and deleted straight after reading.</p>
        </div>
      )}
      {importId && (!imp.data || status === 'processing') && (
        <div className="empty">
          <div className="register" style={{ width: 60, margin: '0 auto 16px' }}><div className="pin" style={{ animation: 'rise 1s ease infinite alternate' }} /></div>
          <h3>Reading {imp.data?.fileName || 'your document'}…</h3>
          <p className="small">This usually takes 30 seconds to two minutes. You can keep this window open.</p>
        </div>
      )}
      {status === 'failed' && (
        <div className="stack">
          <div className="error-box">{imp.data.error || 'The document could not be read.'}</div>
          <button className="btn secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setImportId(null)}>Try another file</button>
        </div>
      )}
      {status === 'imported' && <div className="ok-box">This document has been imported.</div>}
      {status === 'ready' && (kind === 'roster'
        ? <RosterReview imp={imp.data} importId={importId} onDone={onClose} onRetry={() => setImportId(null)} />
        : <TimetableReview imp={imp.data} importId={importId} onDone={onClose} onRetry={() => setImportId(null)} />)}
    </Modal>
  );
}

// ---------- shared mapping table ----------
function MappingTable({ title, rows, options, newLabel, mapping, setMapping }) {
  if (!rows.length) return null;
  const unmatched = rows.filter((r) => !mapping[r.raw] || mapping[r.raw] === SKIP).length;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 6 }}>
        <div className="label">{title}</div>
        {unmatched > 0 ? <span className="badge red">{unmatched} to check</span> : <span className="badge green">All matched</span>}
      </div>
      <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>In the document</th><th>Rows</th><th>Use</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.raw} style={{ background: !mapping[r.raw] ? 'var(--red-tint)' : r.how === 'likely' && mapping[r.raw] === r.matched ? 'var(--amber-tint)' : undefined }}>
                <td><b>{r.raw || '(blank)'}</b>{r.how === 'likely' && mapping[r.raw] === r.matched && <div className="tiny muted">likely match, please check</div>}</td>
                <td className="small">{r.count}</td>
                <td>
                  <select value={mapping[r.raw] || ''} onChange={(e) => setMapping({ ...mapping, [r.raw]: e.target.value })} style={{ minWidth: 200 }} aria-label={`Match for ${r.raw}`}>
                    <option value="">Choose…</option>
                    {newLabel && <option value={NEW}>{newLabel}: “{r.raw}”</option>}
                    <option value={SKIP}>Skip these rows</option>
                    <optgroup label="Existing">{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useMapping(values, matcher) {
  const rows = useMemo(() => {
    const counts = {};
    values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).map(([raw, count]) => { const m = matcher(raw); return { raw, count, matched: m.id, how: m.how }; })
      .sort((a, b) => Number(Boolean(a.matched)) - Number(Boolean(b.matched)) || a.raw.localeCompare(b.raw));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join('\u0001')]);
  const [mapping, setMapping] = useState(() => Object.fromEntries(rows.map((r) => [r.raw, r.matched || ''])));
  return { rows, mapping, setMapping };
}

function Warnings({ imp }) {
  const w = imp.result?.warnings || [];
  return (
    <>
      {imp.result?.documentType === 'other' && <div className="error-box">This doesn’t look like a duty roster or timetable.</div>}
      {w.length > 0 && <details className="info-box"><summary style={{ cursor: 'pointer' }}><b>{w.length} note{w.length === 1 ? '' : 's'} from the reader</b></summary><ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>{w.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
    </>
  );
}

async function markImported(sid, importId) {
  await docUpdate(['schools', sid, 'imports', importId], { status: 'imported' });
}

// ---------- roster review ----------
export function RosterReview({ imp, importId, onDone, onRetry }) {
  const s = useSchool();
  const duties = useMemo(() => (imp.result?.duties || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)), [imp]);
  const staffMap = useMapping(duties.map((d) => d.staffName), (raw) => matchStaff(raw, s.staff));
  const pointMap = useMapping(duties.map((d) => d.dutyPoint), (raw) => matchByName(raw, s.categories));
  const [replace, setReplace] = useState(true);
  const [notify, setNotify] = useState(false);
  const [run, busy] = useAction();
  const dates = duties.map((d) => d.date).sort();
  const from = dates[0], to = dates[dates.length - 1];

  const missing = staffMap.rows.some((r) => !staffMap.mapping[r.raw]) || pointMap.rows.some((r) => !pointMap.mapping[r.raw]);
  const usable = duties.filter((d) => ![SKIP, ''].includes(staffMap.mapping[d.staffName]) && ![SKIP, ''].includes(pointMap.mapping[d.dutyPoint]));

  const doImport = () => run(async () => {
    const ops = [];
    const staffIds = { ...staffMap.mapping };
    const catIds = { ...pointMap.mapping };
    for (const r of staffMap.rows) if (staffIds[r.raw] === NEW) {
      const id = ref(s.sid, 'staff').id; staffIds[r.raw] = id;
      ops.push({ type: 'set', coll: 'staff', id, data: { name: r.raw.trim(), email: '', active: true, phase: 'all', excludedCategories: [], dutyWeight: 1, maxPerWeek: null } });
    }
    let order = s.categories.length;
    for (const r of pointMap.rows) if (catIds[r.raw] === NEW) {
      const id = ref(s.sid, 'dutyCategories').id; catIds[r.raw] = id;
      const sample = duties.find((d) => d.dutyPoint === r.raw) || {};
      ops.push({ type: 'set', coll: 'dutyCategories', id, data: { name: r.raw.trim(), order: order++, staffNeeded: 1, days: [1, 2, 3, 4, 5], phase: 'all', active: true, color: '#1E2638', startTime: sample.startTime || '', endTime: sample.endTime || '' } });
    }
    // Existing duties in the same date range
    const existing = await fetchCollection(s.sid, 'duties', [where('date', '>=', from), where('date', '<=', to)]);
    const rows = usable.map((d) => ({ date: d.date, categoryId: catIds[d.dutyPoint], staffId: staffIds[d.staffName], note: d.note || '' }));
    const slots = new Set(rows.map((r) => r.date + '|' + r.categoryId));
    if (replace) existing.filter((e) => slots.has(e.date + '|' + e.categoryId)).forEach((e) => ops.push({ type: 'delete', coll: 'duties', id: e.id }));
    const seen = new Set(replace ? [] : existing.map((e) => `${e.date}|${e.categoryId}|${e.staffId}`));
    let added = 0;
    for (const r of rows) {
      const k = `${r.date}|${r.categoryId}|${r.staffId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      ops.push({ type: 'set', coll: 'duties', data: { ...r, createdBy: s.actor.uid, imported: true } });
      added++;
    }
    await s.write(ops, { action: 'roster.import', summary: `Imported ${added} duties (${fmtMed(from)} – ${fmtMed(to)}) from ${imp.fileName}` });
    await markImported(s.sid, importId);
    if (notify && s.plan.features.emailNotifications) api('notify', { schoolId: s.sid, kind: 'roster_published', from, to }).catch(() => {});
    onDone();
    return added;
  }, 'Roster imported');

  if (!duties.length) return <div className="stack"><Warnings imp={imp} /><div className="error-box">No duties were found in this document.</div><button className="btn secondary" style={{ alignSelf: 'flex-start' }} onClick={onRetry}>Try another file</button></div>;

  return (
    <div className="stack">
      <div className="ok-box">Found <b>{duties.length} duties</b> from {fmtMed(from)} to {fmtMed(to)} in <b>{imp.fileName}</b>. Check the matches below, then import.</div>
      <Warnings imp={imp} />
      <MappingTable title="Teachers" rows={staffMap.rows} options={s.staff} newLabel="Add as new staff" mapping={staffMap.mapping} setMapping={staffMap.setMapping} />
      <MappingTable title="Duty points" rows={pointMap.rows} options={s.categories} newLabel="Add as new duty point" mapping={pointMap.mapping} setMapping={pointMap.setMapping} />
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>Preview the duties ({Math.min(usable.length, 200)} of {usable.length} shown)</summary>
        <div className="table-wrap mt" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Duty point</th><th>Teacher</th><th>Note</th></tr></thead>
            <tbody>{usable.slice(0, 200).map((d, i) => {
              const sid = staffMap.mapping[d.staffName]; const cid = pointMap.mapping[d.dutyPoint];
              return <tr key={i}><td className="mono small">{fmtMed(d.date)}</td><td>{cid === NEW ? `${d.dutyPoint} (new)` : s.catById[cid]?.name}</td><td>{sid === NEW ? `${d.staffName} (new)` : s.staffById[sid]?.name}</td><td className="small muted">{d.note}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </details>
      <label className="check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace duties already on the roster for the same dates and duty points</label>
      {s.plan.features.emailNotifications && <label className="check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Email each teacher their duties after importing</label>}
      {missing && <div className="info-box">Choose a match (or “Skip”) for every red row to continue.</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={onRetry}>Use a different file</button>
        <button className="btn" disabled={busy || missing || !usable.length || !s.canWrite} onClick={doImport}>{busy ? 'Importing…' : `Import ${usable.length} duties`}</button>
      </div>
    </div>
  );
}

// ---------- timetable review ----------
export function TimetableReview({ imp, importId, onDone, onRetry }) {
  const s = useSchool();
  const periods = s.school.settings?.periods || [];
  const lessons = useMemo(() => (imp.result?.lessons || []).filter((l) => l.day >= 1 && l.day <= 7), [imp]);
  const periodKey = (l) => `${l.period}${l.startTime ? ' · ' + l.startTime : ''}`;
  const staffMap = useMapping(lessons.map((l) => l.staffName), (raw) => matchStaff(raw, s.staff));
  const periodMap = useMapping(lessons.map(periodKey), (raw) => { const [name, time] = raw.split(' · '); return matchPeriod(name, time, periods); });
  const [replace, setReplace] = useState(true);
  const [run, busy] = useAction();
  const periodOptions = periods.map((p, i) => ({ id: String(i), name: `${p.name} (${p.start}–${p.end})`, isBreak: p.isBreak })).filter((p) => !p.isBreak);

  const missing = staffMap.rows.some((r) => !staffMap.mapping[r.raw]) || periodMap.rows.some((r) => !periodMap.mapping[r.raw]);
  const usable = lessons.filter((l) => ![SKIP, ''].includes(staffMap.mapping[l.staffName]) && ![SKIP, ''].includes(periodMap.mapping[periodKey(l)]) && l.className);

  const doImport = () => run(async () => {
    const ops = [];
    const staffIds = { ...staffMap.mapping };
    for (const r of staffMap.rows) if (staffIds[r.raw] === NEW) {
      const id = ref(s.sid, 'staff').id; staffIds[r.raw] = id;
      ops.push({ type: 'set', coll: 'staff', id, data: { name: r.raw.trim(), email: '', active: true, phase: 'all', excludedCategories: [], dutyWeight: 1, maxPerWeek: null } });
    }
    const rows = usable.map((l) => ({ staffId: staffIds[l.staffName], day: Number(l.day), periodIndex: Number(periodMap.mapping[periodKey(l)]), className: l.className.trim(), subject: (l.subject || '').trim(), room: (l.room || '').trim() }));
    if (replace) {
      const teachers = [...new Set(rows.map((r) => r.staffId))];
      const current = await fetchCollection(s.sid, 'timetable');
      current.filter((d) => teachers.includes(d.staffId)).forEach((d) => ops.push({ type: 'delete', coll: 'timetable', id: d.id }));
    }
    rows.forEach((r) => ops.push({ type: 'set', coll: 'timetable', data: { ...r, imported: true } }));
    await s.write(ops, { action: 'timetable.import', summary: `Imported ${rows.length} lessons from ${imp.fileName}` });
    await markImported(s.sid, importId);
    onDone();
  }, 'Timetable imported');

  if (!periods.length) return <div className="info-box">Set up your bell times in Settings first, so lessons can be placed in the right periods.</div>;
  if (!lessons.length) return <div className="stack"><Warnings imp={imp} /><div className="error-box">No lessons were found in this document.</div><button className="btn secondary" style={{ alignSelf: 'flex-start' }} onClick={onRetry}>Try another file</button></div>;

  return (
    <div className="stack">
      <div className="ok-box">Found <b>{lessons.length} lessons</b> in <b>{imp.fileName}</b>. Check the matches below, then import.</div>
      <Warnings imp={imp} />
      <MappingTable title="Teachers" rows={staffMap.rows} options={s.staff} newLabel="Add as new staff" mapping={staffMap.mapping} setMapping={staffMap.setMapping} />
      <MappingTable title="Periods" rows={periodMap.rows} options={periodOptions} mapping={periodMap.mapping} setMapping={periodMap.setMapping} />
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>Preview the lessons ({Math.min(usable.length, 200)} of {usable.length} shown)</summary>
        <div className="table-wrap mt" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Day</th><th>Period</th><th>Teacher</th><th>Class</th><th>Subject</th><th>Room</th></tr></thead>
            <tbody>{usable.slice(0, 200).map((l, i) => {
              const sid = staffMap.mapping[l.staffName];
              return <tr key={i}><td>{WEEKDAYS[l.day - 1][1]}</td><td className="small">{periods[Number(periodMap.mapping[periodKey(l)])]?.name}</td><td>{sid === NEW ? `${l.staffName} (new)` : s.staffById[sid]?.name}</td><td>{l.className}</td><td>{l.subject}</td><td>{l.room}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </details>
      <label className="check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace the existing timetable of the teachers in this document</label>
      {missing && <div className="info-box">Choose a match (or “Skip”) for every red row to continue.</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={onRetry}>Use a different file</button>
        <button className="btn" disabled={busy || missing || !usable.length || !s.canWrite} onClick={doImport}>{busy ? 'Importing…' : `Import ${usable.length} lessons`}</button>
      </div>
    </div>
  );
}
