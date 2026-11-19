// Data for the staffroom TV link (/tv/:token). School plan only; secret, revocable link; no emails or phone numbers.
import { handler, db, json, HttpError, canShare, effectivePlan } from './_lib/core.js';
import { todayISO, addDays } from '../../src/lib/dates.js';

export default handler(['GET'], async (req) => {
  const t = new URL(req.url).searchParams.get('token');
  if (!t || t.length > 100) throw new HttpError(400, 'Invalid link');
  const link = await db().collection('links').doc(t).get();
  if (!link.exists || link.data().revoked || link.data().type !== 'tv') throw new HttpError(404, 'This display link is no longer active.');
  const ref = db().collection('schools').doc(link.data().schoolId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Not found');
  const school = snap.data();
  if (!canShare(school) || !effectivePlan(school.billing).features.tvDisplay) throw new HttpError(402, 'The staffroom display is paused. Ask your school to activate the StaffBoard School plan.');
  const date = todayISO(school.timezone || 'Africa/Johannesburg');

  const [cats, duties, staff, absences, relief, exams, events, ann] = await Promise.all([
    ref.collection('dutyCategories').get(),
    ref.collection('duties').where('date', '==', date).get(),
    ref.collection('staff').get(),
    ref.collection('absences').where('end', '>=', date).get(),
    ref.collection('relief').where('date', '==', date).get(),
    ref.collection('exams').where('date', '==', date).get(),
    ref.collection('events').where('start', '<=', addDays(date, 7)).get(),
    ref.collection('announcements').orderBy('createdAt', 'desc').limit(5).get(),
  ]);
  const rows = (q) => q.docs.map((d) => ({ id: d.id, ...d.data() }));
  return json({
    date,
    school: { name: school.name, periods: school.settings?.periods || [] },
    categories: rows(cats).map(({ id, name, color, startTime, endTime, order, active }) => ({ id, name, color, startTime, endTime, order, active })),
    duties: rows(duties).map(({ date: d, categoryId, staffId }) => ({ date: d, categoryId, staffId })),
    staff: rows(staff).map(({ id, name }) => ({ id, name })),
    absences: rows(absences).map(({ staffId, start, end, status }) => ({ staffId, start, end, status })),
    relief: rows(relief).map(({ date: d, periodIndex, className, subject, room, absentStaffId, coverStaffId }) => ({ date: d, periodIndex, className, subject, room, absentStaffId, coverStaffId })),
    exams: rows(exams).map(({ date: d, startTime, endTime, subject, grade, venue, invigilatorIds }) => ({ date: d, startTime, endTime, subject, grade, venue, invigilatorIds })),
    events: rows(events).filter((e) => !e.private).map(({ id, title, type, start, end, allDay, startTime, endTime, recurrence, exceptions }) => ({ id, title, type, start, end, allDay, startTime, endTime, recurrence, exceptions })),
    announcements: rows(ann).map(({ title, body, pinned }) => ({ title, body, pinned })),
  }, 200, { 'cache-control': 'no-store' });
});
