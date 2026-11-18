// Creates a new workspace (school or personal) with the caller as owner and starts the free trial.
import { handler, body, requireUser, db, json, HttpError, FieldValue, billingFor, TRIAL_DAYS, audit } from './_lib/core.js';

const DEFAULT_CATEGORIES = [
  { name: 'Foundation Front', startTime: '07:00', endTime: '07:45', color: '#2F6F5E', phase: 'all' },
  { name: 'Back Gate 1', startTime: '07:00', endTime: '07:45', color: '#3B5BA5', phase: 'all' },
  { name: 'Senior Front', startTime: '07:00', endTime: '07:45', color: '#C28E3F', phase: 'all' },
  { name: 'Back Gate 2', startTime: '07:00', endTime: '07:45', color: '#8E3B7A', phase: 'all' },
  { name: 'Morning Taxi', startTime: '07:00', endTime: '07:40', color: '#A23E2E', phase: 'all' },
  { name: 'Morning Devotion', startTime: '07:30', endTime: '07:45', color: '#20283D', phase: 'all' },
];

const DEFAULT_PERIODS = [
  { name: 'Register', start: '07:45', end: '08:00' },
  { name: 'Period 1', start: '08:00', end: '08:45' },
  { name: 'Period 2', start: '08:45', end: '09:30' },
  { name: 'Period 3', start: '09:30', end: '10:15' },
  { name: 'Break', start: '10:15', end: '10:45', isBreak: true },
  { name: 'Period 4', start: '10:45', end: '11:30' },
  { name: 'Period 5', start: '11:30', end: '12:15' },
  { name: 'Period 6', start: '12:15', end: '13:00' },
];

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const { name, type = 'school', ownerName, timezone = 'Africa/Johannesburg', useTemplate = true } = await body(req);
  const cleanName = String(name || '').trim().slice(0, 120);
  const cleanOwner = String(ownerName || user.name || '').trim().slice(0, 80);
  if (cleanName.length < 2) throw new HttpError(400, 'Please enter your school name.');
  if (!cleanOwner) throw new HttpError(400, 'Please enter your name.');
  if (!['school', 'personal'].includes(type)) throw new HttpError(400, 'Invalid workspace type.');

  const fs = db();
  const userRef = fs.collection('users').doc(user.uid);
  const userSnap = await userRef.get();
  const existing = userSnap.exists ? userSnap.data() : {};
  const owned = Object.values(existing.schools || {}).filter((s) => s.role === 'owner').length;
  if (owned >= 5) throw new HttpError(400, 'You can own up to 5 workspaces. Contact support if you need more.');

  // One free trial per account; additional workspaces start unpaid.
  const trialUsed = Boolean(existing.trialUsed);
  const now = Date.now();
  const billing = trialUsed
    ? billingFor({ plan: 'solo', status: 'unpaid', accessUntilMs: now })
    : billingFor({ plan: 'school', status: 'trialing', accessUntilMs: now + TRIAL_DAYS * 86400000, extra: { trialEndsAt: new Date(now + TRIAL_DAYS * 86400000) } });

  const schoolRef = fs.collection('schools').doc();
  const staffRef = schoolRef.collection('staff').doc();
  const batch = fs.batch();
  batch.set(schoolRef, {
    name: cleanName,
    type,
    timezone,
    ownerUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
    billing,
    settings: {
      periods: DEFAULT_PERIODS,
      phases: ['foundation', 'intermediate', 'senior'],
      schoolDays: [1, 2, 3, 4, 5],
      autoApproveSwaps: false,
    },
  });
  batch.set(schoolRef.collection('members').doc(user.uid), {
    role: 'owner', staffId: staffRef.id, name: cleanOwner, email: user.email || '', joinedAt: FieldValue.serverTimestamp(),
  });
  batch.set(staffRef, {
    name: cleanOwner, email: (user.email || '').toLowerCase(), uid: user.uid, active: true, phase: 'all',
    department: '', grades: '', position: type === 'school' ? 'Administrator' : '', createdAt: FieldValue.serverTimestamp(),
  });
  if (useTemplate) {
    DEFAULT_CATEGORIES.forEach((c, i) => {
      batch.set(schoolRef.collection('dutyCategories').doc(), { ...c, order: i, staffNeeded: 1, days: [1, 2, 3, 4, 5], active: true });
    });
  }
  batch.set(userRef, {
    email: user.email || '',
    displayName: existing.displayName || cleanOwner,
    activeSchoolId: schoolRef.id,
    trialUsed: true,
    schools: { ...(existing.schools || {}), [schoolRef.id]: { name: cleanName, role: 'owner' } },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  await audit(schoolRef.id, { uid: user.uid, name: cleanOwner }, 'school.create', `Created workspace "${cleanName}"`);
  return json({ schoolId: schoolRef.id, trial: !trialUsed });
});
