// Platform owner dashboard data (you, the SaaS owner — not school admins).
// Access: signed-in user whose verified email is listed in PLATFORM_ADMIN_EMAILS (comma-separated).
// GET -> { kpis, revenueByMonth[], signupsByMonth[], byPlan, recentSchools[] }
import { handler, requireUser, db, json, HttpError, PLANS } from './_lib/core.js';

const DAY = 86400000;

export function isPlatformAdmin(user) {
  const list = String(process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(user?.email && user.email_verified && list.includes(user.email.toLowerCase()));
}

// Monthly-equivalent value of one school's subscription.
export function monthlyValue(billing) {
  if (!billing || !['active', 'past_due'].includes(billing.status)) return 0;
  const plan = PLANS[billing.plan];
  const charged = Number(billing.amount) || (plan ? (billing.interval === 'annual' ? plan.annual : plan.monthly) : 0);
  return billing.interval === 'annual' ? charged / 12 : charged;
}

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}

export default handler(['GET'], async (req) => {
  const user = await requireUser(req);
  if (!isPlatformAdmin(user)) throw new HttpError(403, 'This page is only for the platform owner.');
  const fs = db();
  const now = Date.now();

  const [schools, usersCount, membersCount, payments] = await Promise.all([
    fs.collection('schools').get(),
    fs.collection('users').count().get(),
    fs.collectionGroup('members').count().get(),
    fs.collection('payments').where('at', '>=', new Date(now - 366 * DAY)).get(),
  ]);

  const status = { trialing: 0, active: 0, past_due: 0, cancelled: 0, expired: 0 };
  const byPlan = Object.fromEntries(Object.keys(PLANS).map((k) => [k, { schools: 0, mrr: 0 }]));
  let mrr = 0;
  let newLast30 = 0;
  const signups = {};
  const list = [];
  for (const d of schools.docs) {
    const s = d.data();
    const b = s.billing || {};
    const until = b.accessUntil?.toMillis?.() || 0;
    const st = until < now && b.status !== 'active' ? 'expired' : (b.status || 'expired');
    status[st] = (status[st] || 0) + 1;
    const v = monthlyValue(b);
    mrr += v;
    if (v && byPlan[b.plan]) { byPlan[b.plan].schools++; byPlan[b.plan].mrr += v; }
    const created = s.createdAt?.toDate?.();
    if (created) {
      if (now - created.getTime() < 30 * DAY) newLast30++;
      signups[monthKey(created)] = (signups[monthKey(created)] || 0) + 1;
    }
    list.push({ id: d.id, name: s.name, type: s.type, plan: b.plan, interval: b.interval || null, status: st, mrr: Math.round(v), createdAt: created?.toISOString() || null });
  }

  const revenue = {};
  payments.docs.forEach((p) => { const x = p.data(); const at = x.at?.toDate?.(); if (at) revenue[monthKey(at)] = (revenue[monthKey(at)] || 0) + Number(x.amount || 0); });
  const months = lastMonths(12);
  const paid = status.active + status.past_due;
  const everConverted = paid + status.cancelled;

  return json({
    generatedAt: new Date().toISOString(),
    kpis: {
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      payingSchools: paid,
      trialing: status.trialing,
      workspaces: schools.size,
      users: usersCount.data().count,
      staffAccounts: membersCount.data().count,
      newLast30,
      trialConversion: everConverted + status.expired ? Math.round((everConverted / (everConverted + status.expired)) * 100) : null,
      arpa: paid ? Math.round(mrr / paid) : 0,
    },
    status,
    byPlan,
    revenueByMonth: months.map((m) => ({ month: m, amount: Math.round(revenue[m] || 0) })),
    signupsByMonth: months.map((m) => ({ month: m, count: signups[m] || 0 })),
    recentSchools: list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50),
  });
});
