// Sends account invitations to staff members (School plans). Enforces seat limits server-side.
import { handler, body, requireUser, requireMember, requireActive, requireFeature, db, json, HttpError, FieldValue, Timestamp, token, appUrl, audit } from './_lib/core.js';
import { sendEmail, layout, emailConfigured } from './_lib/email.js';

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const { schoolId, staffIds, role = 'teacher' } = await body(req);
  const { school, member, schoolRef } = await requireMember(user.uid, schoolId, ['owner', 'admin']);
  requireActive(school);
  requireFeature(school, 'invites');
  if (!['teacher', 'admin'].includes(role)) throw new HttpError(400, 'Invalid role');
  if (!Array.isArray(staffIds) || !staffIds.length || staffIds.length > 200) throw new HttpError(400, 'Choose staff to invite.');
  if (!emailConfigured()) throw new HttpError(503, 'Email is not configured on the server yet (RESEND_API_KEY).');

  const fs = db();
  const [members, pending] = await Promise.all([
    schoolRef.collection('members').count().get(),
    fs.collection('invites').where('schoolId', '==', schoolId).where('status', '==', 'pending').get(),
  ]);
  const pendingStaff = new Set(pending.docs.filter((d) => d.data().expiresAt.toMillis() > Date.now()).map((d) => d.data().staffId));
  const seats = school.billing?.seats || 1;
  let used = members.data().count + pendingStaff.size;

  const results = [];
  for (const staffId of staffIds) {
    const s = await schoolRef.collection('staff').doc(String(staffId)).get();
    if (!s.exists) { results.push({ staffId, ok: false, error: 'Staff member not found' }); continue; }
    const staff = s.data();
    if (staff.uid) { results.push({ staffId, name: staff.name, ok: false, error: 'Already has an account' }); continue; }
    if (!staff.email) { results.push({ staffId, name: staff.name, ok: false, error: 'No email address' }); continue; }
    if (!pendingStaff.has(staffId)) {
      if (used >= seats) { results.push({ staffId, name: staff.name, ok: false, error: `Seat limit reached (${seats}). Upgrade your plan for more accounts.` }); continue; }
      used++;
    }
    // Invalidate older invites for the same staff record.
    for (const d of pending.docs.filter((d) => d.data().staffId === staffId)) await d.ref.update({ status: 'replaced' });

    const t = token();
    await fs.collection('invites').doc(t).set({
      schoolId, schoolName: school.name, staffId, email: staff.email.toLowerCase(), name: staff.name, role,
      status: 'pending', invitedBy: user.uid, invitedByName: member.name,
      createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 14 * 86400000),
    });
    try {
      await sendEmail({
        to: staff.email,
        subject: `${member.name} invited you to ${school.name} on Staffboard`,
        html: layout({
          heading: `Join ${school.name}`,
          intro: `${member.name} has added you to the ${school.name} staff duty register. Create your account to see your duties, timetable and school calendar, and to get reminders.`,
          cta: { label: 'Accept invitation', url: appUrl(`/invite/${t}`) },
          footer: 'This invitation expires in 14 days. If you weren\'t expecting it, you can ignore this email.',
        }),
        text: `${member.name} invited you to ${school.name} on Staffboard. Accept: ${appUrl(`/invite/${t}`)}`,
      });
      await s.ref.update({ invitedAt: FieldValue.serverTimestamp() });
      results.push({ staffId, name: staff.name, ok: true });
    } catch {
      results.push({ staffId, name: staff.name, ok: false, error: 'Email could not be sent' });
    }
  }
  const sent = results.filter((r) => r.ok).length;
  if (sent) await audit(schoolId, { uid: user.uid, name: member.name }, 'staff.invite', `Invited ${sent} staff member${sent === 1 ? '' : 's'}: ${results.filter((r) => r.ok).map((r) => r.name).join(', ')}`);
  return json({ results });
});
