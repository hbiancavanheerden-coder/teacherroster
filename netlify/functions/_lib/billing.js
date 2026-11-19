// Subscription state machine driven by PayFast ITNs.
// Server-only Firestore docs (denied to clients by rules):
//   billingCheckouts/{m_payment_id}   { schoolId, plan, interval, amount, uid, status }
//   billingCustomers/pf_{token}       { schoolId, plan, interval }   PayFast subscription token -> school
import { db, billingFor, audit, FieldValue, PLANS } from './core.js';
import { GRACE_DAYS } from '../../../src/config/plans.js';
import { subscriptionApi } from './payfast.js';

const DAY = 86400000;
const periodMs = (interval) => (interval === 'annual' ? 366 : 31) * DAY;
export const expectedAmount = (plan, interval) => (interval === 'annual' ? PLANS[plan].annual : PLANS[plan].monthly);

export async function updateBilling(schoolId, patch, summary) {
  const ref = db().collection('schools').doc(schoolId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const cur = snap.data().billing || {};
  const plan = patch.plan || cur.plan;
  const status = patch.status || cur.status;
  const accessUntilMs = patch.accessUntilMs ?? cur.accessUntil?.toMillis?.() ?? Date.now();
  const extra = { ...cur, ...patch.extra };
  for (const k of ['accessUntil', 'features', 'seats', 'plan', 'status', 'updatedAt']) delete extra[k];
  await ref.update({ billing: billingFor({ plan, status, accessUntilMs, extra }) });
  if (summary) await audit(schoolId, null, 'billing.update', summary);
}

/**
 * Handles a validated ITN. Returns a short description for logging.
 * First payment: m_payment_id matches a checkout we created.
 * Renewals: same token; PayFast repeats custom_str fields, and we also map token -> school.
 */
export async function handleItn(itn) {
  const fs = db();
  const token = itn.token || null;
  let ctx = null;
  if (itn.m_payment_id) {
    const c = await fs.collection('billingCheckouts').doc(itn.m_payment_id).get();
    if (c.exists) ctx = { ...c.data(), ref: c.ref };
  }
  if (!ctx && token) {
    const m = await fs.collection('billingCustomers').doc('pf_' + token).get();
    if (m.exists) ctx = m.data();
  }
  if (!ctx) return 'unknown payment';
  const { schoolId, plan, interval } = ctx;
  if (!PLANS[plan]) return 'unknown plan';

  const ref = fs.collection('schools').doc(schoolId);
  const cur = (await ref.get()).data()?.billing || {};

  if (itn.payment_status === 'COMPLETE') {
    const gross = Number(itn.amount_gross);
    if (Math.abs(gross - expectedAmount(plan, interval)) > 0.01) {
      await audit(schoolId, null, 'billing.mismatch', `Payment of R${gross} did not match the ${plan} ${interval} price; not applied`);
      return 'amount mismatch';
    }
    const base = Math.max(Date.now(), cur.token === token ? (cur.accessUntil?.toMillis?.() || 0) - GRACE_DAYS * DAY : 0);
    const accessUntilMs = base + periodMs(interval) + GRACE_DAYS * DAY;
    if (token) await fs.collection('billingCustomers').doc('pf_' + token).set({ schoolId, plan, interval, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    // Plan change: cancel the previous subscription so the school isn't billed twice.
    if (cur.token && token && cur.token !== token) {
      try { await subscriptionApi(cur.token, 'cancel'); } catch (e) { console.error('Could not cancel previous subscription', e.message); }
    }
    // A personal workspace that a school pays for becomes the school's workspace.
    if (plan === 'school') await ref.update({ type: 'school' }).catch(() => {});
    await updateBilling(schoolId, {
      plan, status: 'active', accessUntilMs,
      extra: { interval, token, provider: 'payfast', amount: gross, lastPaymentAt: new Date(), lastReference: itn.pf_payment_id || null, cancelAtPeriodEnd: false, nextPaymentDate: new Date(accessUntilMs - GRACE_DAYS * DAY).toISOString().slice(0, 10) },
    }, `Payment received (${PLANS[plan].name}, ${interval}) – R${gross.toFixed(2)}`);
    if (ctx.ref) await ctx.ref.update({ status: 'paid', token, paidAt: FieldValue.serverTimestamp() });
    // Revenue ledger for the platform owner dashboard (idempotent per PayFast payment id).
    await fs.collection('payments').doc(String(itn.pf_payment_id || itn.m_payment_id + '-' + Date.now())).set({
      schoolId, plan, interval, amount: gross, at: FieldValue.serverTimestamp(), provider: 'payfast',
    }, { merge: true });
    return 'activated';
  }

  if (itn.payment_status === 'CANCELLED') {
    if (cur.token && token && cur.token !== token) return 'old subscription cancelled';
    // Access continues until the end of the period already paid for.
    await updateBilling(schoolId, { status: 'cancelled', extra: { cancelAtPeriodEnd: true } }, 'Subscription cancelled');
    return 'cancelled';
  }

  if (itn.payment_status === 'FAILED') {
    await updateBilling(schoolId, { status: 'past_due' }, 'A subscription payment failed');
    return 'failed';
  }
  return 'ignored ' + itn.payment_status;
}
