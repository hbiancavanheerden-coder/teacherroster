// Exam invigilation roster: fair, clash-free assignment of invigilators to exam sessions.
import { timeOverlaps, isoWeekday } from './dates.js';
import { isAbsent } from './scheduler.js';

const norm = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
export const minutes = (s) => {
  if (!s.startTime || !s.endTime) return 60;
  const [h1, m1] = s.startTime.split(':').map(Number); const [h2, m2] = s.endTime.split(':').map(Number);
  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
};

/** Why a staff member can't invigilate a session (null = available). */
export function invigilationBlock({ person, session, sessions, absences = [], timetable = [], duties = [], categories = [], periods = [], allowOwnSubject = false }) {
  if (person.active === false) return 'inactive';
  if (isAbsent(absences, person.id, session.date)) return 'away';
  const clash = sessions.some((o) => o.id !== session.id && o.date === session.date && (o.invigilatorIds || []).includes(person.id) && timeOverlaps(o.startTime, o.endTime, session.startTime, session.endTime));
  if (clash) return 'another session';
  if (!allowOwnSubject && session.subject && timetable.some((l) => l.staffId === person.id && norm(l.subject) === norm(session.subject))) return 'teaches this subject';
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  if (duties.some((d) => d.date === session.date && d.staffId === person.id && timeOverlaps(catById[d.categoryId]?.startTime, catById[d.categoryId]?.endTime, session.startTime, session.endTime))) return 'on duty';
  // Teaching a class (not exam-bound) at that time: only matters if the school keeps teaching during exams.
  const wd = isoWeekday(session.date);
  if (session.teachingContinues && timetable.some((l) => l.staffId === person.id && Number(l.day) === wd && timeOverlaps(periods[l.periodIndex]?.start, periods[l.periodIndex]?.end, session.startTime, session.endTime))) return 'teaching';
  return null;
}

/** Invigilation minutes per staff member across the given sessions. */
export function invigilationLoad(sessions) {
  const load = {};
  sessions.forEach((s) => (s.invigilatorIds || []).forEach((id) => { load[id] = (load[id] || 0) + minutes(s); }));
  return load;
}

/**
 * Fills each session up to `needed` invigilators, choosing the eligible person with the lowest
 * invigilation time so far (weighted by dutyWeight). Existing assignments are kept.
 * Returns { sessions, unfilled: [{sessionId, missing}] }.
 */
export function autoAssignInvigilators({ sessions, staff, absences, timetable, duties, categories, periods, allowOwnSubject = false }) {
  const out = sessions.map((s) => ({ ...s, invigilatorIds: [...(s.invigilatorIds || [])] }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
  const load = invigilationLoad(out);
  const weight = (p) => Math.max(0.1, Number(p.dutyWeight ?? 1));
  const unfilled = [];
  for (const s of out) {
    const need = Math.max(1, Number(s.needed) || 1);
    while (s.invigilatorIds.length < need) {
      const options = staff.filter((p) => !s.invigilatorIds.includes(p.id) && !invigilationBlock({ person: p, session: s, sessions: out, absences, timetable, duties, categories, periods, allowOwnSubject }));
      if (!options.length) { unfilled.push({ sessionId: s.id, missing: need - s.invigilatorIds.length }); break; }
      options.sort((a, b) => (load[a.id] || 0) / weight(a) - (load[b.id] || 0) / weight(b) || a.name.localeCompare(b.name));
      const pick = options[0];
      s.invigilatorIds.push(pick.id);
      load[pick.id] = (load[pick.id] || 0) + minutes(s);
    }
  }
  return { sessions: out, unfilled };
}
