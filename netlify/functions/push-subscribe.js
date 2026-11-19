// Registers a device for push notifications.
//   Signed-in teacher:  POST {action:'subscribe', schoolId, subscription}            (Authorization: Bearer <idToken>)
//   Shared roster link: POST {action:'subscribe', token, staffId, subscription}        (no login: teacher picks their name)
//   Either:             POST {action:'unsubscribe', endpoint}
//   Status:             POST {action:'status', endpoint} -> {subscribed, staffId}
//   Test:               POST {action:'test', endpoint}  -> sends "Notifications are on" to that device
import { handler, body, requireUser, requireMember, requireActive, db, json, HttpError, FieldValue, appUrl } from './_lib/core.js';
import { subId, validSubscription, pushConfigured, pushToStaff } from './_lib/push.js';

export default handler(['POST'], async (req) => {
  const p = await body(req);
  if (!pushConfigured()) throw new HttpError(503, 'Notifications are not configured on the server yet.');
  const fs = db();

  if (p.action === 'unsubscribe' || p.action === 'status' || p.action === 'test') {
    const ref = fs.collection('pushSubscriptions').doc(subId(p.endpoint || ''));
    const snap = await ref.get();
    if (p.action === 'unsubscribe') { if (snap.exists) await ref.delete(); return json({ ok: true }); }
    if (p.action === 'status') return json({ subscribed: snap.exists, staffId: snap.exists ? snap.data().staffId : null });
    if (!snap.exists) throw new HttpError(404, 'This device is not subscribed.');
    const s = snap.data();
    await pushToStaff(s.schoolId, [{ staffId: s.staffId, title: 'Notifications are on ✓', body: 'You’ll get your duty reminders here each school morning.', tag: 'test' }]);
    return json({ ok: true });
  }

  if (p.action !== 'subscribe') throw new HttpError(400, 'Unknown action');
  if (!validSubscription(p.subscription)) throw new HttpError(400, 'This browser returned an invalid push subscription.');

  let record;
  if (p.token) {
    // Shared roster link (no account): the link must be live and the staff member must belong to that school.
    const link = await fs.collection('links').doc(String(p.token)).get();
    if (!link.exists || link.data().revoked || link.data().type !== 'roster') throw new HttpError(404, 'This roster link is no longer active.');
    const schoolId = link.data().schoolId;
    const school = (await fs.collection('schools').doc(schoolId).get()).data();
    requireActive({ ...school });
    const staff = await fs.collection('schools').doc(schoolId).collection('staff').doc(String(p.staffId || '')).get();
    if (!staff.exists || staff.data().active === false) throw new HttpError(400, 'Choose your name from the list.');
    record = { schoolId, staffId: staff.id, uid: null, via: 'link', linkUrl: appUrl(`/r/${p.token}`) };
  } else {
    const user = await requireUser(req);
    const { school, member } = await requireMember(user.uid, p.schoolId);
    requireActive(school);
    if (!member.staffId) throw new HttpError(400, 'Your account isn’t linked to a staff record yet.');
    record = { schoolId: school.id, staffId: member.staffId, uid: user.uid, via: 'account', linkUrl: null };
  }

  const ref = fs.collection('pushSubscriptions').doc(subId(p.subscription.endpoint));
  await ref.set({
    ...record,
    endpoint: p.subscription.endpoint,
    keys: { p256dh: p.subscription.keys.p256dh, auth: p.subscription.keys.auth },
    userAgent: String(req.headers.get('user-agent') || '').slice(0, 200),
    createdAt: FieldValue.serverTimestamp(),
  });
  // Cap devices per staff member (oldest removed) to keep things tidy.
  const mine = await fs.collection('pushSubscriptions').where('schoolId', '==', record.schoolId).where('staffId', '==', record.staffId).get();
  if (mine.size > 5) {
    const sorted = mine.docs.sort((a, b) => (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0));
    await Promise.all(sorted.slice(0, mine.size - 5).map((d) => d.ref.delete()));
  }
  return json({ ok: true, staffId: record.staffId });
});
