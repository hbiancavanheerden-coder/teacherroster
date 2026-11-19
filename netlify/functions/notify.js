// Event-driven notifications. Message content is always built server-side from
// Firestore data, so a client can't use this endpoint to send arbitrary text.
import { handler, body, requireUser, requireMember, json, HttpError } from './_lib/core.js';
import { deliver, adminStaffIds } from './_lib/deliver.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const p = await body(req);
  const { school, member, schoolRef } = await requireMember(user.uid, p.schoolId);
  const isAdmin = ['owner', 'admin'].includes(member.role);
  const cats = Object.fromEntries((await schoolRef.collection('dutyCategories').get()).docs.map((d) => [d.id, d.data().name]));
  const staffName = async (id) => (await schoolRef.collection('staff').doc(id).get()).data()?.name || 'A colleague';

  let recipients = [];
  let pref = 'duties';

  switch (p.kind) {
    // A roster was generated/published for a date range: everyone gets their own list.
    case 'roster_published': {
      if (!isAdmin) throw new HttpError(403, 'Only administrators can publish rosters.');
      if (!DATE_RE.test(p.from) || !DATE_RE.test(p.to)) throw new HttpError(400, 'Invalid dates');
      const snap = await schoolRef.collection('duties').where('date', '>=', p.from).where('date', '<=', p.to).get();
      const by = {};
      snap.docs.forEach((d) => { const x = d.data(); if (x.staffId) (by[x.staffId] ||= []).push(x); });
      recipients = Object.entries(by).map(([staffId, list]) => ({
        staffId,
        title: 'Your duty roster has been published',
        body: `You have ${list.length} ${list.length === 1 ? 'duty' : 'duties'} between ${fmt(p.from)} and ${fmt(p.to)}.`,
        lines: list.sort((a, b) => a.date.localeCompare(b.date)).map((x) => `${fmt(x.date)} — ${cats[x.categoryId] || 'Duty'}`),
        link: '/app/my-duties',
      }));
      break;
    }
    // Individual assignment changes made in the roster editor.
    case 'duty_changes': {
      if (!isAdmin) throw new HttpError(403, 'Only administrators can change duties.');
      const changes = Array.isArray(p.changes) ? p.changes.slice(0, 200) : [];
      const by = {};
      for (const c of changes) {
        if (!c.staffId || !DATE_RE.test(c.date) || !['assigned', 'removed'].includes(c.action)) continue;
        (by[c.staffId] ||= []).push(`${c.action === 'assigned' ? 'Added' : 'Removed'}: ${cats[c.categoryId] || 'Duty'} on ${fmt(c.date)}`);
      }
      recipients = Object.entries(by).map(([staffId, lines]) => ({
        staffId, title: 'Your duties have changed', body: 'An administrator updated your duty schedule:', lines, link: '/app/my-duties',
      }));
      break;
    }
    // Relief saved for a date: tell each covering teacher their lessons.
    case 'relief': {
      if (!isAdmin) throw new HttpError(403, 'Only administrators can arrange relief.');
      if (!DATE_RE.test(p.date)) throw new HttpError(400, 'Invalid date');
      const periods = school.settings?.periods || [];
      const snap = await schoolRef.collection('relief').where('date', '==', p.date).get();
      const by = {};
      snap.docs.forEach((d) => { const r = d.data(); if (r.coverStaffId) (by[r.coverStaffId] ||= []).push(r); });
      recipients = Object.entries(by).map(([staffId, list]) => {
        const lines = list.sort((a, b) => a.periodIndex - b.periodIndex).map((r) => `${periods[r.periodIndex]?.name || 'Period ' + (r.periodIndex + 1)}${periods[r.periodIndex]?.start ? ' (' + periods[r.periodIndex].start + ')' : ''}: ${r.className} ${r.subject}${r.room ? ', ' + r.room : ''}`.replace(/\s+/g, ' '));
        return { staffId, title: `Relief ${fmt(p.date)}: ${lines[0]}${lines.length > 1 ? ` +${lines.length - 1} more` : ''}`, body: `You’re covering ${list.length} lesson${list.length === 1 ? '' : 's'} on ${fmt(p.date)}.`, lines, link: '/app/briefing' };
      });
      break;
    }
    // Invigilators assigned to exam sessions.
    case 'invigilation': {
      if (!isAdmin) throw new HttpError(403, 'Only administrators can assign invigilators.');
      const ids = Array.isArray(p.examIds) ? p.examIds.slice(0, 100).map(String) : [];
      const by = {};
      for (const id of ids) {
        const x = (await schoolRef.collection('exams').doc(id).get()).data();
        if (!x) continue;
        (x.invigilatorIds || []).forEach((sid) => (by[sid] ||= []).push(x));
      }
      recipients = Object.entries(by).map(([staffId, list]) => ({
        staffId, title: 'Invigilation duty', body: `You’re invigilating ${list.length} exam session${list.length === 1 ? '' : 's'}.`,
        lines: list.sort((a, b) => a.date.localeCompare(b.date)).map((x) => `${fmt(x.date)} ${x.startTime}–${x.endTime}: ${x.subject} ${x.grade || ''}${x.venue ? ' · ' + x.venue : ''}`.trim()),
        link: '/app/my-duties',
      }));
      pref = 'duties';
      break;
    }
    case 'swap': {
      pref = 'swaps';
      const snap = await schoolRef.collection('swapRequests').doc(String(p.swapId)).get();
      if (!snap.exists) throw new HttpError(404, 'Swap request not found');
      const s = snap.data();
      if (!isAdmin && ![s.fromStaffId, s.toStaffId].includes(member.staffId)) throw new HttpError(403, 'Not your swap request');
      const [from, to] = await Promise.all([staffName(s.fromStaffId), staffName(s.toStaffId)]);
      const what = `${cats[s.categoryId] || 'Duty'} on ${fmt(s.date)}`;
      const admins = await adminStaffIds(schoolRef);
      const msg = {
        pending: [[s.toStaffId], `${from} asked you to take a duty`, `${from} would like you to take over ${what}.`],
        accepted: [[s.fromStaffId, ...admins], 'Duty swap accepted', `${to} agreed to take ${what} from ${from}. It needs administrator approval.`],
        declined: [[s.fromStaffId], 'Duty swap declined', `${to} can't take ${what}.`],
        approved: [[s.fromStaffId, s.toStaffId], 'Duty swap approved', `${what} is now assigned to ${to}.`],
        rejected: [[s.fromStaffId, s.toStaffId], 'Duty swap not approved', `The swap of ${what} was not approved. ${from} keeps the duty.`],
      }[s.status];
      if (!msg) return json({ ok: true, skipped: true });
      const [ids, title, text] = msg;
      recipients = [...new Set(ids)].filter((id) => id && id !== member.staffId).map((staffId) => ({ staffId, title, body: text, link: '/app/swaps' }));
      break;
    }
    case 'announcement': {
      if (!isAdmin) throw new HttpError(403, 'Only administrators can post announcements.');
      pref = 'announcements';
      const a = await schoolRef.collection('announcements').doc(String(p.announcementId)).get();
      if (!a.exists) throw new HttpError(404, 'Announcement not found');
      const { title, body: text } = a.data();
      const members = await schoolRef.collection('members').get();
      recipients = members.docs.map((d) => d.data().staffId).filter((id) => id && id !== member.staffId)
        .map((staffId) => ({ staffId, title: `Announcement: ${title}`, body: String(text).slice(0, 600), link: '/app/announcements' }));
      break;
    }
    case 'absence': {
      pref = 'duties';
      const a = await schoolRef.collection('absences').doc(String(p.absenceId)).get();
      if (!a.exists) throw new HttpError(404, 'Absence not found');
      const x = a.data();
      if (!isAdmin && x.staffId !== member.staffId) throw new HttpError(403, 'Not your absence');
      const name = await staffName(x.staffId);
      const duties = await schoolRef.collection('duties').where('staffId', '==', x.staffId).get();
      const affected = duties.docs.map((d) => d.data()).filter((d) => d.date >= x.start && d.date <= (x.end || x.start));
      const range = x.end && x.end !== x.start ? `${fmt(x.start)} – ${fmt(x.end)}` : fmt(x.start);
      recipients = (await adminStaffIds(schoolRef)).filter((id) => id !== member.staffId).map((staffId) => ({
        staffId,
        title: `${name} is absent ${range}`,
        body: affected.length ? `${affected.length} duty slot(s) need a substitute.` : 'No duties are affected.',
        lines: affected.map((d) => `${fmt(d.date)} — ${cats[d.categoryId] || 'Duty'}`),
        link: '/app/absences',
      }));
      break;
    }
    default:
      throw new HttpError(400, 'Unknown notification type');
  }

  const result = await deliver(school, recipients, pref);
  return json({ ok: true, ...result });
});
