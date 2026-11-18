// GET ?token=... -> read-only roster data for the public share page (/r/:token).
// Exposes first names/display names, duty categories, duties and school calendar only. No emails or phone numbers.
import { handler, db, json, HttpError } from './_lib/core.js';

export default handler(['GET'], async (req) => {
  const t = new URL(req.url).searchParams.get('token');
  if (!t || t.length > 100) throw new HttpError(400, 'Invalid link');
  const link = await db().collection('links').doc(t).get();
  if (!link.exists || link.data().revoked || link.data().type !== 'roster') throw new HttpError(404, 'This roster link is no longer active.');
  const schoolRef = db().collection('schools').doc(link.data().schoolId);
  const school = await schoolRef.get();
  if (!school.exists) throw new HttpError(404, 'Not found');

  const from = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
  const [cats, duties, staff, events] = await Promise.all([
    schoolRef.collection('dutyCategories').get(),
    schoolRef.collection('duties').where('date', '>=', from).where('date', '<=', to).get(),
    schoolRef.collection('staff').get(),
    schoolRef.collection('events').where('start', '<=', to).get(),
  ]);
  const names = Object.fromEntries(staff.docs.map((d) => [d.id, d.data().name]));
  return json({
    school: { name: school.data().name, timezone: school.data().timezone },
    categories: cats.docs.map((d) => ({ id: d.id, name: d.data().name, order: d.data().order ?? 0, active: d.data().active !== false, startTime: d.data().startTime || '', endTime: d.data().endTime || '' })),
    duties: duties.docs.map((d) => ({ date: d.data().date, categoryId: d.data().categoryId, name: names[d.data().staffId] || '' })),
    events: events.docs.map((d) => d.data()).filter((e) => !e.private && (e.end || e.start) >= from)
      .map((e) => ({ title: e.title, type: e.type, start: e.start, end: e.end || null, phase: e.phase || 'all', startTime: e.startTime || '', endTime: e.endTime || '', recurrence: e.recurrence || null })),
  }, 200, { 'cache-control': 'public, max-age=60' });
});
