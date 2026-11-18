// Account & membership administration that must run with elevated privileges.
// POST {action:'remove-member', schoolId, uid}   admin removes a staff account (keeps their staff record)
// POST {action:'leave', schoolId}                 user leaves a school
// POST {action:'delete-account'}                  POPIA: delete my login and profile
import { handler, body, requireUser, requireMember, db, auth, json, HttpError, FieldValue, audit } from './_lib/core.js';

async function detach(schoolId, uid) {
  const fs = db();
  const userRef = fs.collection('users').doc(uid);
  const profile = (await userRef.get()).data() || {};
  const schoolRef = fs.collection('schools').doc(schoolId);
  const m = await schoolRef.collection('members').doc(uid).get();
  if (!m.exists) return null;
  const batch = fs.batch();
  if (m.data().staffId) batch.update(schoolRef.collection('staff').doc(m.data().staffId), { uid: FieldValue.delete() });
  batch.delete(m.ref);
  const remaining = Object.keys(profile.schools || {}).filter((id) => id !== schoolId);
  batch.set(userRef, {
    schools: { [schoolId]: FieldValue.delete() },
    ...(profile.activeSchoolId === schoolId ? { activeSchoolId: remaining[0] || null } : {}),
  }, { merge: true });
  await batch.commit();
  return m.data();
}

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const p = await body(req);

  if (p.action === 'remove-member') {
    const { member } = await requireMember(user.uid, p.schoolId, ['owner', 'admin']);
    if (p.uid === user.uid) throw new HttpError(400, 'Use "Leave workspace" to remove yourself.');
    const target = await db().collection('schools').doc(p.schoolId).collection('members').doc(String(p.uid)).get();
    if (!target.exists) throw new HttpError(404, 'Member not found');
    if (target.data().role === 'owner') throw new HttpError(403, 'The owner cannot be removed.');
    await detach(p.schoolId, p.uid);
    await audit(p.schoolId, { uid: user.uid, name: member.name }, 'member.remove', `Removed ${target.data().name}'s account access`);
    return json({ ok: true });
  }

  if (p.action === 'leave') {
    const { member } = await requireMember(user.uid, p.schoolId);
    if (member.role === 'owner') throw new HttpError(400, 'Owners cannot leave their own workspace. Contact support to transfer ownership.');
    await detach(p.schoolId, user.uid);
    await audit(p.schoolId, { uid: user.uid, name: member.name }, 'member.leave', `${member.name} left the workspace`);
    return json({ ok: true });
  }

  if (p.action === 'delete-account') {
    const profile = (await db().collection('users').doc(user.uid).get()).data() || {};
    const schools = Object.entries(profile.schools || {});
    for (const [sid, s] of schools) {
      if (s.role === 'owner') {
        const count = (await db().collection('schools').doc(sid).collection('members').count().get()).data().count;
        if (count > 1) throw new HttpError(400, `You own "${s.name}", which still has other staff accounts. Remove them first or contact support to transfer ownership.`);
      }
    }
    for (const [sid, s] of schools) {
      if (s.role === 'owner') {
        // Sole owner: mark the workspace for deletion (data purged by support after 30 days to allow recovery).
        await db().collection('schools').doc(sid).update({ deletionRequestedAt: FieldValue.serverTimestamp() });
      }
      await detach(sid, user.uid);
    }
    await db().collection('users').doc(user.uid).delete();
    await auth().deleteUser(user.uid);
    return json({ ok: true });
  }
  throw new HttpError(400, 'Unknown action');
});
