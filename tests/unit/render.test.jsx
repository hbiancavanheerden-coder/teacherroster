// @vitest-environment jsdom
// Smoke test: every app page renders for an admin and a teacher without throwing.
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SchoolCtx } from '../../src/context/SchoolContext.jsx';
import { AuthCtx } from '../../src/context/AuthContext.jsx';
import { ToastProvider } from '../../src/components/ui.jsx';
import { effectivePlan } from '../../src/config/plans.js';

import Dashboard from '../../src/app/Dashboard.jsx';
import MyDuties from '../../src/app/MyDuties.jsx';
import Roster from '../../src/app/Roster.jsx';
import Calendar from '../../src/app/Calendar.jsx';
import Terms from '../../src/app/Terms.jsx';
import Staff from '../../src/app/Staff.jsx';
import Timetable from '../../src/app/Timetable.jsx';
import Absences from '../../src/app/Absences.jsx';
import Swaps from '../../src/app/Swaps.jsx';
import Announcements from '../../src/app/Announcements.jsx';
import Reports from '../../src/app/Reports.jsx';
import Notifications from '../../src/app/Notifications.jsx';
import Audit from '../../src/app/Audit.jsx';
import Settings from '../../src/app/Settings.jsx';
import Billing from '../../src/app/Billing.jsx';
import Account from '../../src/app/Account.jsx';
import AppLayout from '../../src/app/AppLayout.jsx';
import Onboarding from '../../src/app/Onboarding.jsx';
import Home from '../../src/marketing/Home.jsx';
import Relief from '../../src/app/Relief.jsx';
import Invigilation from '../../src/app/Invigilation.jsx';
import Inspections from '../../src/app/Inspections.jsx';
import Briefing from '../../src/app/Briefing.jsx';
import TvPage from '../../src/app/TvPage.jsx';
import Pricing from '../../src/marketing/Pricing.jsx';

const staff = [{ id: 'st1', name: 'Bianca', active: true, uid: 'u1' }, { id: 'st2', name: 'Nancy', active: true }];
const categories = [{ id: 'c1', name: 'Morning Taxi', order: 0, days: [1, 2, 3, 4, 5], staffNeeded: 1, startTime: '07:00', endTime: '07:40' }];
const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const school = {
  name: 'Test School', timezone: 'Africa/Johannesburg',
  billing: { status: 'trialing', plan: 'school', seats: 60, accessUntil: ts(Date.now() + 5 * 86400000) },
  settings: { periods: [{ name: 'P1', start: '08:00', end: '08:45' }, { name: 'Break', start: '10:00', end: '10:30', isBreak: true }], schoolDays: [1, 2, 3, 4, 5] },
};
const user = { uid: 'u1', email: 'b@x.co.za', displayName: 'Bianca', emailVerified: false, providerData: [{ providerId: 'password' }] };

function ctx(role) {
  return {
    loading: false, profile: { schools: { s1: { name: 'Test School', role } } }, sid: 's1', school, member: { name: 'Bianca', role, staffId: 'st1' },
    role, isAdmin: role !== 'teacher', isOwner: role === 'owner', myStaffId: 'st1', staff, activeStaff: staff,
    staffById: Object.fromEntries(staff.map((s) => [s.id, s])), categories, activeCategories: categories,
    catById: { c1: categories[0] }, plan: effectivePlan(school.billing), canWrite: true, today: '2026-11-18',
    actor: { uid: 'u1', name: 'Bianca' }, write: async () => [], switchSchool: async () => {},
  };
}

const PAGES = { Relief, Invigilation, Inspections, Briefing, TvPage, Dashboard, MyDuties, Roster, Calendar, Terms, Staff, Timetable, Absences, Swaps, Announcements, Reports, Notifications, Audit, Settings, Billing, Account, Onboarding };

function render(el, role) {
  return renderToString(
    <MemoryRouter>
      <AuthCtx.Provider value={{ user, loading: false, signOut: async () => {} }}>
        <SchoolCtx.Provider value={ctx(role)}>
          <ToastProvider>{el}</ToastProvider>
        </SchoolCtx.Provider>
      </AuthCtx.Provider>
    </MemoryRouter>,
  );
}

describe('app pages render', () => {
  for (const role of ['owner', 'teacher']) {
    for (const [name, Page] of Object.entries(PAGES)) {
      it(`${name} as ${role}`, () => {
        const html = render(<Page />, role);
        expect(html.length).toBeGreaterThan(50);
      });
    }
    it(`layout as ${role}`, () => {
      const html = render(<AppLayout><div>child</div></AppLayout>, role);
      expect(html).toContain('Test School');
      expect(html).toContain('trial ends in');
      if (role === 'teacher') expect(html).not.toContain('Billing');
    });
  }
  it('marketing pages render', () => {
    expect(render(<Home />, 'owner')).toContain('build themselves');
    expect(render(<Pricing />, 'owner')).toContain('R599');
  });
});

import { RosterReview, TimetableReview } from '../../src/app/DocumentImport.jsx';
describe('document import review', () => {
  it('shows matches and flags unknown names', () => {
    const imp = { fileName: 'term4.pdf', status: 'ready', result: { documentType: 'duty_roster', warnings: ['Row 3 unreadable'], lessons: [], duties: [
      { date: '2026-10-06', dutyPoint: 'Morning Taxi', staffName: 'BIANCA', note: '' },
      { date: '2026-10-07', dutyPoint: 'Tuck shop', staffName: 'Thandi', note: '' },
    ] } };
    const html = render(<RosterReview imp={imp} importId="i1" onDone={() => {}} onRetry={() => {}} />, 'owner').replace(/<!-- -->/g, '');
    expect(html).toContain('2 duties');
    expect(html).toContain('Thandi');
    expect(html).toContain('1 to check');
    expect(html).toContain('Row 3 unreadable');
  });
  it('renders the timetable review', () => {
    const imp = { fileName: 'tt.docx', status: 'ready', result: { documentType: 'timetable', warnings: [], duties: [], lessons: [
      { day: 1, period: 'P1', startTime: '08:00', endTime: '08:45', staffName: 'Nancy', className: '5A', subject: 'Maths', room: '' },
    ] } };
    const html = render(<TimetableReview imp={imp} importId="i2" onDone={() => {}} onRetry={() => {}} />, 'owner').replace(/<!-- -->/g, '');
    expect(html).toContain('1 lessons');
    expect(html).toContain('5A');
  });
});

import UpgradeModal, { ShareLocked } from '../../src/app/UpgradeModal.jsx';
describe('teacher-plan upsell', () => {
  it('renders the share-with-staff prompt and the upgrade modal', () => {
    expect(render(<ShareLocked onOpen={() => {}} />, 'owner')).toContain('Share this with your staff');
    const html = render(<UpgradeModal onClose={() => {}} />, 'owner').replace(/<!-- -->/g, '');
    expect(html).toContain('Ask your principal');
    expect(html).toContain('R599');
  });
});

describe('School-only pages on the Teacher plan', () => {
  it('show the upgrade explanation instead of the tool', () => {
    for (const Page of [Relief, Invigilation, Inspections, Briefing, TvPage]) {
      const c = ctx('owner');
      const solo = { ...c, plan: effectivePlan({ status: 'active', plan: 'solo' }) };
      const html = renderToString(<MemoryRouter><AuthCtx.Provider value={{ user, loading: false }}><SchoolCtx.Provider value={solo}><ToastProvider><Page /></ToastProvider></SchoolCtx.Provider></AuthCtx.Provider></MemoryRouter>);
      expect(html).toContain('School plan');
      expect(html).toContain('Get this for my school');
    }
  });
});
