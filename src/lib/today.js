// Builds "today at school" (used by the daily briefing, the staffroom TV and the TV link).
import { addDays } from './dates.js';
import { expandEvents, eventsOnDay } from './events.js';
import { isAbsent } from './scheduler.js';

export function buildToday({ date, staffById, categories, duties, absences = [], relief = [], exams = [], events = [], announcements = [], periods = [] }) {
  const name = (id) => staffById[id]?.name || '';
  const cats = [...categories].filter((c) => c.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const dutyRows = cats.map((c) => ({
    id: c.id, label: c.name, color: c.color, time: c.startTime ? `${c.startTime}–${c.endTime}` : '',
    staffIds: duties.filter((d) => d.date === date && d.categoryId === c.id).map((d) => d.staffId),
  })).filter((r) => r.staffIds.length).map((r) => ({ ...r, names: r.staffIds.map(name).filter(Boolean) }));

  const awayIds = Object.keys(staffById).filter((id) => isAbsent(absences, id, date));
  const reliefRows = relief.filter((r) => r.date === date).sort((a, b) => a.periodIndex - b.periodIndex).map((r) => ({
    period: periods[r.periodIndex]?.name || `Period ${r.periodIndex + 1}`, time: periods[r.periodIndex]?.start || '',
    className: r.className, subject: r.subject, room: r.room, absent: name(r.absentStaffId), cover: name(r.coverStaffId), coverStaffId: r.coverStaffId,
  }));
  const examRows = exams.filter((x) => x.date === date).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((x) => ({
    time: `${x.startTime}–${x.endTime}`, subject: x.subject, grade: x.grade || '', venue: x.venue || '', staffIds: x.invigilatorIds || [], names: (x.invigilatorIds || []).map(name).filter(Boolean),
  }));
  const occ = expandEvents(events, date, addDays(date, 7));
  const todayEvents = eventsOnDay(occ, date).map((o) => ({ title: o.title, time: o.allDay === false && o.startTime ? o.startTime : '', type: o.type }));
  const comingUp = occ.filter((o) => o.occurrence > date).slice(0, 6).map((o) => ({ date: o.occurrence, title: o.title, time: o.allDay === false && o.startTime ? o.startTime : '', type: o.type }));
  const notices = [...announcements].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))).slice(0, 3).map((a) => ({ title: a.title, body: a.body }));
  return { date, duties: dutyRows, away: awayIds.map(name).filter(Boolean).sort(), relief: reliefRows, exams: examRows, events: todayEvents, comingUp, notices };
}

/** One teacher's own items for the day. */
export function myDay(today, staffId) {
  return {
    duties: today.duties.filter((d) => d.staffIds.includes(staffId)),
    relief: today.relief.filter((r) => r.coverStaffId === staffId),
    exams: today.exams.filter((x) => x.staffIds.includes(staffId)),
  };
}
