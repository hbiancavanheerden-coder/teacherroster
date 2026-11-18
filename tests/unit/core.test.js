import { describe, it, expect } from 'vitest';
import { generateRoster, loadSpread, suggestSubstitutes } from '../../src/lib/scheduler.js';
import { dutyConflicts, timetableConflicts } from '../../src/lib/conflicts.js';
import { expandEvents, closedDays, saPublicHolidays } from '../../src/lib/events.js';
import { parseCSV, rowsToStaff, toCSV } from '../../src/lib/csv.js';
import { buildICS } from '../../src/lib/ics.js';
import { eachDay, isoWeekday, startOfWeek } from '../../src/lib/dates.js';
import { effectivePlan, hasAccess, PLANS } from '../../src/config/plans.js';

const staff = Array.from({ length: 14 }, (_, i) => ({ id: 's' + i, name: 'Teacher ' + i, active: true }));
// The six duty points from the original Term 4 register
const categories = ['Foundation Front', 'Back 1', 'Senior Front', 'Back 2', 'Morning Taxi', 'Morning Devotion']
  .map((name, i) => ({ id: 'c' + i, name, order: i, staffNeeded: 1, days: [1, 2, 3, 4, 5], startTime: '07:00', endTime: '07:45' }));
const term = { start: '2026-10-06', end: '2026-12-09' };

describe('scheduler', () => {
  const closed = new Set(['2026-11-04']);
  const r = generateRoster({ ...term, categories, staff, closed, options: { seed: 7 } });
  const schoolDays = eachDay(term.start, term.end).filter((d) => isoWeekday(d) <= 5 && !closed.has(d));

  it('fills every slot on every school day and skips weekends/holidays', () => {
    expect(r.unfilled).toHaveLength(0);
    expect(r.assignments).toHaveLength(schoolDays.length * categories.length);
    expect(r.assignments.some((a) => a.date === '2026-11-04')).toBe(false);
    expect(r.assignments.every((a) => isoWeekday(a.date) <= 5)).toBe(true);
  });

  it('balances load to within one duty', () => {
    expect(loadSpread(r.load, staff.map((s) => s.id)).spread).toBeLessThanOrEqual(1);
  });

  it('never gives a teacher two duties on the same day', () => {
    const seen = new Set();
    for (const a of r.assignments) {
      const k = a.date + a.staffId;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it('spreads categories (nobody gets the same duty far more than others)', () => {
    for (const c of categories) {
      const counts = staff.map((s) => r.assignments.filter((a) => a.staffId === s.id && a.categoryId === c.id).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
    }
  });

  it('respects absences, exclusions, weekly limits and part-time weighting', () => {
    const st = staff.map((s) => ({ ...s }));
    st[0].excludedCategories = ['c4'];
    st[1].maxPerWeek = 1;
    st[2].dutyWeight = 0.5;
    const absences = [{ staffId: 's3', start: '2026-10-12', end: '2026-10-16' }];
    const x = generateRoster({ ...term, categories, staff: st, absences, options: { seed: 3 } });
    expect(x.assignments.some((a) => a.staffId === 's0' && a.categoryId === 'c4')).toBe(false);
    expect(x.assignments.some((a) => a.staffId === 's3' && a.date >= '2026-10-12' && a.date <= '2026-10-16')).toBe(false);
    const weeks = {};
    x.assignments.filter((a) => a.staffId === 's1').forEach((a) => { const w = startOfWeek(a.date); weeks[w] = (weeks[w] || 0) + 1; });
    expect(Math.max(...Object.values(weeks))).toBeLessThanOrEqual(1);
    const full = x.assignments.filter((a) => a.staffId === 's5').length;
    const half = x.assignments.filter((a) => a.staffId === 's2').length;
    expect(half).toBeLessThan(full * 0.75);
  });

  it('keeps existing assignments and only fills gaps', () => {
    const existing = [{ date: '2026-10-06', categoryId: 'c0', staffId: 's9' }];
    const x = generateRoster({ start: '2026-10-06', end: '2026-10-06', categories, staff, existing });
    expect(x.assignments.find((a) => a.categoryId === 'c0')).toBeUndefined();
    expect(x.assignments).toHaveLength(5);
    expect(x.assignments.some((a) => a.staffId === 's9')).toBe(false);
  });

  it('reports slots it cannot fill', () => {
    const x = generateRoster({ start: '2026-10-06', end: '2026-10-06', categories, staff: staff.slice(0, 3) });
    expect(x.unfilled).toHaveLength(3);
  });

  it('is deterministic for a seed', () => {
    const a = generateRoster({ ...term, categories, staff, options: { seed: 5 } });
    const b = generateRoster({ ...term, categories, staff, options: { seed: 5 } });
    expect(a.assignments).toEqual(b.assignments);
  });

  it('suggests available, least-loaded substitutes', () => {
    const duties = [{ date: '2026-10-07', staffId: 's1', categoryId: 'c0' }, { date: '2026-10-08', staffId: 's2', categoryId: 'c0' }];
    const subs = suggestSubstitutes({ date: '2026-10-07', categoryId: 'c1', staff: staff.slice(0, 4), duties, absences: [{ staffId: 's3', start: '2026-10-07' }] });
    expect(subs.map((s) => s.id)).toEqual(['s0', 's2']);
  });
});

describe('conflicts', () => {
  it('detects double bookings, absences, lesson clashes and empty slots', () => {
    const duties = [
      { id: 'd1', date: '2026-10-07', staffId: 's1', categoryId: 'c0' },
      { id: 'd2', date: '2026-10-07', staffId: 's1', categoryId: 'c1' },
      { id: 'd3', date: '2026-10-08', staffId: 's2', categoryId: 'c0' },
      { id: 'd4', date: '2026-10-09', staffId: '', categoryId: 'c0' },
    ];
    const out = dutyConflicts({
      duties, categories, absences: [{ staffId: 's2', start: '2026-10-08' }],
      timetable: [{ staffId: 's1', day: 3, periodIndex: 0 }], periods: [{ name: 'Register', start: '07:30', end: '08:00' }],
    });
    const types = out.map((c) => c.type).sort();
    expect(types).toEqual(['absent', 'double-booked', 'lesson-clash', 'lesson-clash', 'unassigned']);
  });

  it('detects timetable clashes for teacher, class and room', () => {
    const out = timetableConflicts([
      { id: 'a', staffId: 't1', className: '5A', room: '12', day: 1, periodIndex: 2 },
      { id: 'b', staffId: 't1', className: '5b', room: '13', day: 1, periodIndex: 2 },
      { id: 'c', staffId: 't2', className: '5B', room: '13', day: 1, periodIndex: 2 },
      { id: 'd', staffId: 't2', className: '5B', room: '13', day: 2, periodIndex: 2 },
    ]);
    expect(out.map((c) => c.kind).sort()).toEqual(['class', 'room', 'teacher']);
  });
});

describe('events', () => {
  it('expands recurring events with exceptions and until date', () => {
    const occ = expandEvents([{ id: 'e', title: 'Choir', start: '2026-10-13', recurrence: { freq: 'weekly', until: '2026-11-03' }, exceptions: ['2026-10-27'] }], '2026-10-01', '2026-12-31');
    expect(occ.map((o) => o.occurrence)).toEqual(['2026-10-13', '2026-10-20', '2026-11-03']);
  });
  it('keeps multi-day events overlapping the range', () => {
    const occ = expandEvents([{ id: 'f', start: '2026-11-27', end: '2026-11-28', title: 'Farewell' }], '2026-11-28', '2026-11-30');
    expect(occ).toHaveLength(1);
  });
  it('marks holiday ranges closed', () => {
    const c = closedDays([{ type: 'holiday', start: '2026-12-10', end: '2026-12-12' }], '2026-12-01', '2026-12-31');
    expect([...c]).toEqual(['2026-12-10', '2026-12-11', '2026-12-12']);
  });
  it('computes South African public holidays', () => {
    const h2026 = saPublicHolidays(2026).map((h) => h.date);
    expect(h2026).toContain('2026-04-03'); // Good Friday
    expect(h2026).toContain('2026-04-06'); // Family Day
    expect(h2026).toContain('2026-08-10'); // Women's Day observed (9 Aug is a Sunday)
    const h2022 = saPublicHolidays(2022).map((h) => h.date);
    expect(h2022).toContain('2022-12-27'); // Christmas on Sunday -> Tuesday observed
  });
});

describe('csv & ics', () => {
  it('parses quoted CSV and maps staff columns', () => {
    const rows = parseCSV('Name,Surname,Email,Phase\n"Mokoena, T",Thandi,THANDI@x.co.za,Foundation\nPieter,,bad-email,inter\n');
    const r = rowsToStaff(rows);
    expect(r.staff[0]).toMatchObject({ name: 'Mokoena, T Thandi', email: 'thandi@x.co.za', phase: 'foundation' });
    expect(r.staff[1]).toMatchObject({ email: '', phase: 'intermediate' });
    expect(r.errors).toHaveLength(1);
    expect(toCSV([['a,b', 'c"d']])).toBe('"a,b","c""d"');
  });
  it('builds a valid ICS calendar', () => {
    const ics = buildICS('Test', [{ uid: '1', title: 'Duty; gate', date: '2026-10-06', startTime: '07:00', endTime: '07:45' }, { uid: '2', title: 'Exams', date: '2026-11-06', endDate: '2026-11-13' }]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;TZID=Africa/Johannesburg:20261006T070000');
    expect(ics).toContain('SUMMARY:Duty\\; gate');
    expect(ics).toContain('DTEND;VALUE=DATE:20261114');
  });
});

describe('plans', () => {
  it('gives trials School features and enforces access dates', () => {
    expect(effectivePlan({ status: 'trialing', plan: 'solo' }).features.invites).toBe(true);
    expect(effectivePlan({ status: 'active', plan: 'solo' }).features.invites).toBe(false);
    expect(hasAccess({ accessUntil: new Date(Date.now() + 1000).toISOString() })).toBe(true);
    expect(hasAccess({ accessUntil: new Date(Date.now() - 1000).toISOString() })).toBe(false);
    expect(PLANS.school.annual).toBeLessThan(PLANS.school.monthly * 12);
  });
});
