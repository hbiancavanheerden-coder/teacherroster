// Transactional email via Resend's REST API.
import { esc, appUrl } from './core.js';

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!emailConfigured()) {
    console.warn('Email not sent: RESEND_API_KEY / EMAIL_FROM not configured');
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('Resend error', res.status, detail);
    throw new Error('Email delivery failed');
  }
  return res.json();
}

// Simple branded layout. `lines` are already-escaped HTML fragments.
export function layout({ heading, intro, lines = [], cta, footer }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(cta.url)}" style="background:#20283D;color:#F6F1E6;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F6F1E6;font-family:Inter,Arial,sans-serif;color:#20283D">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-family:monospace;font-size:11px;letter-spacing:.18em;color:#8A5F1F;text-transform:uppercase">Staffboard</div>
    <div style="background:#fffdf8;border-radius:14px;padding:28px 24px;margin-top:12px;border:1px solid #E5DAC1">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(heading)}</h1>
      ${intro ? `<p style="line-height:1.55;margin:0 0 14px">${esc(intro)}</p>` : ''}
      ${lines.map((l) => `<div style="padding:9px 0;border-bottom:1px solid #EFE6D2;line-height:1.45">${l}</div>`).join('')}
      ${button}
    </div>
    <p style="font-size:12px;color:#6F6756;line-height:1.5;margin-top:18px">${footer ? esc(footer) + '<br>' : ''}
      You can change which emails you receive in <a href="${appUrl('/app/account')}" style="color:#8A5F1F">your notification settings</a>.</p>
  </div></body></html>`;
}
