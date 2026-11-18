// Shared server-side helpers for Netlify Functions. Never imported by the browser bundle.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import { PLANS, effectivePlan, TRIAL_DAYS } from '../../../src/config/plans.js';

export { FieldValue, Timestamp, PLANS, effectivePlan, TRIAL_DAYS };

function app() {
  if (getApps().length) return getApps()[0];
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new HttpError(500, 'Server is not configured: missing Firebase Admin credentials.');
  }
  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
export const db = () => getFirestore(app());
export const auth = () => getAuth(app());

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

// Wraps a handler with method checking and uniform error responses.
export function handler(methods, fn) {
  return async (req, context) => {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed');
      return await fn(req, context);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      return json({ error: status >= 500 && !err.status ? 'Something went wrong on our side. Please try again.' : err.message }, status);
    }
  };
}

export async function body(req) {
  try { return await req.json(); } catch { throw new HttpError(400, 'Invalid JSON body'); }
}

// Verifies the Firebase ID token in the Authorization header.
export async function requireUser(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in.');
  try {
    return await auth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
}

// Loads school + membership and checks role. Returns {school, member, schoolRef}.
export async function requireMember(uid, schoolId, roles = ['owner', 'admin', 'teacher']) {
  if (!schoolId || typeof schoolId !== 'string') throw new HttpError(400, 'Missing school');
  const schoolRef = db().collection('schools').doc(schoolId);
  const [s, m] = await Promise.all([schoolRef.get(), schoolRef.collection('members').doc(uid).get()]);
  if (!s.exists || !m.exists) throw new HttpError(403, 'You are not a member of this school.');
  const member = m.data();
  if (!roles.includes(member.role)) throw new HttpError(403, 'You do not have permission to do that.');
  return { school: { id: s.id, ...s.data() }, member, schoolRef };
}

export function requireActive(school) {
  const until = school.billing?.accessUntil?.toMillis?.() || 0;
  if (until < Date.now()) throw new HttpError(402, 'This workspace\'s trial or subscription has ended. Please choose a plan to continue.');
}

export function requireFeature(school, feature) {
  const plan = effectivePlan(school.billing);
  if (!plan.features[feature]) throw new HttpError(402, `This feature is part of the School plan. Upgrade to use it.`);
}

export const token = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

export function appUrl(path = '') {
  const base = (process.env.APP_URL || process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
  return base + path;
}

export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Feature map stored on the school so security rules can enforce plan limits.
export function billingFor({ plan, status, accessUntilMs, extra = {} }) {
  const p = status === 'trialing' ? PLANS.school : PLANS[plan] || PLANS.solo;
  return {
    plan,
    status,
    seats: p.seats,
    features: p.features,
    accessUntil: Timestamp.fromMillis(accessUntilMs),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
}

export async function audit(schoolId, actor, action, summary, extra = {}) {
  await db().collection('schools').doc(schoolId).collection('auditLogs').add({
    actorUid: actor?.uid || 'system',
    actorName: actor?.name || 'System',
    action,
    summary,
    ...extra,
    at: FieldValue.serverTimestamp(),
  });
}
