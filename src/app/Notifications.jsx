import { Link } from 'react-router-dom';
import { where, orderBy, limit, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { useSchool } from '../context/SchoolContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCollection } from '../lib/data.js';
import { Empty, Icon, useAction } from '../components/ui.jsx';

export default function Notifications() {
  const s = useSchool();
  const { user } = useAuth();
  const list = useCollection(s.sid, 'notifications', [where('toUid', '==', user.uid), orderBy('createdAt', 'desc'), limit(100)], [user.uid]);
  const [run] = useAction();
  const unread = list.data.filter((n) => !n.read);
  const path = (id) => doc(db, 'schools', s.sid, 'notifications', id);

  const markAll = () => run(async () => {
    const b = writeBatch(db);
    unread.forEach((n) => b.update(path(n.id), { read: true }));
    await b.commit();
  });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <h2>Notifications</h2>
        <div className="row">
          {unread.length > 0 && <button className="btn secondary sm" onClick={markAll}>Mark all as read</button>}
          <Link to="/app/account" className="btn ghost sm"><Icon name="settings" />Email preferences</Link>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {list.error && <div className="error-box" style={{ margin: 16 }}>Notifications could not be loaded. If you just set up the project, deploy the Firestore indexes (see README).</div>}
        {list.data.length === 0 ? <Empty title="You’re all caught up" /> : list.data.map((n) => (
          <div key={n.id} className="row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', background: n.read ? undefined : 'var(--brass-tint)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <span className="dot" style={{ background: n.read ? 'transparent' : 'var(--pin)', marginTop: 6 }} />
            <Link to={n.link || '/app'} onClick={() => !n.read && updateDoc(path(n.id), { read: true })} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
              <b className="small">{n.title}</b>
              <div className="small muted">{n.body}</div>
              <div className="tiny muted">{n.createdAt?.toDate?.().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </Link>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => deleteDoc(path(n.id))}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
