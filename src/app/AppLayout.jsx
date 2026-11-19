import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCollection, where, limit } from '../lib/data.js';
import { Icon } from '../components/ui.jsx';
import { Brand } from '../marketing/MarketingLayout.jsx';
import { Avatar } from '../components/RegisterCard.jsx';
import { demo } from '../demo/store.js';

// The SaaS owner (you). UI hint only; the server checks PLATFORM_ADMIN_EMAILS.
export function isPlatformOwner(user) {
  if (demo.on) return false; // the public demo never shows the platform owner's business numbers
  const list = String(import.meta.env.VITE_PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(user?.email && list.includes(user.email.toLowerCase()));
}

const NAV = [
  { group: 'Daily', items: [
    ['/app', 'home', 'Today', null, true],
    ['/app/my-duties', 'user', 'My duties'],
    ['/app/roster', 'roster', 'Duty roster'],
    ['/app/calendar', 'calendar', 'Calendar'],
    ['/app/timetable', 'grid', 'Timetable'],
  ] },
  { group: 'Staff', items: [
    ['/app/swaps', 'swap', 'Swaps', 'swaps'],
    ['/app/announcements', 'megaphone', 'Announcements'],
    ['/app/staff', 'users', 'Staff'],
  ] },
  { group: 'Admin', admin: true, items: [
    ['/app/absences', 'absent', 'Away & cover'],
    ['/app/terms', 'clock', 'Term dates'],
    ['/app/reports', 'chart', 'Reports'],
    ['/app/audit', 'log', 'Audit log', 'auditLog'],
    ['/app/settings', 'settings', 'Settings'],
    ['/app/billing', 'card', 'Billing'],
  ] },
];

const TITLES = {
  '/app': 'Today', '/app/my-duties': 'My duties', '/app/roster': 'Duty roster', '/app/calendar': 'Calendar',
  '/app/timetable': 'Timetable', '/app/swaps': 'Duty swaps', '/app/absences': 'Away & cover',
  '/app/announcements': 'Announcements', '/app/staff': 'Staff', '/app/terms': 'Term dates', '/app/reports': 'Reports',
  '/app/audit': 'Audit log', '/app/settings': 'Settings', '/app/billing': 'Billing', '/app/account': 'My account',
  '/app/notifications': 'Notifications', '/app/onboarding': 'New workspace', '/app/platform': 'Platform overview',
};

function daysLeft(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : 0;
  return Math.ceil((ms - Date.now()) / 86400000);
}

export default function AppLayout({ children }) {
  const s = useSchool();
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);

  const unread = useCollection(s.sid, 'notifications', [where('toUid', '==', user.uid), where('read', '==', false), limit(50)], [user.uid]);
  const pendingSwaps = useCollection(s.sid, 'swapRequests', [where('status', 'in', ['pending', 'accepted'])]);
  const swapCount = pendingSwaps.data.filter((x) => (s.isAdmin && x.status === 'accepted') || (x.toStaffId === s.myStaffId && x.status === 'pending')).length;

  const b = s.school.billing || {};
  const left = daysLeft(b.accessUntil);
  let banner = null;
  if (!s.canWrite) {
    banner = <div className="banner bad no-print"><b>This workspace is read-only.</b> {b.status === 'trialing' ? 'Your free trial has ended.' : 'The subscription is not active.'} {s.isAdmin ? <Link to="/app/billing" className="btn sm">Choose a plan</Link> : 'Ask your administrator to renew.'}</div>;
  } else if (b.status === 'trialing' && left <= 7) {
    banner = <div className="banner warn no-print">Your free trial ends in {left} day{left === 1 ? '' : 's'}. {s.isAdmin && <Link to="/app/billing" className="btn sm brass">Choose a plan</Link>}</div>;
  } else if (b.status === 'past_due') {
    banner = <div className="banner warn no-print">We couldn’t process the last payment. {s.isAdmin && <Link to="/app/billing">Update your card</Link>}</div>;
  }

  if (demo.on) {
    const other = demo.persona === 'owner' ? 'teacher' : 'owner';
    banner = (
      <div className="banner demo no-print">
        <b>Live demo</b><span style={{ opacity: .8 }}>Sample school. Changes stay in this browser tab.</span>
        <span className="spacer" />
        <span className="small" style={{ opacity: .85 }}>Viewing as {demo.persona === 'owner' ? 'the principal (owner)' : 'a teacher'}</span>
        <button className="btn sm glass" onClick={() => { demo.setPersona(other); nav('/app'); }}>Switch to {other} view</button>
        <Link to="/register" className="btn sm light" onClick={() => demo.stop()}>Start free trial</Link>
      </div>
    );
  }

  const schools = Object.entries(s.profile?.schools || {});
  const title = TITLES[loc.pathname] || 'Staffboard';

  return (
    <div className="app">
      <aside className={'sidebar' + (open ? ' open' : '')} aria-label="App navigation">
        <div className="row between"><Brand to="/app" /><button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="x" /></button></div>
        {schools.length > 1 ? (
          <select className="school-switch" value={s.sid} onChange={(e) => s.switchSchool(e.target.value)} aria-label="Switch workspace">
            {schools.map(([id, x]) => <option key={id} value={id}>{x.name}</option>)}
          </select>
        ) : <div className="school-switch" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.school.name}</div>}
        {NAV.filter((g) => !g.admin || s.isAdmin).map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-label">{g.group}</div>
            {g.items.filter(([, , , feat]) => !feat || s.plan.features[feat]).map(([to, icon, label, , end]) => (
              <NavLink key={to} to={to} end={end} className="nav-link">
                <Icon name={icon} />{label}
                {to === '/app/swaps' && swapCount > 0 && <span className="count">{swapCount}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        {isPlatformOwner(user) && (
          <div className="nav-group">
            <div className="nav-label">Platform owner</div>
            <NavLink to="/app/platform" className="nav-link"><Icon name="chart" />MRR &amp; users</NavLink>
          </div>
        )}
        <div className="spacer" />
        <div className="nav-group">
          <NavLink to="/app/notifications" className="nav-link"><Icon name="bell" />Notifications{unread.data.length > 0 && <span className="count">{unread.data.length}</span>}</NavLink>
          <NavLink to="/app/account" className="nav-link"><Avatar name={s.member.name || user.email} size={20} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.member.name || user.email}</span></NavLink>
          {s.isOwner && s.school.type !== 'personal' && <NavLink to="/app/onboarding" className="nav-link"><Icon name="plus" />New school workspace</NavLink>}
          <button className="nav-link" style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%' }} onClick={async () => { await signOut(); nav('/'); }}><Icon name="logout" />Sign out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar no-print">
          <button className="icon-btn mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <h1>{title}</h1>
          <div className="spacer" />
          <span className="badge desktop-only">{s.role}</span>
          <Link to="/app/notifications" className="icon-btn" aria-label={`Notifications (${unread.data.length} unread)`} style={{ position: 'relative' }}>
            <Icon name="bell" />
            {unread.data.length > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 8, background: 'var(--pin)' }} />}
          </Link>
        </header>
        {banner}
        <div className="content page-enter" key={loc.pathname}>{children}</div>
      </div>
      <nav className="bottom-nav no-print" aria-label="Quick navigation">
        <NavLink to="/app" end><Icon name="home" />Today</NavLink>
        <NavLink to="/app/my-duties"><Icon name="user" />Mine</NavLink>
        <NavLink to="/app/roster"><Icon name="roster" />Roster</NavLink>
        <NavLink to="/app/calendar"><Icon name="calendar" />Calendar</NavLink>
        <button onClick={() => setOpen(true)}><Icon name="more" />More</button>
      </nav>
    </div>
  );
}
