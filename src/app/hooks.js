import { useMemo } from 'react';
import { useCollection, where, orderBy, limit } from '../lib/data.js';
import { buildToday } from '../lib/today.js';
import { useSchool } from '../context/SchoolContext.jsx';
import { expandEvents } from '../lib/events.js';

export function useDutiesRange(from, to) {
  const { sid } = useSchool();
  return useCollection(sid, 'duties', [where('date', '>=', from), where('date', '<=', to)], [from, to]);
}

export function useEvents() {
  const { sid } = useSchool();
  return useCollection(sid, 'events');
}

export function useOccurrences(from, to) {
  const ev = useEvents();
  const occ = useMemo(() => expandEvents(ev.data, from, to), [ev.data, from, to]);
  return { ...ev, occ };
}

export function useAbsences() {
  const { sid } = useSchool();
  return useCollection(sid, 'absences');
}

export function useTerms() {
  const { sid } = useSchool();
  const t = useCollection(sid, 'terms');
  return { ...t, data: [...t.data].sort((a, b) => a.start.localeCompare(b.start)) };
}

// Phase options configured for the school.
export function usePhases() {
  const { school } = useSchool();
  return school?.settings?.phases || ['foundation', 'intermediate', 'senior'];
}

// Everything happening at school on `date` (daily briefing, staffroom TV).
export function useToday(date) {
  const s = useSchool();
  const duties = useDutiesRange(date, date);
  const absences = useAbsences();
  const relief = useCollection(s.sid, 'relief', [where('date', '==', date)], [date]);
  const exams = useCollection(s.sid, 'exams', [where('date', '==', date)], [date]);
  const events = useEvents();
  const announcements = useCollection(s.sid, 'announcements', [orderBy('createdAt', 'desc'), limit(5)]);
  return useMemo(() => buildToday({
    date, staffById: s.staffById, categories: s.categories, duties: duties.data, absences: absences.data,
    relief: relief.data, exams: exams.data, events: events.data, announcements: announcements.data,
    periods: s.school?.settings?.periods || [],
  }), [date, s.staffById, s.categories, duties.data, absences.data, relief.data, exams.data, events.data, announcements.data, s.school]);
}
