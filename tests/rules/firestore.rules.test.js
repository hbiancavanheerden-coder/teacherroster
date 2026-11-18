// Security-rule tests. Run with: npm run test:rules  (needs Java + firebase-tools; see README)
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';

let env;
const future = Timestamp.fromMillis(Date.now() + 86400000);
const past = Timestamp.fromMillis(Date.now() - 86400000);
const features = { invites: true, swaps: true, timetable: true, absences: true, auditLog: true, emailNotifications: true, publicRoster: true };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'staffboard-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'schools/A'), { name: 'A', billing: { status: 'active', plan: 'school', accessUntil: future, features } });
    await setDoc(doc(db, 'schools/B'), { name: 'B', billing: { status: 'active', plan: 'school', accessUntil: future, features } });
    await setDoc(doc(db, 'schools/X'), { name: 'Expired', billing: { status: 'trialing', plan: 'school', accessUntil: past, features } });
    await setDoc(doc(db, 'schools/A/members/admin'), { role: 'admin', staffId: 'st_admin' });
    await setDoc(doc(db, 'schools/A/members/owner'), { role: 'owner', staffId: 'st_owner' });
    await setDoc(doc(db, 'schools/A/members/teacher'), { role: 'teacher', staffId: 'st_teacher' });
    await setDoc(doc(db, 'schools/A/members/t2'), { role: 'teacher', staffId: 'st_t2' });
    await setDoc(doc(db, 'schools/X/members/admin'), { role: 'admin', staffId: 's' });
    await setDoc(doc(db, 'schools/A/duties/d1'), { date: '2026-10-06', categoryId: 'c', staffId: 'st_teacher' });
    await setDoc(doc(db, 'schools/A/notifications/n1'), { toUid: 'teacher', read: false, title: 't' });
    await setDoc(doc(db, 'users/teacher'), { email: 't@x', schools: { A: { role: 'teacher' } } });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

describe('tenant isolation', () => {
  it('members read their school; outsiders and anonymous cannot', async () => {
    await assertSucceeds(getDoc(doc(as('teacher'), 'schools/A/duties/d1')));
    await assertFails(getDoc(doc(as('teacher'), 'schools/B')));
    await assertFails(getDoc(doc(as('stranger'), 'schools/A/duties/d1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'schools/A')));
  });
  it('server-only collections are closed', async () => {
    await assertFails(getDoc(doc(as('admin'), 'links/abc')));
    await assertFails(setDoc(doc(as('admin'), 'invites/abc'), { schoolId: 'A' }));
    await assertFails(setDoc(doc(as('admin'), 'schools/new'), { name: 'n' }));
  });
});

describe('roles and billing', () => {
  it('admins write rosters, teachers cannot', async () => {
    await assertSucceeds(setDoc(doc(as('admin'), 'schools/A/duties/d2'), { date: '2026-10-07', categoryId: 'c', staffId: 'x' }));
    await assertFails(setDoc(doc(as('teacher'), 'schools/A/duties/d3'), { date: '2026-10-07', categoryId: 'c', staffId: 'x' }));
    await assertFails(updateDoc(doc(as('teacher'), 'schools/A/duties/d1'), { staffId: 'st_t2' }));
  });
  it('expired workspaces are read-only', async () => {
    await assertSucceeds(getDoc(doc(as('admin'), 'schools/X')));
    await assertFails(setDoc(doc(as('admin'), 'schools/X/duties/d'), { date: '2026-10-07' }));
  });
  it('nobody can change billing from the client', async () => {
    await assertFails(updateDoc(doc(as('admin'), 'schools/A'), { 'billing.accessUntil': Timestamp.fromMillis(Date.now() + 1e12) }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'schools/A'), { name: 'Renamed' }));
  });
  it('teachers cannot promote themselves; admins cannot touch the owner', async () => {
    await assertFails(updateDoc(doc(as('teacher'), 'schools/A/members/teacher'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as('admin'), 'schools/A/members/owner'), { role: 'teacher' }));
    await assertFails(updateDoc(doc(as('admin'), 'schools/A/members/teacher'), { role: 'owner' }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'schools/A/members/teacher'), { role: 'admin' }));
    await assertFails(setDoc(doc(as('stranger'), 'schools/A/members/stranger'), { role: 'admin' }));
  });
  it('users cannot grant themselves memberships via their profile', async () => {
    await assertFails(updateDoc(doc(as('teacher'), 'users/teacher'), { schools: { B: { role: 'owner' } } }));
    await assertFails(updateDoc(doc(as('teacher'), 'users/teacher'), { activeSchoolId: 'B' }));
    await assertSucceeds(updateDoc(doc(as('teacher'), 'users/teacher'), { displayName: 'T', activeSchoolId: 'A' }));
  });
});

describe('teacher self-service', () => {
  it('teachers report only their own absence', async () => {
    const base = { start: '2026-10-07', end: '2026-10-07', status: 'reported', createdBy: 'teacher' };
    await assertSucceeds(addDoc(collection(as('teacher'), 'schools/A/absences'), { ...base, staffId: 'st_teacher' }));
    await assertFails(addDoc(collection(as('teacher'), 'schools/A/absences'), { ...base, staffId: 'st_t2' }));
    await assertFails(addDoc(collection(as('teacher'), 'schools/A/absences'), { ...base, staffId: 'st_teacher', status: 'approved' }));
  });
  it('swap flow: own duty only, target accepts, only admin approves', async () => {
    const ref = doc(as('teacher'), 'schools/A/swapRequests/s1');
    await assertFails(setDoc(doc(as('t2'), 'schools/A/swapRequests/s0'), { dutyId: 'd1', fromStaffId: 'st_t2', toStaffId: 'st_teacher', status: 'pending', createdBy: 't2' }));
    await assertSucceeds(setDoc(ref, { dutyId: 'd1', fromStaffId: 'st_teacher', toStaffId: 'st_t2', status: 'pending', createdBy: 'teacher' }));
    await assertFails(updateDoc(doc(as('teacher'), 'schools/A/swapRequests/s1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as('t2'), 'schools/A/swapRequests/s1'), { status: 'accepted', respondedAt: new Date() }));
    await assertFails(updateDoc(doc(as('t2'), 'schools/A/swapRequests/s1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as('admin'), 'schools/A/swapRequests/s1'), { status: 'approved' }));
  });
  it('notifications are private and only the read flag can change', async () => {
    await assertSucceeds(updateDoc(doc(as('teacher'), 'schools/A/notifications/n1'), { read: true }));
    await assertFails(updateDoc(doc(as('teacher'), 'schools/A/notifications/n1'), { title: 'x' }));
    await assertFails(getDoc(doc(as('t2'), 'schools/A/notifications/n1')));
    await assertFails(addDoc(collection(as('admin'), 'schools/A/notifications'), { toUid: 'teacher' }));
  });
  it('audit log is append-only and cannot be forged', async () => {
    const col = collection(as('teacher'), 'schools/A/auditLogs');
    await assertSucceeds(addDoc(col, { actorUid: 'teacher', at: serverTimestamp(), action: 'x', summary: 'y' }));
    await assertFails(addDoc(col, { actorUid: 'admin', at: serverTimestamp(), action: 'x', summary: 'y' }));
    await assertFails(addDoc(col, { actorUid: 'teacher', at: Timestamp.fromMillis(0), action: 'x', summary: 'y' }));
    await assertFails(getDoc(doc(as('teacher'), 'schools/A/auditLogs/any')));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'schools/A/auditLogs/l1'), { actorUid: 'admin' }));
    await assertFails(deleteDoc(doc(as('admin'), 'schools/A/auditLogs/l1')));
  });
});
