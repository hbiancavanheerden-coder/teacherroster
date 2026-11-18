// Scheduled every weekday at 04:30 UTC (06:30 SAST): emails each opted-in teacher their
// duties for today and school events coming up (based on each event's reminder setting).
import { db, effectivePlan } from './_lib/core.js';
import { deliver } from './_lib/deliver.js';
import { expandEvents } from '../../src/lib/events.js';
import { addDays, todayISO } from '../../src/lib/dates.js';

export const config = { schedule: '30 4 * * 1-5' };

export default async () => {
  const schools = await db().collection('schools').where('billing.accessUntil', '>', new Date()).get();
  let sent = 0;
  for (const s of schools.docs) {
    const school = { id: s.id, ...s.data() };
    if (!effectivePlan(school.billing).features.emailNotifications) continue;
    const today = todayISO(school.timezone || 'Africa/Johannesburg');
    const [cats, duties, evs, members] = await Promise.all([
      s.ref.collection('dutyCategories').get(),
      s.ref.collection('duties').where('date', '==', today).get(),
      s.ref.collection('events').get(),
      s.ref.collection('members').get(),
    ]);
    const catName = Object.fromEntries(cats.docs.map((d) => [d.id, d.data()]));
    const events = evs.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Events whose reminder falls today (remindDaysBefore, default 1 day before; 0 = on the day).
    const upcoming = expandEvents(events, today, addDays(today, 14))
      .filter((o) => o.remindDaysBefore !== null && o.remindDaysBefore !== -1)
      .filter((o) => addDays(o.occurrence, -(o.remindDaysBefore ?? 1)) === today);

    const byStaff = {};
    duties.docs.forEach((d) => { const x = d.data(); if (x.staffId) (byStaff[x.staffId] ||= []).push(x); });

    const recipients = [];
    for (const m of members.docs) {
      const staffId = m.data().staffId;
      if (!staffId) continue;
      const mine = byStaff[staffId] || [];
      const lines = [
        ...mine.map((x) => { const c = catName[x.categoryId] || {}; return `Duty today: ${c.name || 'Duty'}${c.startTime ? ` (${c.startTime}–${c.endTime})` : ''}`; }),
        ...upcoming.map((o) => `${o.occurrence === today ? 'Today' : o.occurrence}: ${o.title}${o.startTime ? ' at ' + o.startTime : ''}`),
      ];
      if (!lines.length) continue;
      recipients.push({
        staffId,
        title: mine.length ? `You're on duty today` : 'Coming up at school',
        body: mine.length ? `Good morning! Here's your day at ${school.name}.` : `Reminders from ${school.name}.`,
        lines,
        link: '/app',
      });
    }
    const r = await deliver(school, recipients, 'digest');
    sent += r.emailed;
  }
  console.log(`daily-digest: ${sent} emails sent`);
  return new Response('ok');
};
