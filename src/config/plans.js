// Single source of truth for plans, prices and feature limits.
// Imported by BOTH the React app and the Netlify Functions, so keep it dependency-free.
// Prices are in South African Rand (ZAR). PayFast amounts are in Rand with 2 decimals.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3; // access kept after a failed renewal after the renewal date

export const PLANS = {
  solo: {
    id: 'solo',
    name: 'Teacher',
    tagline: 'For the teacher who runs the roster',
    monthly: 59,
    annual: 590,
    seats: 1, // number of login accounts
    features: {
      invites: false,
      emailNotifications: false,
      swaps: false,
      timetable: true,
      absences: true,
      auditLog: false,
      publicRoster: true,
    },
    highlights: [
      '1 login, unlimited staff on the roster',
      'Automatic fair-rotation scheduling',
      'Shareable read-only roster link for staff',
      'Term calendar, timetables and absences',
      'PDF, CSV and calendar (ICS) exports',
    ],
  },
  school: {
    id: 'school',
    name: 'School',
    tagline: 'For schools that want every teacher connected',
    monthly: 499,
    annual: 4990,
    seats: 60,
    popular: true,
    features: {
      invites: true,
      emailNotifications: true,
      swaps: true,
      timetable: true,
      absences: true,
      auditLog: true,
      publicRoster: true,
    },
    highlights: [
      'Everything in Teacher',
      'Up to 60 staff accounts',
      'Duty swap requests with approval',
      'Email notifications and morning digests',
      'Absence and substitute management',
      'Audit log and workload reports',
    ],
  },
  plus: {
    id: 'plus',
    name: 'School Plus',
    tagline: 'For large and combined schools',
    monthly: 999,
    annual: 9990,
    seats: 200,
    features: {
      invites: true,
      emailNotifications: true,
      swaps: true,
      timetable: true,
      absences: true,
      auditLog: true,
      publicRoster: true,
    },
    highlights: [
      'Everything in School',
      'Up to 200 staff accounts',
      'Priority email support',
      'Help importing your existing rosters',
    ],
  },
};

export const PLAN_ORDER = ['solo', 'school', 'plus'];

// During the free trial a workspace gets School features.
export function effectivePlan(billing) {
  if (!billing) return PLANS.school;
  if (billing.status === 'trialing') return PLANS.school;
  return PLANS[billing.plan] || PLANS.solo;
}

export function hasAccess(billing, now = Date.now()) {
  if (!billing || !billing.accessUntil) return false;
  const until = typeof billing.accessUntil.toMillis === 'function'
    ? billing.accessUntil.toMillis()
    : new Date(billing.accessUntil).getTime();
  return until > now;
}

export function formatRand(n) {
  return 'R' + Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}
