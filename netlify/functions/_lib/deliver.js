// Delivers a notification to staff: in-app (Firestore) + email (if plan allows and user opted in).
import { db, FieldValue, effectivePlan, appUrl, esc } from './core.js';
import { sendEmail, layout, emailConfigured } from './email.js';
import { pushToStaff } from './push.js';

export const PREF_DEFAULTS = { duties: true, swaps: true, announcements: true, digest: true, events: true };

/**
 * recipients: [{ staffId, title, body, lines?: string[] (plain text), link }]
 * pref: which preference key controls email for this kind
 */
export async function deliver(school, recipients, pref) {
  const fs = db();
  const schoolRef = fs.collection('schools').doc(school.id);
  const plan = effectivePlan(school.billing);
  const canEmail = plan.features.emailNotifications && emailConfigured();
  let inApp = 0, emailed = 0;

  // Free push notifications to every subscribed device (accounts and shared-link subscribers).
  let pushed = 0;
  try {
    pushed = await pushToStaff(school.id, recipients.map((r) => ({
      staffId: r.staffId, title: r.title, url: r.link || '/app', tag: pref,
      body: (r.pushBody || [r.body, ...(r.lines || [])].filter(Boolean).join(' · ')).slice(0, 220),
    })));
  } catch (e) { console.error('push delivery failed', e.message); }

  for (const r of recipients) {
    const staffSnap = await schoolRef.collection('staff').doc(r.staffId).get();
    if (!staffSnap.exists) continue;
    const staff = staffSnap.data();
    if (!staff.uid) continue; // in-app notifications and email need an account
    await schoolRef.collection('notifications').add({
      toUid: staff.uid, title: r.title, body: r.body, link: r.link || '/app', read: false, kind: pref,
      createdAt: FieldValue.serverTimestamp(),
    });
    inApp++;
    if (!canEmail || !staff.email) continue;
    const userSnap = await fs.collection('users').doc(staff.uid).get();
    const prefs = { ...PREF_DEFAULTS, ...(userSnap.data()?.prefs?.email || {}) };
    if (!prefs[pref]) continue;
    try {
      await sendEmail({
        to: staff.email,
        subject: `${r.title} · ${school.name}`,
        html: layout({
          heading: r.title,
          intro: r.body,
          lines: (r.lines || []).map((l) => esc(l)),
          cta: { label: 'Open Staffboard', url: appUrl(r.link || '/app') },
          footer: `Sent by ${school.name} via Staffboard.`,
        }),
        text: [r.title, r.body, ...(r.lines || []), appUrl(r.link || '/app')].join('\n'),
      });
      emailed++;
    } catch (e) {
      console.error('deliver email failed', e.message);
    }
  }
  return { inApp, emailed, pushed };
}

export async function adminStaffIds(schoolRef) {
  const snap = await schoolRef.collection('members').where('role', 'in', ['owner', 'admin']).get();
  return snap.docs.map((d) => d.data().staffId).filter(Boolean);
}
