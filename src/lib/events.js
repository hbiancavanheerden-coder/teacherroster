import { addDays, eachDay, isoWeekday, toDate, iso, overlaps } from './dates.js';

export const EVENT_TYPES = {
  activity: { label: 'Activity', color: '#2F6F5E' },
  exam: { label: 'Exam / Assessment', color: '#A23E2E' },
  meeting: { label: 'Meeting', color: '#3B5BA5' },
  sport: { label: 'Sport', color: '#C28E3F' },
  holiday: { label: 'Holiday / Closed', color: '#7A6F5B' },
  term: { label: 'Term date', color: '#20283D' },
  deadline: { label: 'Deadline', color: '#8E3B7A' },
};

export const PHASES = {
  all: 'Whole school',
  foundation: 'Foundation Phase',
  intermediate: 'Intermediate Phase',
  senior: 'Senior Phase',
};

// Expands recurring events into concrete occurrences within [from, to].
// event: { start, end?, recurrence?: { freq: 'daily'|'weekly'|'monthly', until, interval? } }
export function expandEvents(events, from, to) {
  const out = [];
  for (const ev of events) {
    const len = ev.end ? Math.max(0, Math.round((toDate(ev.end) - toDate(ev.start)) / 86400000)) : 0;
    const rec = ev.recurrence;
    if (!rec || !rec.freq) {
      const end = ev.end || ev.start;
      if (overlaps(ev.start, end, from, to)) out.push({ ...ev, occurrence: ev.start, occEnd: end });
      continue;
    }
    const until = rec.until && rec.until < to ? rec.until : to;
    const interval = Math.max(1, Number(rec.interval) || 1);
    let cur = ev.start;
    let guard = 0;
    while (cur <= until && guard < 1000) {
      guard++;
      const occEnd = addDays(cur, len);
      const skip = (ev.exceptions || []).includes(cur);
      if (!skip && overlaps(cur, occEnd, from, to)) out.push({ ...ev, occurrence: cur, occEnd });
      if (rec.freq === 'daily') {
        cur = addDays(cur, interval);
        // skip weekends for school-day recurrence
        if (rec.weekdaysOnly) while (isoWeekday(cur) > 5) cur = addDays(cur, 1);
      } else if (rec.freq === 'weekly') cur = addDays(cur, 7 * interval);
      else if (rec.freq === 'monthly') {
        const d = toDate(cur);
        d.setMonth(d.getMonth() + interval);
        cur = iso(d);
      } else break;
    }
  }
  return out.sort((a, b) => a.occurrence.localeCompare(b.occurrence) || (a.startTime || '').localeCompare(b.startTime || ''));
}

export function eventsOnDay(occurrences, day) {
  return occurrences.filter((o) => o.occurrence <= day && o.occEnd >= day);
}

// Dates the school is closed (holiday events), used by the scheduler.
export function closedDays(events, from, to) {
  const set = new Set();
  for (const o of expandEvents(events.filter((e) => e.type === 'holiday'), from, to)) {
    for (const d of eachDay(o.occurrence, o.occEnd)) set.add(d);
  }
  return set;
}

export function phaseMatches(itemPhase, filterPhase) {
  if (!filterPhase || filterPhase === 'all') return true;
  return !itemPhase || itemPhase === 'all' || itemPhase === filterPhase;
}

// South African public holidays (Public Holidays Act 36 of 1994), incl. the Sunday -> Monday rule.
// Ad-hoc holidays (e.g. election days) must be added manually.
export function saPublicHolidays(year) {
  // Anonymous Gregorian algorithm for Easter Sunday
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = iso(new Date(year, month - 1, day));
  const fixed = [
    ['01-01', "New Year's Day"], ['03-21', 'Human Rights Day'], ['04-27', 'Freedom Day'], ['05-01', "Workers' Day"],
    ['06-16', 'Youth Day'], ['08-09', "National Women's Day"], ['09-24', 'Heritage Day'], ['12-16', 'Day of Reconciliation'],
    ['12-25', 'Christmas Day'], ['12-26', 'Day of Goodwill'],
  ];
  const out = [
    { date: addDays(easter, -2), title: 'Good Friday' },
    { date: addDays(easter, 1), title: 'Family Day' },
  ];
  for (const [md, title] of fixed) {
    const dt = `${year}-${md}`;
    out.push({ date: dt, title });
    if (isoWeekday(dt) === 7) {
      let obs = addDays(dt, 1);
      // e.g. Christmas on a Sunday: Monday is already Day of Goodwill, so Tuesday is observed
      if (fixed.some(([x]) => `${year}-${x}` === obs)) obs = addDays(obs, 1);
      out.push({ date: obs, title: `${title} (observed)` });
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
