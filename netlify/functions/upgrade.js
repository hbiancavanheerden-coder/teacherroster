// "Send to my principal": lets a Teacher-plan user ask her school to pay for the School plan.
//
// Signed in (owner/admin of the workspace):
//   POST {action:'link', schoolId}                                   -> {url}  create/reuse a secure pay link
//   POST {action:'send', schoolId, principalName, principalEmail, note} -> {ok}  email the proposal (Resend)
// Public (principal / bursar, no account):
//   GET  ?token=...                                                  -> proposal details
//   POST {action:'checkout', token, interval, email}                 -> {url, fields} PayFast form for the School plan
import { handler, body, requireUser, requireMember, requireActive, db, json, HttpError, FieldValue, Timestamp, token as newToken, appUrl, esc, audit, PLANS } from './_lib/core.js';
import { sendEmail, emailConfigured } from './_lib/email.js';
import { checkoutFields, processUrl } from './_lib/payfast.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_DAYS = 60;

async function getOrCreateLink(school, user, member) {
  const fs = db();
  const existing = await fs.collection('links').where('schoolId', '==', school.id).where('type', '==', 'upgrade').where('revoked', '==', false).get();
  const live = existing.docs.find((d) => (d.data().expiresAt?.toMillis?.() || 0) > Date.now());
  if (live) return live.id;
  const t = newToken(24);
  await fs.collection('links').doc(t).set({
    type: 'upgrade', schoolId: school.id, createdBy: user.uid, requestedByName: member.name || '', revoked: false,
    createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + LINK_DAYS * 86400000),
  });
  return t;
}

async function loadLink(t) {
  if (!t || typeof t !== 'string' || t.length > 100) throw new HttpError(400, 'Invalid link');
  const snap = await db().collection('links').doc(t).get();
  const l = snap.exists && snap.data();
  if (!l || l.type !== 'upgrade' || l.revoked || (l.expiresAt?.toMillis?.() || 0) < Date.now()) throw new HttpError(404, 'This link has expired. Ask the teacher who sent it for a new one.');
  const school = await db().collection('schools').doc(l.schoolId).get();
  if (!school.exists) throw new HttpError(404, 'Not found');
  return { link: l, school: { id: school.id, ...school.data() } };
}

export function proposalText({ schoolName, teacher, staffCount, dutyCount, note }) {
  const p = PLANS.school;
  const hours = Math.max(4, Math.round((staffCount * 0.25) + (dutyCount / 60)));
  return {
    subject: `${teacher} recommends Staffboard for ${schoolName}`,
    intro: `${teacher} already uses Staffboard to organise duty rosters at ${schoolName} and would like the whole staff to have it.`,
    points: [
      `Every teacher sees their own duties live on their phone. No more photos of the noticeboard.`,
      `A free reminder at 06:30 on school days: “You’re on Front gate today”.`,
      `Fair rosters for the whole term in one click, around holidays and absences.`,
      `Duty swaps, absences and substitute cover, calendar and term dates, all in one place.`,
      `Estimated admin saved: about ${hours} hours a term for the person who manages duties.`,
    ],
    price: `R${p.monthly}/month, or R${p.annual.toLocaleString('en-ZA')}/year (two months free), for up to ${p.seats} staff. Cancel any time.`,
    note: note ? String(note).slice(0, 600) : '',
  };
}

export default handler(['GET', 'POST'], async (req) => {
  if (req.method === 'GET') {
    const { link, school } = await loadLink(new URL(req.url).searchParams.get('token'));
    const staff = await db().collection('schools').doc(school.id).collection('staff').count().get();
    return json({
      schoolName: school.name,
      requestedBy: link.requestedByName,
      staffCount: staff.data().count,
      alreadyActive: school.billing?.status === 'active' && school.billing?.plan === 'school',
      plan: { name: PLANS.school.name, monthly: PLANS.school.monthly, annual: PLANS.school.annual, seats: PLANS.school.seats, highlights: PLANS.school.highlights },
    });
  }

  const p = await body(req);

  if (p.action === 'checkout') {
    const { school } = await loadLink(p.token);
    const email = String(p.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address for the receipt.');
    const interval = p.interval === 'annual' ? 'annual' : 'monthly';
    if (school.billing?.status === 'active' && school.billing?.plan === 'school' && school.billing?.interval === interval) throw new HttpError(400, 'This school already has the School plan.');
    const amount = interval === 'annual' ? PLANS.school.annual : PLANS.school.monthly;
    const ref = db().collection('billingCheckouts').doc();
    await ref.set({ schoolId: school.id, plan: 'school', interval, amount, uid: null, payerEmail: email, via: 'upgrade-link', status: 'pending', createdAt: FieldValue.serverTimestamp() });
    const fields = checkoutFields({
      paymentId: ref.id, amount, itemName: `Staffboard School (${interval}) – ${school.name}`.slice(0, 100), email, firstName: '',
      frequency: interval === 'annual' ? 6 : 3, schoolId: school.id, plan: 'school', interval,
      returnUrl: appUrl(`/upgrade/${p.token}?paid=1`), cancelUrl: appUrl(`/upgrade/${p.token}`), notifyUrl: appUrl('/api/billing-webhook'),
    });
    return json({ url: processUrl(), fields });
  }

  const user = await requireUser(req);
  const { school, member, schoolRef } = await requireMember(user.uid, p.schoolId, ['owner', 'admin']);
  requireActive(school);

  if (p.action === 'link') {
    const t = await getOrCreateLink(school, user, member);
    return json({ url: appUrl(`/upgrade/${t}`) });
  }

  if (p.action === 'send') {
    const name = String(p.principalName || '').trim().slice(0, 100);
    const email = String(p.principalEmail || '').trim().toLowerCase();
    if (!name || !EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter your principal’s name and a valid email address.');
    if (!emailConfigured()) throw new HttpError(503, 'Email isn’t set up yet. Use “Copy link” or WhatsApp instead.');
    const since = new Date(Date.now() - 86400000);
    const recent = await db().collection('referrals').where('schoolId', '==', school.id).where('createdAt', '>', since).count().get();
    if (recent.data().count >= 5) throw new HttpError(429, 'You’ve sent 5 proposals today. Please try again tomorrow.');

    const t = await getOrCreateLink(school, user, member);
    const [staff, duties] = await Promise.all([schoolRef.collection('staff').count().get(), schoolRef.collection('duties').count().get()]);
    const pr = proposalText({ schoolName: school.name, teacher: member.name || user.email, staffCount: staff.data().count, dutyCount: duties.data().count, note: p.note });
    const url = appUrl(`/upgrade/${t}`);
    await sendEmail({
      to: email,
      replyTo: user.email,
      subject: pr.subject,
      html: `<!doctype html><html><body style="margin:0;background:#F5F7FB;font-family:Arial,sans-serif;color:#0B1124">
        <div style="max-width:580px;margin:0 auto;padding:32px 20px">
          <div style="background:#fff;border:1px solid #E3E7F0;border-radius:16px;padding:28px 24px">
            <p style="margin:0 0 6px;color:#1E3FD9;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Staffboard for ${esc(school.name)}</p>
            <h1 style="font-size:22px;margin:0 0 14px">Dear ${esc(name)},</h1>
            <p style="line-height:1.6">${esc(pr.intro)}</p>
            ${pr.note ? `<blockquote style="margin:14px 0;padding:12px 16px;background:#F3F6FF;border-radius:10px;line-height:1.5">“${esc(pr.note)}”<br><span style="color:#6B7287">— ${esc(member.name || '')}</span></blockquote>` : ''}
            <ul style="line-height:1.7;padding-left:18px">${pr.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            <p style="line-height:1.6"><b>Price:</b> ${esc(pr.price)}</p>
            <p style="margin:26px 0"><a href="${esc(url)}" style="background:#2952FF;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Review and activate for the school</a></p>
            <p style="font-size:13px;color:#6B7287;line-height:1.5">The roster ${esc(member.name || 'your colleague')} has set up is kept. Activating simply shares it with every staff member. Payment is by card or Instant EFT through PayFast; need an invoice instead? Just reply to this email.</p>
          </div>
        </div></body></html>`,
      text: `${pr.intro}\n\n${pr.points.map((x) => '- ' + x).join('\n')}\n\nPrice: ${pr.price}\n\nReview and activate: ${url}`,
    });
    await db().collection('referrals').add({ schoolId: school.id, uid: user.uid, principalEmail: email, createdAt: FieldValue.serverTimestamp() });
    await audit(school.id, { uid: user.uid, name: member.name }, 'upgrade.request', `Sent the School plan proposal to ${name}`);
    return json({ ok: true, url });
  }

  throw new HttpError(400, 'Unknown action');
});
