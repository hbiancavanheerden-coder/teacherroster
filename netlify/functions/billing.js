// POST {action:'checkout', schoolId, plan, interval} -> {url, fields}  signed PayFast form the browser posts
// POST {action:'cancel', schoolId}                   -> {ok}           cancel the PayFast subscription
// POST {action:'update-card', schoolId}              -> {url}          PayFast page to change the card
import { handler, body, requireUser, requireMember, json, HttpError, PLANS, appUrl, db, FieldValue, audit } from './_lib/core.js';
import { checkoutFields, processUrl, subscriptionApi, updateCardUrl } from './_lib/payfast.js';
import { expectedAmount, updateBilling } from './_lib/billing.js';

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const p = await body(req);

  if (p.action === 'checkout') {
    const { school, member, schoolRef } = await requireMember(user.uid, p.schoolId, ['owner', 'admin']);
    const plan = PLANS[p.plan];
    if (!plan || !['monthly', 'annual'].includes(p.interval)) throw new HttpError(400, 'Choose a plan and billing period.');
    // A school workspace is always on the School plan; the Teacher plan is for personal workspaces only.
    if (school.type !== 'personal' && p.plan !== 'school') throw new HttpError(400, 'School workspaces use the School plan. The Teacher plan is for individual teachers.');
    const members = (await schoolRef.collection('members').count().get()).data().count;
    if (members > plan.seats) throw new HttpError(400, `This workspace has ${members} staff accounts; the ${plan.name} plan allows ${plan.seats}. Remove accounts or choose a larger plan.`);
    if (school.billing?.status === 'active' && school.billing?.plan === p.plan && school.billing?.interval === p.interval) {
      throw new HttpError(400, 'You are already on this plan.');
    }
    const amount = expectedAmount(p.plan, p.interval);
    const ref = db().collection('billingCheckouts').doc();
    await ref.set({ schoolId: school.id, plan: p.plan, interval: p.interval, amount, uid: user.uid, status: 'pending', createdAt: FieldValue.serverTimestamp() });
    const fields = checkoutFields({
      paymentId: ref.id,
      amount,
      itemName: `Staffboard ${plan.name} (${p.interval}) – ${school.name}`.slice(0, 100),
      email: user.email,
      firstName: (member.name || '').split(' ')[0].slice(0, 100),
      frequency: p.interval === 'annual' ? 6 : 3,
      schoolId: school.id,
      plan: p.plan,
      interval: p.interval,
      returnUrl: appUrl('/app/billing?paid=1'),
      cancelUrl: appUrl('/app/billing?cancelled=1'),
      notifyUrl: appUrl('/api/billing-webhook'),
    });
    return json({ url: processUrl(), fields });
  }

  if (p.action === 'cancel') {
    const { school, member } = await requireMember(user.uid, p.schoolId, ['owner', 'admin']);
    const token = school.billing?.token;
    if (!token) throw new HttpError(400, 'There is no active subscription to cancel.');
    await subscriptionApi(token, 'cancel');
    await updateBilling(school.id, { status: 'cancelled', extra: { cancelAtPeriodEnd: true } }, null);
    await audit(school.id, { uid: user.uid, name: member.name }, 'billing.cancel', 'Cancelled the subscription (access continues until the paid period ends)');
    return json({ ok: true });
  }

  if (p.action === 'update-card') {
    const { school } = await requireMember(user.uid, p.schoolId, ['owner', 'admin']);
    const token = school.billing?.token;
    if (!token) throw new HttpError(400, 'There is no active subscription yet.');
    return json({ url: updateCardUrl(token, appUrl('/app/billing')) });
  }

  throw new HttpError(400, 'Unknown action');
});
