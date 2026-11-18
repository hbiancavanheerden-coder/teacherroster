// PayFast ITN endpoint (notify_url): https://YOUR-SITE/api/billing-webhook
// Performs PayFast's four security checks: signature, source IP, server confirmation and amount
// (amount is checked against the plan price in handleItn).
import { parseItn, signFields, isPayfastIp, confirmWithPayfast } from './_lib/payfast.js';
import { handleItn } from './_lib/billing.js';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  const { data, ordered, paramString } = parseItn(raw);

  if (!data.signature || signFields(ordered, undefined, { keepEmpty: true }) !== data.signature) {
    return new Response('Invalid signature', { status: 400 });
  }
  if (data.merchant_id !== process.env.PAYFAST_MERCHANT_ID) {
    return new Response('Wrong merchant', { status: 400 });
  }
  const ip = req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (!(await isPayfastIp(ip))) {
    console.warn('ITN from non-PayFast IP', ip);
    return new Response('Invalid source', { status: 403 });
  }
  if (!(await confirmWithPayfast(paramString))) {
    return new Response('Not confirmed', { status: 400 });
  }
  try {
    const result = await handleItn(data);
    console.log('ITN', data.m_payment_id, data.payment_status, result);
  } catch (e) {
    console.error('ITN handling failed', e);
    return new Response('Error', { status: 500 }); // PayFast retries failed notifications
  }
  return new Response('OK', { status: 200 });
};
