import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection, orderBy, limit } from '../lib/data.js';
import { useDutiesRange, useOccurrences, useAbsences, useTerms } from './hooks.js';
import { addDays, eachDay, isoWeekday, fmtMed, dow, toDate } from '../lib/dates.js';
import { EVENT_TYPES } from '../lib/events.js';
import { dutyConflicts } from '../lib/conflicts.js';
import { isAbsent } from '../lib/scheduler.js';
import RegisterCard from '../components/RegisterCard.jsx';
import PushCard from '../components/PushCard.jsx';
import { Icon } from '../components/ui.jsx';

// "Mrs A. Botha" -> "Mrs Botha"; "Nancy Mokoena" -> "Nancy"
function greetName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'there';
  if (/^(mr|mrs|ms|miss|dr|mnr|mev|mej|prof)\.?$/i.test(parts[0])) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0];
}

export default function Dashboard() {
  const s = useSchool();
  const { today } = s;
  const from = addDays(today, -7);
  const to = addDays(today, 45);
  const duties = useDutiesRange(from, to);
  const { occ } = useOccurrences(today, addDays(today, 21));
  const absences = useAbsences();
  const terms = useTerms();
  const ann = useCollection(s.sid, 'announcements', [orderBy('createdAt', 'desc'), limit(3)]);
  const schoolDays = s.school.settings?.schoolDays || [1, 2, 3, 4, 5];

  const strip = useMemo(() => eachDay(addDays(today, -3), addDays(today, 14)).filter((d) => schoolDays.includes(isoWeekday(d))), [today, schoolDays]);
  const [sel, setSel] = useState(schoolDays.includes(isoWeekday(today)) ? today : strip.find((d) => d > today) || today);

  const dayRows = s.activeCategories
    .map((c) => {
      const ds = duties.data.filter((d) => d.date === sel && d.categoryId === c.id);
      if (!ds.length && !(c.days || [1, 2, 3, 4, 5]).includes(isoWeekday(sel))) return null;
      return {
        key: c.id, label: c.name, color: c.color, time: c.startTime ? `${c.startTime}–${c.endTime}` : '',
        name: ds.map((d) => s.staffById[d.staffId]?.name || '—').join(', '),
        match: ds.some((d) => d.staffId === s.myStaffId),
      };
    })
    .filter(Boolean);

  const mine = duties.data.filter((d) => d.staffId === s.myStaffId && d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const week = eachDay(today, addDays(today, 6));
  const weekDuties = duties.data.filter((d) => d.date >= today && d.date <= addDays(today, 6));
  const conflicts = dutyConflicts({ duties: weekDuties, categories: s.categories, absences: absences.data, staffById: s.staffById });
  const unfilled = week.filter((d) => schoolDays.includes(isoWeekday(d))).flatMap((d) =>
    s.activeCategories.filter((c) => (c.days || [1, 2, 3, 4, 5]).includes(isoWeekday(d)))
      .filter((c) => weekDuties.filter((x) => x.date === d && x.categoryId === c.id).length < (c.staffNeeded || 1)).map((c) => ({ d, c })));
  const absentToday = absences.data.filter((a) => a.status !== 'cancelled' && isAbsent([a], a.staffId, today));
  const currentTerm = terms.data.find((t) => t.start <= today && t.end >= today);
  const nextTerm = terms.data.find((t) => t.start > today);

  const setup = s.isAdmin ? [
    [s.staff.length > 1, 'Add your staff', '/app/staff'],
    [s.categories.length > 0, 'Set up duty points', '/app/settings'],
    [terms.data.length > 0, 'Add term dates', '/app/terms'],
    [duties.data.length > 0, 'Generate your first roster', '/app/roster'],
    [!s.plan.features.invites || s.staff.filter((x) => x.uid).length > 1, 'Invite teachers to their accounts', '/app/staff'],
  ] : [];
  const setupLeft = setup.filter(([done]) => !done);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">{s.school.name}</div>
          <h2>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {greetName(s.member.name)}</h2>
          <div className="muted small">{currentTerm ? `${currentTerm.name} · ends ${fmtMed(currentTerm.end)}` : nextTerm ? `Next: ${nextTerm.name} starts ${fmtMed(nextTerm.start)}` : ''}</div>
        </div>
        {s.isAdmin && <Link to="/app/roster" className="btn"><Icon name="wand" />Plan duties</Link>}
      </div>

      {setupLeft.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Get set up</h3><span className="badge brass">{setup.length - setupLeft.length}/{setup.length} done</span></div>
          <div className="grid grid-3">
            {setup.map(([done, label, to]) => (
              <Link key={label} to={to} className="row" style={{ textDecoration: 'none', color: done ? 'var(--muted)' : 'var(--ink)' }}>
                <span className="dot" style={{ background: done ? 'var(--green)' : 'var(--line)', width: 18, height: 18, display: 'grid', placeItems: 'center', color: '#fff' }}>{done && <Icon name="check" size={12} stroke={3} />}</span>
                <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="row" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 6 }}>
            {strip.map((d) => (
              <button key={d} onClick={() => setSel(d)} className="chip" style={{ flex: '0 0 auto', borderRadius: 10, padding: '6px 10px', textAlign: 'center', lineHeight: 1.3, ...(d === sel ? { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' } : d === today ? { borderColor: 'var(--brass)', boxShadow: 'inset 0 0 0 1px var(--brass)' } : {}) }}>
                <span style={{ display: 'block', fontSize: 9, opacity: .7 }}>{dow(d).toUpperCase()}</span><b style={{ fontSize: 14 }}>{toDate(d).getDate()}</b>
              </button>
            ))}
          </div>
          <RegisterCard date={sel} isToday={sel === today} rows={dayRows} emptyText={s.categories.length ? 'No duties scheduled on this day.' : 'No duty points set up yet.'} />
        </div>

        <div className="stack" style={{ minWidth: 0 }}>
          <PushCard compact hideWhenOn target={{ schoolId: s.sid }} />
          <div className="card">
            <div className="card-head"><h3>My next duties</h3><Link to="/app/my-duties" className="small">All</Link></div>
            {mine.length === 0 ? <p className="muted small" style={{ margin: 0 }}>You have no upcoming duties.</p> : mine.slice(0, 4).map((d) => (
              <div key={d.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span className="mono small">{d.date === today ? 'Today' : fmtMed(d.date)}</span>
                <b className="small">{s.catById[d.categoryId]?.name || 'Duty'}</b>
              </div>
            ))}
          </div>

          {s.isAdmin && (
            <div className="grid grid-3">
              <Link to="/app/roster" className="card flat" style={{ textDecoration: 'none', color: 'inherit' }}><div className="stat" style={{ color: unfilled.length ? 'var(--red)' : undefined }}>{unfilled.length}</div><div className="stat-label">Open slots (7 days)</div></Link>
              <Link to="/app/roster" className="card flat" style={{ textDecoration: 'none', color: 'inherit' }}><div className="stat" style={{ color: conflicts.length ? 'var(--red)' : undefined }}>{conflicts.length}</div><div className="stat-label">Conflicts</div></Link>
              <Link to="/app/absences" className="card flat" style={{ textDecoration: 'none', color: 'inherit' }}><div className="stat">{absentToday.length}</div><div className="stat-label">Absent today</div></Link>
            </div>
          )}

          <div className="card">
            <div className="card-head"><h3>Coming up</h3><Link to="/app/calendar" className="small">Calendar</Link></div>
            {occ.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Nothing on the calendar for the next three weeks.</p> : occ.slice(0, 6).map((o, i) => (
              <div key={o.id + i} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line-2)', flexWrap: 'nowrap' }}>
                <span className="dot" style={{ background: EVENT_TYPES[o.type]?.color || 'var(--ink)' }} />
                <span className="mono tiny" style={{ width: 82, flex: '0 0 auto' }}>{o.occurrence === today ? 'Today' : fmtMed(o.occurrence)}</span>
                <span className="small" style={{ minWidth: 0 }}>{o.title}{o.startTime && o.allDay === false ? <span className="muted"> · {o.startTime}</span> : ''}</span>
              </div>
            ))}
          </div>

          {ann.data.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Announcements</h3><Link to="/app/announcements" className="small">All</Link></div>
              {ann.data.map((a) => (
                <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <b className="small">{a.title}</b>
                  <div className="small muted" style={{ whiteSpace: 'pre-wrap', overflow: 'hidden', maxHeight: 60 }}>{a.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .content > .stack > .grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
