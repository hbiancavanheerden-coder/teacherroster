// Manages secret share links stored server-side in /links/{token}:
//   type 'roster' -> public read-only roster page (/r/:token). Admin only.
//   type 'ics'    -> calendar subscription feed. Any member for their own duties; admins for the school calendar.
// POST {schoolId, action:'list'|'create'|'revoke', type, staffId?, token?}
import { handler, body, requireUser, requireMember, requireActive, db, json, HttpError, FieldValue, token as newToken, audit } from './_lib/core.js';

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const p = await body(req);
  const { school, member } = await requireMember(user.uid, p.schoolId);
  const isAdmin = ['owner', 'admin'].includes(member.role);
  const links = db().collection('links');

  if (p.action === 'list') {
    const snap = await links.where('schoolId', '==', school.id).where('revoked', '==', false).get();
    const mine = snap.docs
      .map((d) => ({ token: d.id, ...d.data() }))
      .filter((l) => isAdmin || l.createdBy === user.uid)
      .map(({ token, type, staffId, scope, createdAt }) => ({ token, type, staffId: staffId || null, scope: scope || null, createdAt: createdAt?.toMillis?.() || null }));
    return json({ links: mine });
  }

  if (p.action === 'create') {
    requireActive(school);
    let doc;
    if (p.type === 'roster') {
      if (!isAdmin) throw new HttpError(403, 'Only administrators can share the roster.');
      doc = { type: 'roster' };
    } else if (p.type === 'ics') {
      if (p.scope === 'school') {
        doc = { type: 'ics', scope: 'school' };
      } else {
        const staffId = p.staffId || member.staffId;
        if (staffId !== member.staffId && !isAdmin) throw new HttpError(403, 'You can only create a feed for your own duties.');
        doc = { type: 'ics', scope: 'staff', staffId };
      }
    } else throw new HttpError(400, 'Unknown link type');
    const t = newToken(24);
    await links.doc(t).set({ ...doc, schoolId: school.id, createdBy: user.uid, revoked: false, createdAt: FieldValue.serverTimestamp() });
    await audit(school.id, { uid: user.uid, name: member.name }, 'link.create', `Created a ${doc.type === 'roster' ? 'public roster' : 'calendar feed'} link`);
    return json({ token: t });
  }

  if (p.action === 'revoke') {
    const ref = links.doc(String(p.token || ''));
    const snap = await ref.get();
    if (!snap.exists || snap.data().schoolId !== school.id) throw new HttpError(404, 'Link not found');
    if (!isAdmin && snap.data().createdBy !== user.uid) throw new HttpError(403, 'Not your link');
    await ref.update({ revoked: true, revokedAt: FieldValue.serverTimestamp() });
    await audit(school.id, { uid: user.uid, name: member.name }, 'link.revoke', 'Revoked a share link');
    return json({ ok: true });
  }
  throw new HttpError(400, 'Unknown action');
});
