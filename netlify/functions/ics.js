// Calendar subscription feed: GET /api/ics?token=...  (add to Google Calendar / Outlook / Apple Calendar)
import { db, canShare } from './_lib/core.js';
import { buildICS } from '../../src/lib/ics.js';
import { expandEvents } from '../../src/lib/events.js';

export default async (req) => {
  const t = new URL(req.url).searchParams.get('token') || '';
  if (!t || t.length > 100) return new Response('Not found', { status: 404 });
  const link = await db().collection('links').doc(t).get();
  if (!link.exists || link.data().revoked || link.data().type !== 'ics') return new Response('This calendar link is no longer active.', { status: 404 });
  const { schoolId, scope, staffId } = link.data();
  const schoolRef = db().collection('schools').doc(schoolId);
  const school = (await schoolRef.get()).data();
  if (!school) return new Response('Not found', { status: 404 });
  // A teacher's feed of her own duties always works while the workspace is active;
  // the school calendar and feeds for colleagues are School-plan sharing.
  const personal = scope === 'staff' && link.data().createdByStaffId === staffId;
  const active = (school.billing?.accessUntil?.toMillis?.() || 0) > Date.now();
  if (!(personal ? active : canShare(school))) return new Response('This calendar link is paused. Ask your school to activate the StaffBoard School plan.', { status: 402 });

  const from = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const cats = Object.fromEntries((await schoolRef.collection('dutyCategories').get()).docs.map((d) => [d.id, d.data()]));
  const items = [];

  if (scope === 'staff') {
    const duties = await schoolRef.collection('duties').where('staffId', '==', staffId).get();
    duties.docs.forEach((d) => {
      const x = d.data();
      if (x.date < from || x.date > to) return;
      const c = cats[x.categoryId] || {};
      items.push({ uid: `duty-${d.id}@staffboard`, title: `Duty: ${c.name || 'Duty'}`, date: x.date, startTime: c.startTime, endTime: c.endTime, description: x.note || '' });
    });
  }
  const evSnap = await schoolRef.collection('events').get();
  const events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !e.private);
  for (const o of expandEvents(events, from, to)) {
    items.push({
      uid: `ev-${o.id}-${o.occurrence}@staffboard`, title: o.title, date: o.occurrence, endDate: o.occEnd,
      startTime: o.allDay === false ? o.startTime : undefined, endTime: o.allDay === false ? o.endTime : undefined,
      description: o.description || '', location: o.location || '',
    });
  }
  const name = scope === 'staff' ? `${school.name} – My duties` : `${school.name} – School calendar`;
  return new Response(buildICS(name, items, school.timezone || 'Africa/Johannesburg'), {
    status: 200,
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'public, max-age=900' },
  });
};
