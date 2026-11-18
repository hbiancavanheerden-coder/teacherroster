// PayFast (https://payfast.io) integration helpers. Server only.
// Checkout uses PayFast's hosted payment page with a subscription (recurring billing);
// renewals and cancellations arrive as ITNs (Instant Transaction Notifications).
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { HttpError } from './core.js';

export const isSandbox = () => String(process.env.PAYFAST_SANDBOX || '').toLowerCase() === 'true';
const host = () => (isSandbox() ? 'sandbox.payfast.co.za' : 'www.payfast.co.za');
export const processUrl = () => `https://${host()}/eng/process`;

export function payfastConfigured() {
  return Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY && process.env.PAYFAST_PASSPHRASE);
}

// PHP-style urlencode, which is what PayFast signs: spaces as '+', uppercase hex, and !'()* encoded.
export function pfEncode(v) {
  return encodeURIComponent(String(v).trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

// Checkout + ITN signature: fields in the given order, passphrase appended.
// Checkout skips empty values; ITN validation signs every posted field (keepEmpty).
export function signFields(fields, passphrase = process.env.PAYFAST_PASSPHRASE, { keepEmpty = false } = {}) {
  const parts = Object.entries(fields)
    .filter(([k, v]) => k !== 'signature' && (keepEmpty || (v !== undefined && v !== null && String(v).trim() !== '')))
    .map(([k, v]) => `${k}=${pfEncode(v)}`);
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase)}`);
  return md5(parts.join('&'));
}

// Subscription API signature: headers + body + passphrase, sorted alphabetically.
export function signApi(params, passphrase = process.env.PAYFAST_PASSPHRASE) {
  const all = { ...params, passphrase };
  return md5(Object.keys(all).sort().map((k) => `${k}=${pfEncode(all[k])}`).join('&'));
}

/**
 * Builds the hidden form fields for a subscription checkout.
 * Field ORDER matters for the signature and follows PayFast's documented attribute order.
 */
export function checkoutFields({ paymentId, amount, itemName, email, firstName, frequency, schoolId, plan, interval, returnUrl, cancelUrl, notifyUrl }) {
  if (!payfastConfigured()) throw new HttpError(503, 'Payments are not configured yet. Please contact support.');
  const today = new Date().toISOString().slice(0, 10);
  const fields = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    name_first: firstName,
    email_address: email,
    m_payment_id: paymentId,
    amount: amount.toFixed(2),
    item_name: itemName,
    custom_str1: schoolId,
    custom_str2: plan,
    custom_str3: interval,
    subscription_type: '1',
    billing_date: today,
    recurring_amount: amount.toFixed(2),
    frequency: String(frequency), // 3 = monthly, 6 = annual
    cycles: '0', // 0 = until cancelled
  };
  // drop empties so the posted form matches what was signed
  for (const k of Object.keys(fields)) if (fields[k] === undefined || fields[k] === null || String(fields[k]).trim() === '') delete fields[k];
  return { ...fields, signature: signFields(fields) };
}

// ---------- ITN validation (all four checks recommended by PayFast) ----------
const VALID_HOSTS = ['www.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za', 'sandbox.payfast.co.za'];

export async function isPayfastIp(ip) {
  if (!ip) return false;
  const lists = await Promise.all(VALID_HOSTS.map((h) => dns.lookup(h, { all: true }).catch(() => [])));
  return lists.flat().some((a) => a.address === ip);
}

export async function confirmWithPayfast(paramString) {
  const res = await fetch(`https://${host()}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: paramString,
  });
  return (await res.text()).trim() === 'VALID';
}

// Parses the raw ITN body keeping PayFast's field order, and returns the string used for validation.
export function parseItn(raw) {
  const pairs = raw.split('&').filter(Boolean).map((p) => {
    const i = p.indexOf('=');
    const k = decodeURIComponent(p.slice(0, i));
    const v = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
    return [k, v];
  });
  const data = Object.fromEntries(pairs);
  const ordered = Object.fromEntries(pairs.filter(([k]) => k !== 'signature'));
  const paramString = pairs.filter(([k]) => k !== 'signature').map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
  return { data, ordered, paramString };
}

// ---------- Subscription API ----------
export async function subscriptionApi(token, action, method = 'PUT') {
  if (!payfastConfigured()) throw new HttpError(503, 'Payments are not configured yet.');
  const headers = {
    'merchant-id': process.env.PAYFAST_MERCHANT_ID,
    version: 'v1',
    timestamp: new Date().toISOString().slice(0, 19),
  };
  headers.signature = signApi(headers);
  const url = `https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/${action}${isSandbox() ? '?testing=true' : ''}`;
  const res = await fetch(url, { method, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && data.status !== 'success')) {
    console.error('PayFast API error', action, res.status, JSON.stringify(data).slice(0, 300));
    throw new HttpError(502, data?.data?.message || 'Payment provider error');
  }
  return data.data?.response ?? data;
}

// PayFast-hosted page where the subscriber updates their card.
export const updateCardUrl = (token, returnUrl) =>
  `https://${host()}/eng/recurring/update/${encodeURIComponent(token)}?return=${encodeURIComponent(returnUrl)}`;
