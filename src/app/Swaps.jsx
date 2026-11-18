import { useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import { useSchool } from '../context/SchoolContext.jsx';
import { useCollection } from '../lib/data.js';
import { fmtMed } from '../lib/dates.js';
import { api } from '../lib/api.js';
import { Empty, useAction } from '../components/ui.jsx';

const STATUS = { pending: ['Waiting for colleague', 'brass'], accepted: ['Waiting for approval', 'blue'], declined: ['Declined', ''], approved: ['Approved', 'green'], rejected: ['Not approved', 'red'], cancelled: ['Cancelled', ''] };

export default function Swaps() {
  const s = useSchool();
  const swaps = useCollection(s.sid, 'swapRequests', [orderBy('date', 'desc')]);
  const [tab, setTab] = useState('open');
  const [run, busy] = useAction();

  if (!s.plan.features.swaps) {
    return <div className="card"><Empty title="Duty swaps are part of the School plan" action={s.isAdmin && <Link to="/app/billing" className="btn">See plans</Link>}>Teachers request swaps, colleagues accept, and administrators approve. The roster updates and everyone is notified.</Empty></div>;
  }

  const notify = (id) => api('notify', { schoolId: s.sid, kind: 'swap', swapId: id }).catch(() => {});
  const respond = (x, status) => run(async () => {
    await s.write([{ type: 'update', coll: 'swapRequests', id: x.id, data: { status, respondedAt: new Date() }, raw: true }],
      { action: `swap.${status}`, summary: `${s.member.name} ${status} a swap of ${s.catById[x.categoryId]?.name} on ${fmtMed(x.date)}` });
    notify(x.id);
  }, 'Done');
  const decide = (x, approve) => run(async () => {
    const ops = [{ type: 'update', coll: 'swapRequests', id: x.id, data: { status: approve ? 'approved' : 'rejected', decidedBy: s.actor.uid } }];
    if (approve) ops.push({ type: 'update', coll: 'duties', id: x.dutyId, data: { staffId: x.toStaffId, note: `Swapped from ${s.staffById[x.fromStaffId]?.name}` } });
    await s.write(ops, { action: approve ? 'swap.approve' : 'swap.reject', summary: `${approve ? 'Approved' : 'Rejected'} swap: ${s.catById[x.categoryId]?.name} on ${fmtMed(x.date)} from ${s.staffById[x.fromStaffId]?.name} to ${s.staffById[x.toStaffId]?.name}` });
    notify(x.id);
  }, approve ? 'Swap approved, roster updated' : 'Swap rejected');

  const open = swaps.data.filter((x) => ['pending', 'accepted'].includes(x.status) && x.date >= s.today);
  const list = (tab === 'open' ? open : swaps.data.filter((x) => !open.includes(x)))
    .filter((x) => s.isAdmin || [x.fromStaffId, x.toStaffId].includes(s.myStaffId));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h2>Duty swaps</h2><p className="muted small" style={{ margin: 0 }}>To request a swap, tap one of your duties on the <Link to="/app/roster">roster</Link>.</p></div>
        <div className="tabs"><button className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>Open ({open.length})</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {list.length === 0 ? <Empty title={tab === 'open' ? 'No open swap requests' : 'No history yet'} /> : list.map((x) => {
          const [label, tone] = STATUS[x.status] || [x.status, ''];
          const forMe = x.toStaffId === s.myStaffId && x.status === 'pending';
          const mine = x.createdBy === s.actor.uid && ['pending', 'accepted'].includes(x.status);
          return (
            <div key={x.id} className="row" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <b>{s.catById[x.categoryId]?.name}</b> <span className="mono small">· {fmtMed(x.date)}</span>
                <div className="small">{s.staffById[x.fromStaffId]?.name} → {s.staffById[x.toStaffId]?.name}</div>
                {x.message && <div className="tiny muted">“{x.message}”</div>}
              </div>
              <span className={'badge ' + tone}>{label}</span>
              {s.canWrite && forMe && <><button className="btn sm" disabled={busy} onClick={() => respond(x, 'accepted')}>Accept</button><button className="btn sm secondary" disabled={busy} onClick={() => respond(x, 'declined')}>Decline</button></>}
              {s.canWrite && s.isAdmin && ['pending', 'accepted'].includes(x.status) && <><button className="btn sm" disabled={busy} onClick={() => decide(x, true)}>Approve</button><button className="btn sm secondary" disabled={busy} onClick={() => decide(x, false)}>Reject</button></>}
              {s.canWrite && mine && !s.isAdmin && <button className="btn sm ghost" disabled={busy} onClick={() => respond(x, 'cancelled')}>Withdraw</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
