// Free Web Push notifications (no per-message cost). Works on Android/desktop browsers and on
// iPhone/iPad (iOS 16.4+) once Staffboard has been added to the home screen.
//
// Subscriptions live in /pushSubscriptions/{sha256(endpoint)} (server-only):
//   { schoolId, staffId, uid|null, via: 'account'|'link', endpoint, keys{p256dh, auth}, createdAt, lastOkAt }
import webpush from 'web-push';
import crypto from 'node:crypto';
import { db, FieldValue } from './core.js';

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function init() {
  if (ready || !pushConfigured()) return pushConfigured();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  ready = true;
  return true;
}

export const subId = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 40);

// Only accept real push-service URLs over HTTPS (prevents the server being used to call arbitrary hosts).
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];
export function validSubscription(sub) {
  try {
    const u = new URL(sub?.endpoint);
    if (u.protocol !== 'https:') return false;
    if (!PUSH_HOSTS.some((re) => re.test(u.hostname))) return false;
    return typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string' && sub.keys.p256dh.length < 200 && sub.keys.auth.length < 100;
  } catch {
    return false;
  }
}

/**
 * Sends one notification to every device subscribed for the given staff members of a school.
 * messages: [{ staffId, title, body, url, tag }]
 * Returns the number of devices reached. Expired subscriptions are removed automatically.
 */
export async function pushToStaff(schoolId, messages) {
  if (!messages.length || !init()) return 0;
  const fs = db();
  const ids = [...new Set(messages.map((m) => m.staffId))];
  const subs = [];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await fs.collection('pushSubscriptions').where('schoolId', '==', schoolId).where('staffId', 'in', ids.slice(i, i + 30)).get();
    subs.push(...snap.docs);
  }
  let sent = 0;
  await Promise.all(subs.map(async (doc) => {
    const s = doc.data();
    const m = messages.find((x) => x.staffId === s.staffId);
    if (!m) return;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({
        title: m.title, body: m.body, url: s.via === 'link' && s.linkUrl ? s.linkUrl : (m.url || '/app'), tag: m.tag,
      }), { TTL: 6 * 3600, urgency: 'normal' });
      sent++;
      await doc.ref.update({ lastOkAt: FieldValue.serverTimestamp() }).catch(() => {});
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.delete().catch(() => {});
      else console.error('push failed', e.statusCode, e.body);
    }
  }));
  return sent;
}
