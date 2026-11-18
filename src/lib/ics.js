// Minimal RFC 5545 calendar builder (shared by the app's download button and the ICS feed function).
import { addDays } from './dates.js';

const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = (iso) => iso.replace(/-/g, '');
const t6 = (hhmm) => (hhmm || '00:00').replace(':', '') + '00';

function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
}

/**
 * items: [{uid, title, date, endDate?, startTime?, endTime?, description?, location?}]
 */
export function buildICS(name, items, timeZone = 'Africa/Johannesburg') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Staffboard//Duty Register//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, `X-WR-TIMEZONE:${timeZone}`,
  ];
  for (const it of items) {
    lines.push('BEGIN:VEVENT', `UID:${it.uid}`, `DTSTAMP:${stamp}`);
    if (it.startTime && it.endTime) {
      lines.push(`DTSTART;TZID=${timeZone}:${d8(it.date)}T${t6(it.startTime)}`);
      lines.push(`DTEND;TZID=${timeZone}:${d8(it.endDate || it.date)}T${t6(it.endTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d8(it.date)}`);
      lines.push(`DTEND;VALUE=DATE:${d8(addDays(it.endDate || it.date, 1))}`);
    }
    lines.push(`SUMMARY:${esc(it.title)}`);
    if (it.description) lines.push(`DESCRIPTION:${esc(it.description)}`);
    if (it.location) lines.push(`LOCATION:${esc(it.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
