import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection, orderBy, limit } from '../lib/data.js';
import { api } from '../lib/api.js';
import { Modal, Field, Empty, Icon, useAction, useConfirm } from '../components/ui.jsx';

export default function Announcements() {
  const s = useSchool();
  const list = useCollection(s.sid, 'announcements', [orderBy('createdAt', 'desc'), limit(100)]);
  const [edit, setEdit] = useState(null);
  const [run] = useAction();
  const [confirm, confirmNode] = useConfirm();
  const sorted = [...list.data].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  const del = async (a) => {
    if (await confirm({ title: 'Delete announcement?', message: `“${a.title}” will be removed for everyone.`, danger: true, confirmLabel: 'Delete' })) {
      run(() => s.write([{ type: 'delete', coll: 'announcements', id: a.id }], { action: 'announcement.delete', summary: `Deleted announcement “${a.title}”` }), 'Deleted');
    }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      {confirmNode}
      <div className="page-head">
        <h2>Announcements</h2>
        {s.isAdmin && <button className="btn sm" disabled={!s.canWrite} onClick={() => setEdit({ title: '', body: '', pinned: false })}><Icon name="plus" />New announcement</button>}
      </div>
      {sorted.length === 0 ? <div className="card"><Empty title="No announcements yet">{s.isAdmin ? 'Share notices with all staff. They appear on everyone’s dashboard and can be emailed.' : ''}</Empty></div>
        : sorted.map((a) => (
          <article key={a.id} className="card">
            <div className="card-head">
              <h3>{a.pinned && <span className="badge brass" style={{ marginRight: 8 }}>Pinned</span>}{a.title}</h3>
              {s.isAdmin && s.canWrite && <div className="row"><button className="icon-btn" aria-label="Edit" onClick={() => setEdit(a)}><Icon name="edit" /></button><button className="icon-btn" aria-label="Delete" onClick={() => del(a)}><Icon name="trash" /></button></div>}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>{a.body}</p>
            <div className="tiny muted">{a.authorName} · {a.createdAt?.toDate?.().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          </article>
        ))}
      {edit && <AnnouncementModal a={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AnnouncementModal({ a, onClose }) {
  const s = useSchool();
  const [f, setF] = useState(a);
  const [email, setEmail] = useState(!a.id);
  const [run, busy] = useAction();
  const save = () => run(async () => {
    if (!f.title.trim() || !f.body.trim()) throw new Error('Please add a title and message.');
    const data = { title: f.title.trim().slice(0, 140), body: f.body.trim().slice(0, 5000), pinned: Boolean(f.pinned) };
    let id = a.id;
    if (a.id) await s.write([{ type: 'update', coll: 'announcements', id: a.id, data }], { action: 'announcement.update', summary: `Edited announcement “${data.title}”` });
    else [id] = await s.write([{ type: 'set', coll: 'announcements', data: { ...data, authorUid: s.actor.uid, authorName: s.actor.name, createdAt: new Date() } }], { action: 'announcement.create', summary: `Posted announcement “${data.title}”` });
    if (email && s.plan.features.emailNotifications) await api('notify', { schoolId: s.sid, kind: 'announcement', announcementId: id }).catch(() => {});
    onClose();
  }, 'Announcement published');
  return (
    <Modal wide title={a.id ? 'Edit announcement' : 'New announcement'} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>{a.id ? 'Save' : 'Publish'}</button></>}>
      <div className="stack">
        <Field label="Title"><input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} /></Field>
        <Field label="Message"><textarea style={{ minHeight: 160 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} /></Field>
        <label className="check"><input type="checkbox" checked={Boolean(f.pinned)} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />Pin to the top</label>
        {s.plan.features.emailNotifications && <label className="check"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />Email all staff with accounts</label>}
      </div>
    </Modal>
  );
}
