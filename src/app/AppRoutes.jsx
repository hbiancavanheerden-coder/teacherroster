import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SchoolProvider, useSchool } from '../context/SchoolContext.jsx';
import { Spinner } from '../components/ui.jsx';
import AppLayout from './AppLayout.jsx';
import Onboarding from './Onboarding.jsx';
import Dashboard from './Dashboard.jsx';

const pages = {
  MyDuties: lazy(() => import('./MyDuties.jsx')),
  Roster: lazy(() => import('./Roster.jsx')),
  Calendar: lazy(() => import('./Calendar.jsx')),
  Terms: lazy(() => import('./Terms.jsx')),
  Staff: lazy(() => import('./Staff.jsx')),
  Timetable: lazy(() => import('./Timetable.jsx')),
  Absences: lazy(() => import('./Absences.jsx')),
  Swaps: lazy(() => import('./Swaps.jsx')),
  Announcements: lazy(() => import('./Announcements.jsx')),
  Reports: lazy(() => import('./Reports.jsx')),
  Notifications: lazy(() => import('./Notifications.jsx')),
  Audit: lazy(() => import('./Audit.jsx')),
  Settings: lazy(() => import('./Settings.jsx')),
  Billing: lazy(() => import('./Billing.jsx')),
  Account: lazy(() => import('./Account.jsx')),
  Platform: lazy(() => import('./Platform.jsx')),
  Briefing: lazy(() => import('./Briefing.jsx')),
  Relief: lazy(() => import('./Relief.jsx')),
  Invigilation: lazy(() => import('./Invigilation.jsx')),
  Inspections: lazy(() => import('./Inspections.jsx')),
  Tv: lazy(() => import('./TvPage.jsx')),
};

function AdminOnly({ children }) {
  const { isAdmin } = useSchool();
  return isAdmin ? children : <Navigate to="/app" replace />;
}

function Inner() {
  const s = useSchool();
  if (s.loading) return <Spinner label="Opening your workspace…" />;
  if (!s.sid || !s.school || !s.member) {
    return (
      <Routes>
        <Route path="account" element={<Suspense fallback={<Spinner />}><pages.Account bare /></Suspense>} />
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }
  const P = pages;
  return (
    <AppLayout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="onboarding" element={<Onboarding allowNew />} />
          <Route path="my-duties" element={<P.MyDuties />} />
          <Route path="roster" element={<P.Roster />} />
          <Route path="calendar" element={<P.Calendar />} />
          <Route path="terms" element={<P.Terms />} />
          <Route path="staff" element={<P.Staff />} />
          <Route path="timetable" element={<P.Timetable />} />
          <Route path="absences" element={<AdminOnly><P.Absences /></AdminOnly>} />
          <Route path="swaps" element={<P.Swaps />} />
          <Route path="announcements" element={<P.Announcements />} />
          <Route path="reports" element={<AdminOnly><P.Reports /></AdminOnly>} />
          <Route path="notifications" element={<P.Notifications />} />
          <Route path="audit" element={<AdminOnly><P.Audit /></AdminOnly>} />
          <Route path="settings" element={<AdminOnly><P.Settings /></AdminOnly>} />
          <Route path="billing" element={<AdminOnly><P.Billing /></AdminOnly>} />
          <Route path="account" element={<P.Account />} />
          <Route path="platform" element={<P.Platform />} />
          <Route path="briefing" element={<P.Briefing />} />
          <Route path="relief" element={<AdminOnly><P.Relief /></AdminOnly>} />
          <Route path="invigilation" element={<AdminOnly><P.Invigilation /></AdminOnly>} />
          <Route path="inspections" element={<AdminOnly><P.Inspections /></AdminOnly>} />
          <Route path="tv" element={<AdminOnly><P.Tv /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

export default function AppRoutes() {
  return <SchoolProvider><Inner /></SchoolProvider>;
}
