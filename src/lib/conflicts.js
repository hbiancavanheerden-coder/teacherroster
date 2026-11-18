import { isoWeekday, timeOverlaps } from './dates.js';
import { isAbsent } from './scheduler.js';

/**
 * Finds problems in a set of duties.
 * Returns [{type, severity, date, staffId, dutyIds, message}]
 */
export function dutyConflicts({ duties, categories, absences = [], timetable = [], periods = [], staffById = {} }) {
  const out = [];
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const name = (id) => staffById[id]?.name || 'Unknown';

  // 1. Same person, same day, overlapping times (or same category twice)
  const groups = {};
  duties.forEach((d) => { (groups[d.date + '|' + d.staffId] ||= []).push(d); });
  for (const list of Object.values(groups)) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const ca = catById[a.categoryId] || {}, cb = catById[b.categoryId] || {};
        const clash = a.categoryId === b.categoryId || timeOverlaps(ca.startTime, ca.endTime, cb.startTime, cb.endTime);
        if (clash) {
          out.push({
            type: 'double-booked', severity: 'error', date: a.date, staffId: a.staffId, dutyIds: [a.id, b.id],
            message: `${name(a.staffId)} has two overlapping duties (${ca.name || '?'} and ${cb.name || '?'})`,
          });
        }
      }
    }
  }

  // 2. Duty while absent
  for (const d of duties) {
    if (d.staffId && isAbsent(absences, d.staffId, d.date)) {
      out.push({
        type: 'absent', severity: 'error', date: d.date, staffId: d.staffId, dutyIds: [d.id],
        message: `${name(d.staffId)} is marked absent but has ${catById[d.categoryId]?.name || 'a duty'}`,
      });
    }
  }

  // 3. Duty clashes with a timetabled lesson
  if (timetable.length && periods.length) {
    for (const d of duties) {
      const c = catById[d.categoryId];
      if (!c?.startTime || !c?.endTime) continue;
      const wd = isoWeekday(d.date);
      const lessons = timetable.filter((t) => t.staffId === d.staffId && Number(t.day) === wd);
      for (const l of lessons) {
        const p = periods[l.periodIndex];
        if (p && timeOverlaps(c.startTime, c.endTime, p.start, p.end)) {
          out.push({
            type: 'lesson-clash', severity: 'warning', date: d.date, staffId: d.staffId, dutyIds: [d.id],
            message: `${name(d.staffId)} teaches ${l.className || ''} ${l.subject || ''} during ${c.name} (${p.name})`.replace(/\s+/g, ' '),
          });
        }
      }
    }
  }

  // 4. Unassigned duty slots
  for (const d of duties) {
    if (!d.staffId) {
      out.push({ type: 'unassigned', severity: 'warning', date: d.date, dutyIds: [d.id], message: `${catById[d.categoryId]?.name || 'Duty'} has no one assigned` });
    }
  }
  return out;
}

/** Timetable clashes: teacher/class/room booked twice in the same period. */
export function timetableConflicts(entries, staffById = {}) {
  const out = [];
  const seen = { teacher: {}, class: {}, room: {} };
  for (const e of entries) {
    const slot = `${e.day}|${e.periodIndex}`;
    const checks = [
      ['teacher', e.staffId, staffById[e.staffId]?.name],
      ['class', e.className?.trim().toLowerCase(), e.className],
      ['room', e.room?.trim().toLowerCase(), e.room],
    ];
    for (const [kind, key, label] of checks) {
      if (!key) continue;
      const k = slot + '|' + key;
      if (seen[kind][k]) {
        out.push({ kind, day: e.day, periodIndex: e.periodIndex, ids: [seen[kind][k].id, e.id], message: `${kind === 'teacher' ? 'Teacher' : kind === 'class' ? 'Class' : 'Room'} ${label} is booked twice in the same period` });
      } else seen[kind][k] = e;
    }
  }
  return out;
}
