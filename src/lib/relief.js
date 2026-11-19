// Relief roster: covering the LESSONS of staff who are away, using the timetable.
import { isoWeekday, timeOverlaps } from './dates.js';
import { isAbsent } from './scheduler.js';

export const reliefId = (date, lessonId) => `${date}_${lessonId}`;

/** Lessons on `date` taught by staff marked away. */
export function lessonsNeedingCover({ date, absences, timetable }) {
  const wd = isoWeekday(date);
  return timetable
    .filter((l) => Number(l.day) === wd && isAbsent(absences, l.staffId, date))
    .map((l) => ({ id: reliefId(date, l.id), date, lessonId: l.id, periodIndex: Number(l.periodIndex), absentStaffId: l.staffId, className: l.className || '', subject: l.subject || '', room: l.room || '' }))
    .sort((a, b) => a.periodIndex - b.periodIndex || a.className.localeCompare(b.className));
}

/**
 * Staff who can take a relief lesson: active, not away, not teaching that period,
 * not already covering that period, and not on a duty that overlaps the period's times.
 */
export function freeForRelief({ date, periodIndex, staff, absences, timetable, reliefs, duties = [], categories = [], periods = [], excludeId }) {
  const wd = isoWeekday(date);
  const p = periods[periodIndex];
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  return staff.filter((s) => s.active !== false && s.id !== excludeId)
    .filter((s) => !isAbsent(absences, s.id, date))
    .filter((s) => !timetable.some((l) => l.staffId === s.id && Number(l.day) === wd && Number(l.periodIndex) === periodIndex))
    .filter((s) => !reliefs.some((r) => r.date === date && r.periodIndex === periodIndex && r.coverStaffId === s.id))
    .filter((s) => !p || !duties.some((d) => d.date === date && d.staffId === s.id && timeOverlaps(catById[d.categoryId]?.startTime, catById[d.categoryId]?.endTime, p.start, p.end)));
}

/** Relief lessons covered per staff member (for fairness), optionally since a date. */
export function reliefCounts(reliefs, since = '') {
  const c = {};
  reliefs.forEach((r) => { if (r.coverStaffId && r.date >= since) c[r.coverStaffId] = (c[r.coverStaffId] || 0) + 1; });
  return c;
}

/**
 * Fills every uncovered lesson with the free teacher who has done the least relief this term,
 * spreading the day's relief (nobody gets two before everyone free has one). Part-time staff
 * (dutyWeight < 1) are weighted lighter, like the duty scheduler.
 * Returns the same list with coverStaffId filled where possible.
 */
export function autoAssignRelief({ needs, staff, absences, timetable, reliefs, duties, categories, periods, counts = {} }) {
  const assigned = [];
  const today = {};
  const weight = (s) => Math.max(0.1, Number(s.dutyWeight ?? 1));
  for (const n of needs) {
    if (n.coverStaffId) { assigned.push(n); today[n.coverStaffId] = (today[n.coverStaffId] || 0) + 1; continue; }
    const free = freeForRelief({ date: n.date, periodIndex: n.periodIndex, staff, absences, timetable, reliefs: [...reliefs.filter((r) => r.date !== n.date), ...assigned], duties, categories, periods, excludeId: n.absentStaffId });
    free.sort((a, b) => ((today[a.id] || 0) - (today[b.id] || 0)) || ((counts[a.id] || 0) / weight(a) - (counts[b.id] || 0) / weight(b)) || a.name.localeCompare(b.name));
    const pick = free[0];
    const row = { ...n, coverStaffId: pick ? pick.id : null };
    if (pick) today[pick.id] = (today[pick.id] || 0) + 1;
    assigned.push(row);
  }
  return assigned;
}
