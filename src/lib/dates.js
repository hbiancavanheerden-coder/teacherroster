// Date helpers. All school dates are stored as 'YYYY-MM-DD' strings in the
// school's local calendar so they never drift across timezones.

export function toDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayISO(timeZone) {
  if (!timeZone) return iso(new Date());
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(s, n) {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function diffDays(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

// 1 = Monday ... 7 = Sunday
export function isoWeekday(s) {
  const d = toDate(s).getDay();
  return d === 0 ? 7 : d;
}

export function startOfWeek(s) {
  return addDays(s, 1 - isoWeekday(s));
}

export function weekKey(s) {
  return startOfWeek(s);
}

export function eachDay(start, end) {
  const out = [];
  if (!start || !end || start > end) return out;
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function fmt(s, opts = { day: 'numeric', month: 'short' }) {
  return toDate(s).toLocaleDateString('en-ZA', opts);
}
export const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtMed = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
export const dow = (s) => fmt(s, { weekday: 'short' });

export function monthGrid(year, month) {
  // returns 6 weeks x 7 days of ISO strings starting Monday
  const first = iso(new Date(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function timeOverlaps(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

export const WEEKDAYS = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun'],
];
