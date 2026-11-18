// GET ?token=...  -> public invite details (school name, invited email)
// POST {token}    -> signed-in user joins the school if their email matches the invite.
import { handler, body, requireUser, db, json, HttpError, FieldValue, audit } from './_lib/core.js';

async function loadInvite(t) {
  if (!t || typeof t !== 'string' || t.length > 100) throw new HttpError(400, 'Invalid invitation link.');
  const ref = db().collection('invites').doc(t);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'This invitation link is not valid.');
  const inv = snap.data();
  if (inv.status !== 'pending') throw new HttpError(410, 'This invitation has already been used or was replaced by a newer one.');
  if (inv.expiresAt.toMillis() < Date.now()) throw new HttpError(410, 'This invitation has expired. Ask your administrator to send a new one.');
  return { ref, inv };
}

export default handler(['GET', 'POST'], async (req) => {
  if (req.method === 'GET') {
    const { inv } = await loadInvite(new URL(req.url).searchParams.get('token'));
    return json({ schoolName: inv.schoolName, email: inv.email, name: inv.name, invitedBy: inv.invitedByName });
  }
  const user = await requireUser(req);
  const { token } = await body(req);
  const { ref, inv } = await loadInvite(token);
  if ((user.email || '').toLowerCase() !== inv.email) {
    throw new HttpError(403, `This invitation was sent to ${inv.email}. Sign in with that email address to accept it.`);
  }
  const fs = db();
  const schoolRef = fs.collection('schools').doc(inv.schoolId);
  const memberRef = schoolRef.collection('members').doc(user.uid);
  const staffRef = schoolRef.collection('staff').doc(inv.staffId);

  await fs.runTransaction(async (tx) => {
    const [school, staff, existingMember, members] = await Promise.all([
      tx.get(schoolRef), tx.get(staffRef), tx.get(memberRef), tx.get(schoolRef.collection('members').count()),
    ]);
    if (!school.exists || !staff.exists) throw new HttpError(404, 'This school or staff record no longer exists.');
    if (staff.data().uid && staff.data().uid !== user.uid) throw new HttpError(409, 'This staff record is already linked to another account.');
    if (!existingMember.exists && members.data().count >= (school.data().billing?.seats || 1)) {
      throw new HttpError(402, 'Your school has used all its staff accounts. Ask your administrator to upgrade.');
    }
    if (!existingMember.exists) {
      tx.set(memberRef, { role: inv.role, staffId: inv.staffId, name: staff.data().name, email: inv.email, joinedAt: FieldValue.serverTimestamp() });
    }
    tx.update(staffRef, { uid: user.uid });
    tx.set(fs.collection('users').doc(user.uid), {
      email: user.email,
      displayName: staff.data().name,
      activeSchoolId: inv.schoolId,
      schools: { [inv.schoolId]: { name: school.data().name, role: existingMember.exists ? existingMember.data().role : inv.role } },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.update(ref, { status: 'accepted', acceptedBy: user.uid, acceptedAt: FieldValue.serverTimestamp() });
  });
  await audit(inv.schoolId, { uid: user.uid, name: inv.name }, 'member.join', `${inv.name} accepted their invitation`);
  return json({ schoolId: inv.schoolId });
});
