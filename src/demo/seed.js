// Sample school for the live demo. Everything is generated relative to today so the demo always looks current.
import { demo, ts } from './store.js';
import { todayISO, addDays, startOfWeek, isoWeekday } from '../lib/dates.js';
import { generateRoster } from '../lib/scheduler.js';
import { PLANS } from '../config/plans.js';

export const DEMO_SID = 'demo-school';
export const PERSONAS = {
  owner: { uid: 'demo-owner', staffId: 'st-owner', role: 'owner', name: 'Mrs A. Botha', email: 'principal@demo.staffboard.co.za', title: 'Principal (owner)' },
  teacher: { uid: 'demo-teacher', staffId: 'st-teacher', role: 'teacher', name: 'Mr T. Dlamini', email: 'teacher@demo.staffboard.co.za', title: 'Teacher' },
};

const STAFF = [
  ['st-owner', 'Mrs A. Botha', 'Management', 'all', 'Principal', 0.25],
  ['st-deputy', 'Mr J. van Wyk', 'Mathematics', 'senior', 'Deputy Principal', 0.5],
  ['st-teacher', 'Mr T. Dlamini', 'Natural Sciences', 'intermediate', 'Teacher', 1],
  ['st-4', 'Ms N. Mokoena', 'English', 'foundation', 'Teacher', 1],
  ['st-5', 'Mrs L. Venter', 'Afrikaans', 'foundation', 'HOD Foundation Phase', 1],
  ['st-6', 'Mr S. Naidoo', 'Technology', 'senior', 'Teacher', 1],
  ['st-7', 'Mrs R. Khumalo', 'Life Orientation', 'intermediate', 'Teacher', 1],
  ['st-8', 'Ms P. Pretorius', 'Mathematics', 'intermediate', 'Teacher', 1],
  ['st-9', 'Mr K. Sithole', 'Physical Education', 'all', 'Sport Coordinator', 1],
  ['st-10', 'Mrs D. Fourie', 'Social Sciences', 'senior', 'Teacher', 1],
  ['st-11', 'Ms T. Meyer', 'Creative Arts', 'intermediate', 'Teacher', 1],
  ['st-12', 'Mr B. Dube', 'isiZulu', 'senior', 'Teacher', 1],
  ['st-13', 'Mrs C. le Roux', 'English', 'foundation', 'Teacher', 1],
  ['st-14', 'Ms Z. Ndlovu', 'Natural Sciences', 'senior', 'Teacher', 0.5],
  ['st-15', 'Mrs E. Smit', 'Foundation Phase', 'foundation', 'Teacher', 1],
  ['st-16', 'Mr L. Mahlangu', 'EMS', 'senior', 'Teacher', 1],
];
const CATS = [
  ['c-front', 'Front gate', '#2952FF', '07:00', '07:45', 2],
  ['c-back', 'Back gate', '#7C5CFF', '07:00', '07:45', 1],
  ['c-taxi', 'Taxi rank', '#FF7A2F', '13:30', '14:15', 1],
  ['c-dev', 'Morning devotion', '#0F9F74', '07:30', '07:45', 1],
  ['c-break', 'Break: field', '#0EA5B7', '10:15', '10:45', 1],
  ['c-after', 'Aftercare', '#E5484D', '14:00', '15:00', 1],
];
const PERIODS = [
  { name: 'Register', start: '07:45', end: '08:00' }, { name: 'Period 1', start: '08:00', end: '08:45' },
  { name: 'Period 2', start: '08:45', end: '09:30' }, { name: 'Period 3', start: '09:30', end: '10:15' },
  { name: 'Break', start: '10:15', end: '10:45', isBreak: true }, { name: 'Period 4', start: '10:45', end: '11:30' },
  { name: 'Period 5', start: '11:30', end: '12:15' }, { name: 'Period 6', start: '12:15', end: '13:00' },
];

export function seed() {
  const today = todayISO('Africa/Johannesburg');
  const termStart = startOfWeek(addDays(today, -35));
  const termEnd = addDays(startOfWeek(addDays(today, 21)), 4);
  const holiday = (() => { let d = addDays(today, 9); while (isoWeekday(d) > 5) d = addDays(d, 1); return d; })();
  const daysAgo = (n) => ts(new Date(Date.now() - n * 86400000));

  const staff = STAFF.map(([id, name, department, phase, position, w]) => ({
    id, name, department, phase, position, dutyWeight: w, active: true, excludedCategories: id === 'st-owner' ? ['c-taxi', 'c-after'] : [],
    email: id.startsWith('st-') ? `${name.split(' ').pop().toLowerCase().replace(/[^a-z]/g, '')}@demo.staffboard.co.za` : '',
    uid: id === 'st-owner' ? 'demo-owner' : id === 'st-teacher' ? 'demo-teacher' : ['st-deputy', 'st-4', 'st-5', 'st-6', 'st-7', 'st-8', 'st-9'].includes(id) ? 'demo-u-' + id : undefined,
    phone: '',
  }));
  const cats = CATS.map(([id, name, color, startTime, endTime, need], i) => ({ id, name, color, startTime, endTime, staffNeeded: need, order: i, days: id === 'c-dev' ? [1, 3, 5] : [1, 2, 3, 4, 5], phase: 'all', active: true }));
  const absences = [
    { id: 'ab1', staffId: 'st-7', start: today, end: addDays(today, 1), reason: 'Sick leave', note: '', status: 'approved', createdBy: 'demo-owner', createdAt: daysAgo(0) },
    { id: 'ab2', staffId: 'st-10', start: addDays(today, 6), end: addDays(today, 7), reason: 'Training / workshop', note: 'District moderation', status: 'reported', createdBy: 'demo-u-st-10', createdAt: daysAgo(1) },
  ];
  const closed = new Set([holiday]);
  const { assignments } = generateRoster({ start: termStart, end: termEnd, categories: cats, staff: staff.filter((s) => s.id !== 'st-owner' || true), absences: absences.filter((a) => a.start > today), closed, options: { seed: 11 } });
  const duties = assignments.map((a, i) => ({ id: 'du' + i, ...a, note: '', auto: true }));
  // Make sure the personas have duties this week for a nice demo.
  const mine = duties.find((d) => d.date >= today && d.categoryId === 'c-front');
  if (mine) mine.staffId = 'st-teacher';
  const swapDuty = duties.find((d) => d.date > addDays(today, 2) && d.staffId !== 'st-teacher');

  const events = [
    { id: 'e1', title: 'Staff meeting', type: 'meeting', phase: 'all', start: addDays(termStart, 2), allDay: false, startTime: '14:15', endTime: '15:15', location: 'Staffroom', recurrence: { freq: 'weekly', until: termEnd }, remindDaysBefore: 1 },
    { id: 'e2', title: 'Inter-house athletics', type: 'sport', phase: 'all', start: addDays(today, 3), allDay: true, location: 'Sports field', remindDaysBefore: 2 },
    { id: 'e3', title: 'Public holiday', type: 'holiday', phase: 'all', start: holiday, allDay: true, remindDaysBefore: -1 },
    { id: 'e4', title: 'Grade 4–7 exams', type: 'exam', phase: 'intermediate', start: addDays(today, 16), end: addDays(today, 27), allDay: true, remindDaysBefore: 7 },
    { id: 'e5', title: 'Parents’ evening', type: 'meeting', phase: 'all', start: addDays(today, 1), allDay: false, startTime: '18:00', endTime: '20:00', location: 'Hall', remindDaysBefore: 1 },
    { id: 'e6', title: 'Foundation Phase marks due', type: 'deadline', phase: 'foundation', start: addDays(today, 12), allDay: true, remindDaysBefore: 2 },
    { id: 'e7', title: 'Book inspection – Mathematics', type: 'activity', phase: 'all', start: addDays(today, -3), allDay: true },
    { id: 'e8', title: 'Choir practice', type: 'activity', phase: 'all', start: termStart, allDay: false, startTime: '14:00', endTime: '15:00', recurrence: { freq: 'weekly', until: termEnd }, remindDaysBefore: -1 },
  ];
  const lessons = [];
  const subj = { 'st-teacher': ['Natural Sciences', ['5A', '5B', '6A', '6B']], 'st-8': ['Mathematics', ['5A', '5B', '6A']], 'st-7': ['Life Orientation', ['5A', '6B', '7A']] };
  let li = 0;
  for (const [sid, [subject, classes]] of Object.entries(subj)) {
    for (let day = 1; day <= 5; day++) {
      for (const p of [1, 2, 3, 5, 6, 7]) {
        if ((day + p + sid.length) % 3 === 0) continue;
        lessons.push({ id: 'tt' + li++, staffId: sid, day, periodIndex: p, className: classes[(day + p) % classes.length], subject, room: sid === 'st-teacher' ? 'Lab 1' : 'R' + (10 + (p % 4)) });
      }
    }
  }
  const members = staff.filter((s) => s.uid).map((s) => ({ id: s.uid, role: s.id === 'st-owner' ? 'owner' : s.id === 'st-deputy' ? 'admin' : 'teacher', staffId: s.id, name: s.name, email: s.email }));

  return {
    school: {
      name: 'Laerskool Sonskyn (demo)', type: 'school', timezone: 'Africa/Johannesburg', ownerUid: 'demo-owner', createdAt: daysAgo(120),
      billing: { plan: 'school', status: 'active', interval: 'monthly', amount: PLANS.school.monthly, seats: PLANS.school.seats, features: PLANS.school.features, accessUntil: ts(new Date(Date.now() + 24 * 86400000)), token: 'demo', lastPaymentAt: daysAgo(7), lastReference: 'DEMO-1042', nextPaymentDate: addDays(today, 24) },
      settings: { periods: PERIODS, phases: ['foundation', 'intermediate', 'senior'], schoolDays: [1, 2, 3, 4, 5], eventTemplates: [] },
    },
    users: Object.fromEntries(Object.values(PERSONAS).map((p) => [p.uid, { displayName: p.name, email: p.email, activeSchoolId: DEMO_SID, schools: { [DEMO_SID]: { name: 'Laerskool Sonskyn (demo)', role: p.role } }, prefs: { email: {} } }])),
    cols: {
      staff, members, dutyCategories: cats, duties, events, absences,
      terms: [
        { id: 't1', name: 'Term 3', start: addDays(termStart, -98), end: addDays(termStart, -17), phase: 'all' },
        { id: 't2', name: 'Term 4', start: termStart, end: termEnd, phase: 'all' },
      ],
      timetable: lessons,
      swapRequests: [
        ...(swapDuty ? [{ id: 'sw1', dutyId: swapDuty.id, date: swapDuty.date, categoryId: swapDuty.categoryId, fromStaffId: swapDuty.staffId, toStaffId: 'st-teacher', message: 'I have a dentist appointment. I’ll take your Friday aftercare in return.', status: 'pending', createdBy: 'demo-u-x', createdAt: daysAgo(0) }] : []),
        { id: 'sw2', dutyId: duties.find((d) => d.date > today && d.categoryId === 'c-taxi')?.id || 'x', date: addDays(today, 4), categoryId: 'c-taxi', fromStaffId: 'st-6', toStaffId: 'st-9', message: 'Coaching clinic that afternoon.', status: 'accepted', createdBy: 'demo-u-st-6', createdAt: daysAgo(1) },
      ],
      announcements: [
        { id: 'an1', title: 'Athletics day duties', body: 'All staff please check the roster for athletics day. Gate duty starts at 06:45 on the day. Bring a hat!', pinned: true, authorUid: 'demo-owner', authorName: 'Mrs A. Botha', createdAt: daysAgo(1) },
        { id: 'an2', title: 'Exam timetable published', body: 'The Grade 4–7 exam timetable is on the calendar. Invigilation duties follow next week.', pinned: false, authorUid: 'demo-u-st-deputy', authorName: 'Mr J. van Wyk', createdAt: daysAgo(3) },
      ],
      notifications: [
        { id: 'n1', toUid: 'demo-teacher', title: 'Mr S. Naidoo asked you to take a duty', body: 'Would you take over a duty this week?', link: '/app/swaps', read: false, createdAt: daysAgo(0) },
        { id: 'n2', toUid: 'demo-teacher', title: 'Your duty roster has been published', body: 'You have new duties this term.', link: '/app/my-duties', read: true, createdAt: daysAgo(5) },
        { id: 'n3', toUid: 'demo-owner', title: 'Mrs D. Fourie is absent next week', body: '2 duty slot(s) need a substitute.', link: '/app/absences', read: false, createdAt: daysAgo(1) },
        { id: 'n4', toUid: 'demo-owner', title: 'Duty swap accepted', body: 'Mr K. Sithole agreed to take Taxi rank from Mr S. Naidoo. It needs your approval.', link: '/app/swaps', read: false, createdAt: daysAgo(1) },
      ],
      auditLogs: [
        { id: 'l1', actorUid: 'demo-owner', actorName: 'Mrs A. Botha', action: 'roster.generate', summary: `Auto-scheduled ${duties.length} duties for Term 4`, at: daysAgo(30) },
        { id: 'l2', actorUid: 'demo-u-st-deputy', actorName: 'Mr J. van Wyk', action: 'event.create', summary: 'Added event “Grade 4–7 exams”', at: daysAgo(3) },
        { id: 'l3', actorUid: 'demo-owner', actorName: 'Mrs A. Botha', action: 'absence.create', summary: 'Mrs R. Khumalo absent today', at: daysAgo(0) },
        { id: 'l4', actorUid: 'system', actorName: 'System', action: 'billing.update', summary: 'Payment received (School, monthly) – R599.00', at: daysAgo(7) },
      ],
      imports: [],
    },
  };
}

// Sample platform-owner numbers for the demo's Platform page (clearly labelled as sample data).
export function demoPlatformStats() {
  const months = [];
  const d = new Date(); d.setDate(1);
  for (let i = 11; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`); }
  const schools = [3, 5, 8, 11, 15, 19, 24, 30, 37, 43, 51, 58];
  const solos = [6, 9, 14, 20, 27, 33, 41, 48, 55, 61, 70, 79];
  const rev = months.map((m, i) => ({ month: m, amount: schools[i] * PLANS.school.monthly + solos[i] * PLANS.solo.monthly }));
  const mrr = rev[rev.length - 1].amount;
  return {
    sample: true,
    generatedAt: new Date().toISOString(),
    kpis: { mrr, arr: mrr * 12, payingSchools: 58 + 79, trialing: 23, workspaces: 196, users: 2140, staffAccounts: 1987, newLast30: 31, trialConversion: 41, arpa: Math.round(mrr / (58 + 79)) },
    status: { trialing: 23, active: 131, past_due: 6, cancelled: 14, expired: 22 },
    byPlan: { solo: { schools: 79, mrr: 79 * PLANS.solo.monthly }, school: { schools: 58, mrr: 58 * PLANS.school.monthly } },
    revenueByMonth: rev,
    signupsByMonth: months.map((m, i) => ({ month: m, count: [8, 11, 14, 12, 17, 19, 22, 21, 26, 24, 29, 31][i] })),
    recentSchools: [
      ['Hoërskool Noordkrans', 'school', 'trialing', 0], ['Laerskool Die Wilgers', 'school', 'active', 599], ['St Mary’s Primary', 'school', 'active', 599],
      ['Ms K. Pillay', 'personal', 'active', 99], ['Thuto-Lesedi Primary', 'school', 'past_due', 599], ['Mr R. Jacobs', 'personal', 'trialing', 0],
      ['Rietvlei Combined School', 'school', 'active', 499], ['Mrs L. Steyn', 'personal', 'active', 83],
    ].map(([name, type, status, m], i) => ({ id: 'x' + i, name, type, plan: type === 'school' ? 'school' : 'solo', interval: m === 499 || m === 83 ? 'annual' : 'monthly', status, mrr: m, createdAt: new Date(Date.now() - i * 3 * 86400000).toISOString() })),
  };
}

demo.registerSeed(seed);
