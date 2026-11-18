import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';

beforeAll(() => {
  process.env.PAYFAST_MERCHANT_ID = '10000100';
  process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a';
  process.env.PAYFAST_PASSPHRASE = 'jt7NOE43FZPn';
  process.env.PAYFAST_SANDBOX = 'true';
});

const md5 = (x) => crypto.createHash('md5').update(x).digest('hex');

describe('payfast helpers', () => {
  it('url-encodes like PHP urlencode', async () => {
    const { pfEncode } = await import('../../netlify/functions/_lib/payfast.js');
    expect(pfEncode(' Staffboard School (monthly)! ')).toBe('Staffboard+School+%28monthly%29%21');
    expect(pfEncode('a@b.co.za')).toBe('a%40b.co.za');
  });
  it('signs checkout fields in documented order with the passphrase', async () => {
    const { checkoutFields, signFields, processUrl } = await import('../../netlify/functions/_lib/payfast.js');
    const f = checkoutFields({ paymentId: 'abc', amount: 499, itemName: 'Staffboard School', email: 't@x.co.za', firstName: '', frequency: 3, schoolId: 's1', plan: 'school', interval: 'monthly', returnUrl: 'https://x/r', cancelUrl: 'https://x/c', notifyUrl: 'https://x/n' });
    const keys = Object.keys(f);
    expect(keys.indexOf('merchant_id')).toBe(0);
    expect(keys.indexOf('amount')).toBeLessThan(keys.indexOf('subscription_type'));
    expect(keys).not.toContain('name_first'); // empty values are dropped
    expect(f).toMatchObject({ amount: '499.00', recurring_amount: '499.00', frequency: '3', cycles: '0', subscription_type: '1' });
    const { signature, ...rest } = f;
    const manual = md5(Object.entries(rest).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`).join('&') + '&passphrase=jt7NOE43FZPn');
    expect(signature).toBe(manual);
    expect(signFields(rest)).toBe(signature);
    expect(processUrl()).toBe('https://sandbox.payfast.co.za/eng/process');
  });
  it('signs API calls with sorted headers + passphrase', async () => {
    const { signApi } = await import('../../netlify/functions/_lib/payfast.js');
    const h = { 'merchant-id': '10000100', version: 'v1', timestamp: '2026-11-18T08:00:00' };
    expect(signApi(h)).toBe(md5('merchant-id=10000100&passphrase=jt7NOE43FZPn&timestamp=2026-11-18T08%3A00%3A00&version=v1'));
  });
  it('parses ITN bodies preserving order', async () => {
    const { parseItn } = await import('../../netlify/functions/_lib/payfast.js');
    const r = parseItn('m_payment_id=abc&item_name=School+plan&amount_gross=499.00&custom_str1=&signature=xyz');
    expect(r.data.item_name).toBe('School plan');
    expect(r.paramString).toBe('m_payment_id=abc&item_name=School+plan&amount_gross=499.00&custom_str1=');
  });
});

describe('ITN endpoint', () => {
  it('rejects bad signatures, then untrusted source IPs', async () => {
    const { default: hook } = await import('../../netlify/functions/billing-webhook.js');
    const { signFields } = await import('../../netlify/functions/_lib/payfast.js');
    const fields = { m_payment_id: 'abc', pf_payment_id: '1', payment_status: 'COMPLETE', amount_gross: '499.00', custom_str1: 's1', merchant_id: '10000100', token: '' };
    const raw = Object.entries(fields).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const bad = await hook(new Request('http://x/api/billing-webhook', { method: 'POST', body: raw + '&signature=nope' }));
    expect(bad.status).toBe(400);
    const sig = signFields(fields, undefined, { keepEmpty: true });
    const spoofed = await hook(new Request('http://x/api/billing-webhook', { method: 'POST', body: raw + '&signature=' + sig, headers: { 'x-nf-client-connection-ip': '203.0.113.9' } }));
    expect(spoofed.status).toBe(403);
  });
});

describe('http handler', () => {
  it('rejects requests without a Firebase token and bad methods', async () => {
    const { default: notify } = await import('../../netlify/functions/notify.js');
    const r1 = await notify(new Request('http://x/api/notify', { method: 'POST', body: '{}' }));
    expect(r1.status).toBe(401);
    const r2 = await notify(new Request('http://x/api/notify', { method: 'GET' }));
    expect(r2.status).toBe(405);
  });
  it('validates the contact form and honours the honeypot', async () => {
    const { default: contact } = await import('../../netlify/functions/contact.js');
    const bad = await contact(new Request('http://x/api/contact', { method: 'POST', body: JSON.stringify({ name: 'A', email: 'no', message: 'hi' }) }));
    expect(bad.status).toBe(400);
    const bot = await contact(new Request('http://x/api/contact', { method: 'POST', body: JSON.stringify({ website: 'spam' }) }));
    expect(bot.status).toBe(200);
  });
});

describe('billing state', () => {
  it('builds billing with plan features for security rules', async () => {
    const { billingFor } = await import('../../netlify/functions/_lib/core.js');
    const trial = billingFor({ plan: 'school', status: 'trialing', accessUntilMs: Date.now() + 1000 });
    expect(trial.features.invites).toBe(true);
    const solo = billingFor({ plan: 'solo', status: 'active', accessUntilMs: Date.now() });
    expect(solo.features.swaps).toBe(false);
    expect(solo.seats).toBe(1);
  });
});
