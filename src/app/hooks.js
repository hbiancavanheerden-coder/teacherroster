import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useCollection } from '../lib/data.js';
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
