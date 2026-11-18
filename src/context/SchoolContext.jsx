import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useDoc, useCollection, commit, docUpdate, now } from '../lib/data.js';
import { effectivePlan, hasAccess } from '../config/plans.js';
import { todayISO } from '../lib/dates.js';

const Ctx = createContext(null);
export const SchoolCtx = Ctx; // exported for tests

export function SchoolProvider({ children }) {
  const { user } = useAuth();
  const profile = useDoc(user ? ['users', user.uid] : null);
  const sid = profile.data?.activeSchoolId || Object.keys(profile.data?.schools || {})[0] || null;
  const school = useDoc(sid ? ['schools', sid] : null);
  const member = useDoc(sid && user ? ['schools', sid, 'members', user.uid] : null);
  const staff = useCollection(member.data ? sid : null, 'staff');
  const categories = useCollection(member.data ? sid : null, 'dutyCategories');

  const value = useMemo(() => {
    const billing = school.data?.billing;
    const role = member.data?.role || null;
    const isAdmin = role === 'owner' || role === 'admin';
    const staffSorted = [...staff.data].sort((a, b) => a.name.localeCompare(b.name));
    const staffById = Object.fromEntries(staffSorted.map((s) => [s.id, s]));
    const cats = [...categories.data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const actor = { uid: user?.uid, name: member.data?.name || user?.displayName || user?.email };
    return {
      loading: profile.loading || (sid && (school.loading || member.loading)),
      profile: profile.data,
      sid,
      school: school.data,
      member: member.data,
      role,
      isAdmin,
      isOwner: role === 'owner',
      myStaffId: member.data?.staffId || null,
      staff: staffSorted,
      activeStaff: staffSorted.filter((s) => s.active !== false),
      staffById,
      categories: cats,
      activeCategories: cats.filter((c) => c.active !== false),
      catById: Object.fromEntries(cats.map((c) => [c.id, c])),
      plan: effectivePlan(billing),
      canWrite: hasAccess(billing),
      today: todayISO(school.data?.timezone || 'Africa/Johannesburg'),
      actor,
      // Atomic write + audit entry
      write: (ops, audit) => commit(sid, actor, ops, audit),
      switchSchool: (id) => docUpdate(['users', user.uid], { activeSchoolId: id, updatedAt: now() }),
    };
  }, [profile, school, member, staff, categories, sid, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSchool = () => useContext(Ctx);
