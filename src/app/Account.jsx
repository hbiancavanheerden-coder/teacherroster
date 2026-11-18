import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSchool } from '../context/SchoolContext.jsx';
import { useDoc } from '../lib/data.js';
import { api } from '../lib/api.js';
import { Field, useAction, useConfirm } from '../components/ui.jsx';

const PREFS = [
  ['duties', 'When my duties are assigned or changed'],
  ['digest', 'Morning digest on days I’m on duty, and event reminders'],
  ['swaps', 'Swap requests and responses'],
  ['announcements', 'School announcements'],
];

export default function Account({ bare }) {
  const { user, signOut } = useAuth();
  const school = useSchool();
  const profile = useDoc(['users', user.uid]);
  const nav = useNavigate();
  const [name, setName] = useState(user.displayName || '');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [run, busy] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const prefs = { duties: true, digest: true, swaps: true, announcements: true, ...(profile.data?.prefs?.email || {}) };
  const isPasswordUser = user.providerData.some((p) => p.providerId === 'password');
  const userRef = () => doc(db, 'users', user.uid);

  const saveName = () => run(async () => {
    if (!name.trim()) throw new Error('Please enter your name.');
    await updateProfile(user, { displayName: name.trim() });
    await setDoc(userRef(), { displayName: name.trim(), updatedAt: serverTimestamp(), ...(profile.data ? {} : { email: user.email }) }, { merge: true });
  }, 'Name updated');

  const setPref = (k, v) => run(() => setDoc(userRef(), { prefs: { email: { ...prefs, [k]: v } }, updatedAt: serverTimestamp(), ...(profile.data ? {} : { email: user.email }) }, { merge: true }), 'Preferences saved');

  const changePw = () => run(async () => {
    if (pw.next.length < 8) throw new Error('Use at least 8 characters.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw.current));
    await updatePassword(user, pw.next);
    setPw({ current: '', next: '' });
  }, 'Password changed');

  const leave = async () => {
    if (await confirm({ title: `Leave ${school.school.name}?`, message: 'You will lose access to this workspace until you are invited again.', danger: true, confirmLabel: 'Leave' })) {
      run(async () => { await api('account', { action: 'leave', schoolId: school.sid }); nav('/app'); }, 'You left the workspace');
    }
  };
  const deleteAccount = async () => {
    if (await confirm({ title: 'Delete your account permanently?', message: 'Your login and profile are deleted. Workspaces you own alone are scheduled for deletion. This cannot be undone.', danger: true, confirmLabel: 'Delete my account' })) {
      run(async () => { await api('account', { action: 'delete-account' }); await signOut(); nav('/'); }, 'Account deleted');
    }
  };

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 720, margin: bare ? '40px auto' : undefined, padding: bare ? '0 16px' : undefined }}>
      {confirmNode}
      <div className="card">
        <h3>Profile</h3>
        <div className="stack">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="small">Email: <b>{user.email}</b> {user.emailVerified ? <span className="badge green">verified</span> : <button className="btn ghost sm" onClick={() => run(() => sendEmailVerification(user), 'Verification email sent')}>Send verification email</button>}</div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={saveName}>Save</button>
        </div>
      </div>

      {isPasswordUser && (
        <div className="card">
          <h3>Change password</h3>
          <div className="form-grid">
            <Field label="Current password"><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          </div>
          <button className="btn mt" disabled={busy || !pw.current || !pw.next} onClick={changePw}>Change password</button>
        </div>
      )}

      <div className="card">
        <h3>Email notifications</h3>
        <p className="small muted">In-app notifications are always on. Choose which emails you get{school?.plan && !school.plan.features.emailNotifications ? ' (email notifications are part of the School plan)' : ''}.</p>
        {PREFS.map(([k, label]) => (
          <label key={k} className="check" style={{ padding: '6px 0' }}><input type="checkbox" checked={prefs[k] !== false} onChange={(e) => setPref(k, e.target.checked)} />{label}</label>
        ))}
      </div>

      <div className="card">
        <h3>Workspace & data</h3>
        <div className="stack">
          {school?.sid && school.role !== 'owner' && <div className="row between"><span className="small">Leave <b>{school.school?.name}</b></span><button className="btn secondary sm" onClick={leave}>Leave workspace</button></div>}
          <div className="row between"><span className="small">Delete your login and personal profile (POPIA)</span><button className="btn danger sm" onClick={deleteAccount}>Delete account</button></div>
          <p className="tiny muted" style={{ margin: 0 }}>Administrators can export staff, rosters, calendars and the audit log as CSV/PDF from each page.</p>
        </div>
      </div>
    </div>
  );
}
