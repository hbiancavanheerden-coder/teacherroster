// Public contact / demo-request form -> email to CONTACT_TO via Resend.
import { handler, body, json, HttpError, esc } from './_lib/core.js';
import { sendEmail, emailConfigured } from './_lib/email.js';

const recent = new Map(); // best-effort per-instance rate limit

export default handler(['POST'], async (req) => {
  const p = await body(req);
  if (p.website) return json({ ok: true }); // honeypot field: bots fill it, humans never see it
  const name = String(p.name || '').trim().slice(0, 100);
  const email = String(p.email || '').trim().slice(0, 200);
  const school = String(p.school || '').trim().slice(0, 150);
  const topic = String(p.topic || 'General').trim().slice(0, 50);
  const message = String(p.message || '').trim().slice(0, 4000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
    throw new HttpError(400, 'Please enter your name, a valid email and a message of at least 10 characters.');
  }
  const ip = req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const last = recent.get(ip) || 0;
  if (Date.now() - last < 30000) throw new HttpError(429, 'Please wait a moment before sending another message.');
  recent.set(ip, Date.now());
  if (!emailConfigured() || !process.env.CONTACT_TO) throw new HttpError(503, 'Our contact form is temporarily unavailable. Please email us directly.');

  await sendEmail({
    to: process.env.CONTACT_TO,
    replyTo: email,
    subject: `[Staffboard] ${topic} – ${name}${school ? ' (' + school + ')' : ''}`,
    html: `<p><b>Name:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}<br><b>School:</b> ${esc(school)}<br><b>Topic:</b> ${esc(topic)}</p><p style="white-space:pre-wrap">${esc(message)}</p>`,
    text: `Name: ${name}\nEmail: ${email}\nSchool: ${school}\nTopic: ${topic}\n\n${message}`,
  });
  return json({ ok: true });
});
