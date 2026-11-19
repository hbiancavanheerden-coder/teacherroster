// Single source of truth for plans, prices and feature limits.
// Imported by BOTH the React app and the Netlify Functions, so keep it dependency-free.
// Prices are in South African Rand (ZAR). PayFast amounts are in Rand with 2 decimals.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3; // access kept after a failed renewal after the renewal date

export const PLANS = {
  solo: {
    id: 'solo',
    name: 'Teacher',
    tagline: 'Your own duties, timetable and reminders, organised',
    monthly: 99,
    annual: 990,
    seats: 1, // number of login accounts
    features: {
      invites: false,
      emailNotifications: false,
      swaps: false,
      timetable: true,
      absences: true,
      auditLog: false,
      publicRoster: false, // sharing live with colleagues (shared link, their calendars & notifications) is the School plan
      relief: false,
      invigilation: false,
      inspections: false,
      briefing: false,
      tvDisplay: false,
    },
    highlights: [
      'Your duties, timetable and school calendar in one place',
      'Free morning reminders on your phone',
      'AI import: upload the school’s roster PDF and find your duties',
      'Build and auto-schedule a roster, then print or download it',
      'PDF, CSV and personal calendar sync',
    ],
  },
  school: {
    id: 'school',
    name: 'School',
    tagline: 'The whole staffroom, live on every teacher’s phone',
    monthly: 599,
    annual: 5990,
    seats: 150,
    popular: true,
    features: {
      invites: true,
      emailNotifications: true,
      swaps: true,
      timetable: true,
      absences: true,
      auditLog: true,
      publicRoster: true,
      relief: true,
      invigilation: true,
      inspections: true,
      briefing: true,
      tvDisplay: true,
    },
    highlights: [
      'Everything in Teacher, for your whole school',
      'Shared roster link: staff see it live, no login needed',
      'Free morning reminders for every teacher',
      'Up to 150 staff accounts with personal dashboards',
      'Relief roster: fair class cover from the timetable',
      'Exam invigilation roster, built automatically',
      'Staffroom TV display and a daily staff briefing',
      'Inspection & moderation planner, swaps and audit log',
    ],
  },
};

export const PLAN_ORDER = ['solo', 'school'];

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
