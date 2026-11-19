import { describe, it, expect } from 'vitest';
import { lessonsNeedingCover, freeForRelief, autoAssignRelief, reliefCounts } from '../../src/lib/relief.js';
import { autoAssignInvigilators, invigilationBlock, invigilationLoad } from '../../src/lib/invigilation.js';

const date = '2026-11-19'; // Thursday (day 4)
const staff = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), active: true }));
const periods = [{ name: 'P1', start: '08:00', end: '08:45' }, { name: 'P2', start: '08:45', end: '09:30' }];
const timetable = [
  { id: 't1', staffId: 'a', day: 4, periodIndex: 0, className: '5A', subject: 'Maths' },
  { id: 't2', staffId: 'a', day: 4, periodIndex: 1, className: '5B', subject: 'Maths' },
  { id: 't3', staffId: 'b', day: 4, periodIndex: 0, className: '6A', subject: 'English' },
  { id: 't4', staffId: 'c', day: 4, periodIndex: 1, className: '6B', subject: 'Science' },
];
const absences = [{ staffId: 'a', start: date, end: date }];

describe('relief roster', () => {
  it('finds the lessons of staff who are away', () => {
    const n = lessonsNeedingCover({ date, absences, timetable });
    expect(n.map((x) => x.className)).toEqual(['5A', '5B']);
  });
  it('only offers teachers who are free that period', () => {
    const free = freeForRelief({ date, periodIndex: 0, staff, absences, timetable, reliefs: [], periods });
    expect(free.map((s) => s.id)).toEqual(['c', 'd', 'e']);
  });
  it('excludes teachers on an overlapping duty', () => {
    const duties = [{ date, staffId: 'd', categoryId: 'g' }];
    const free = freeForRelief({ date, periodIndex: 0, staff, absences, timetable, reliefs: [], duties, categories: [{ id: 'g', startTime: '08:10', endTime: '08:30' }], periods });
    expect(free.map((s) => s.id)).not.toContain('d');
  });
  it('assigns fairly: least relief this term first, never double-booked', () => {
    const needs = lessonsNeedingCover({ date, absences, timetable });
    const counts = { c: 5, d: 0, e: 2 };
    const r = autoAssignRelief({ needs, staff, absences, timetable, reliefs: [], periods, counts });
    expect(r[0].coverStaffId).toBe('d');
    expect(r[1].coverStaffId).not.toBe('c'); // c teaches period 2
    expect(new Set(r.map((x) => x.coverStaffId)).size).toBe(2);
    expect(reliefCounts(r)).toEqual({ d: 1, [r[1].coverStaffId]: 1 });
  });
});

describe('invigilation', () => {
  const sessions = [
    { id: 's1', date: '2026-11-23', startTime: '08:00', endTime: '10:00', subject: 'Maths', needed: 2 },
    { id: 's2', date: '2026-11-23', startTime: '09:00', endTime: '11:00', subject: 'English', needed: 2 },
    { id: 's3', date: '2026-11-24', startTime: '08:00', endTime: '09:00', subject: 'Science', needed: 1 },
  ];
  it('never assigns someone to their own subject or to two overlapping sessions', () => {
    const { sessions: out, unfilled } = autoAssignInvigilators({ sessions, staff, absences: [], timetable, duties: [], categories: [], periods });
    expect(unfilled).toEqual([]);
    const s1 = out.find((s) => s.id === 's1'); const s2 = out.find((s) => s.id === 's2');
    expect(s1.invigilatorIds).not.toContain('a');
    expect(s2.invigilatorIds).not.toContain('b');
    expect(s1.invigilatorIds.filter((x) => s2.invigilatorIds.includes(x))).toEqual([]);
    const load = invigilationLoad(out);
    const vals = Object.values(load);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(120);
  });
  it('explains why someone is blocked', () => {
    expect(invigilationBlock({ person: staff[0], session: sessions[0], sessions, timetable })).toBe('teaches this subject');
    expect(invigilationBlock({ person: staff[3], session: sessions[0], sessions, absences: [{ staffId: 'd', start: '2026-11-23' }] })).toBe('away');
  });
  it('reports sessions it cannot fill', () => {
    const r = autoAssignInvigilators({ sessions: [{ id: 'x', date: '2026-11-23', startTime: '08:00', endTime: '09:00', subject: 'Art', needed: 9 }], staff, absences: [], timetable: [], duties: [], categories: [], periods });
    expect(r.unfilled[0].missing).toBe(4);
  });
});
