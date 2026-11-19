// Scheduled every weekday at 04:30 UTC (06:30 SAST). Each teacher gets their duties for today and
// upcoming school events (per each event's reminder setting):
//   • push notification on every device they enabled (free, all plans, incl. shared-link subscribers)
//   • in-app notification + email for staff with accounts (email on School plan, if opted in)
import { db } from './_lib/core.js';
import { deliver } from './_lib/deliver.js';
import { expandEvents, closedDays } from '../../src/lib/events.js';
import { addDays, todayISO } from '../../src/lib/dates.js';

export const config = { schedule: '30 4 * * 1-5' };

export function buildDigest({ today, schoolName, duties, categories, events, staffIds, accountStaff }) {
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const upcoming = expandEvents(events, today, addDays(today, 14))
    .filter((o) => o.remindDaysBefore !== null && o.remindDaysBefore !== -1)
    .filter((o) => addDays(o.occurrence, -(o.remindDaysBefore ?? 1)) === today);
  const byStaff = {};
  duties.forEach((x) => { if (x.staffId) (byStaff[x.staffId] ||= []).push(x); });

  const recipients = [];
  for (const staffId of staffIds) {
    const mine = byStaff[staffId] || [];
    const evs = upcoming.filter((o) => accountStaff.has(staffId) || !o.private);
    const dutyText = mine.map((x) => { const c = catById[x.categoryId] || {}; return `${c.name || 'Duty'}${c.startTime ? ` ${c.startTime}–${c.endTime}` : ''}`; });
    const evText = evs.map((o) => `${o.occurrence === today ? 'Today' : o.occurrence}: ${o.title}${o.startTime && o.allDay === false ? ' at ' + o.startTime : ''}`);
    if (!dutyText.length && !evText.length) continue;
    recipients.push({
      staffId,
      title: mine.length ? `☀ You're on duty today: ${dutyText.join(', ')}` : '📅 Coming up at school',
      body: mine.length ? `Good morning! Here's your day at ${schoolName}.` : `Reminders from ${schoolName}.`,
      pushBody: evText.join(' · ') || 'Tap to see today’s roster.',
      lines: [...dutyText.map((d) => `Duty today: ${d}`), ...evText],
      link: '/app',
    });
  }
  return recipients;
}

export default async () => {
  const fs = db();
  const schools = await fs.collection('schools').where('billing.accessUntil', '>', new Date()).get();
  let emailed = 0, pushed = 0;
  for (const s of schools.docs) {
    const school = { id: s.id, ...s.data() };
    const today = todayISO(school.timezone || 'Africa/Johannesburg');
    const [cats, duties, evs, members, subs] = await Promise.all([
      s.ref.collection('dutyCategories').get(),
      s.ref.collection('duties').where('date', '==', today).get(),
      s.ref.collection('events').get(),
      s.ref.collection('members').get(),
      fs.collection('pushSubscriptions').where('schoolId', '==', s.id).get(),
    ]);
    const events = evs.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (closedDays(events, today, today).has(today)) continue; // public holiday / school closed
    const accountStaff = new Set(members.docs.map((m) => m.data().staffId).filter(Boolean));
    const staffIds = new Set([...accountStaff, ...subs.docs.map((d) => d.data().staffId)]);
    if (!staffIds.size) continue;
    const recipients = buildDigest({
      today, schoolName: school.name, duties: duties.docs.map((d) => d.data()),
      categories: cats.docs.map((d) => ({ id: d.id, ...d.data() })), events, staffIds, accountStaff,
    });
    const r = await deliver(school, recipients, 'digest');
    emailed += r.emailed; pushed += r.pushed;
  }
  console.log(`daily-digest: ${pushed} push notifications, ${emailed} emails`);
  return new Response('ok');
};
