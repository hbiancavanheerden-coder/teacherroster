import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, query, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const col = (sid, name) => collection(db, 'schools', sid, name);
export const ref = (sid, name, id) => (id ? doc(db, 'schools', sid, name, id) : doc(col(sid, name)));

// Live collection subscription. `constraints` must be stable (memoise or build from primitive deps).
export function useCollection(sid, name, constraints = [], deps = []) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    if (!sid || !db) return undefined;
    setState((s) => ({ ...s, loading: true }));
    const q = query(col(sid, name), ...constraints);
    return onSnapshot(q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => { console.error(name, error); setState({ data: [], loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, name, ...deps]);
  return state;
}

export function useDoc(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!path || !db) { setState({ data: null, loading: false, error: null }); return undefined; }
    return onSnapshot(doc(db, ...path),
      (snap) => setState({ data: snap.exists() ? { id: snap.id, ...snap.data() } : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path ? path.join('/') : null, ...deps]);
  return state;
}

/**
 * Atomic write helper with audit trail.
 * ops: [{type:'set'|'update'|'delete', coll, id?, data?, raw?}]
 * Batches are chunked at 450 ops (Firestore limit is 500).
 */
export async function commit(sid, actor, ops, auditInfo) {
  const chunks = [];
  for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
  if (!chunks.length) chunks.push([]);
  const created = [];
  for (let c = 0; c < chunks.length; c++) {
    const batch = writeBatch(db);
    for (const op of chunks[c]) {
      const r = ref(sid, op.coll, op.id);
      // op.raw: write exactly the given fields (needed where security rules restrict which fields may change)
      const stamp = op.raw ? {} : { updatedAt: serverTimestamp() };
      if (op.type === 'set') { batch.set(r, { ...op.data, ...stamp }, op.merge ? { merge: true } : undefined); created.push(r.id); }
      else if (op.type === 'update') batch.update(r, { ...op.data, ...stamp });
      else if (op.type === 'delete') batch.delete(r);
    }
    if (auditInfo && c === 0) {
      batch.set(ref(sid, 'auditLogs'), {
        actorUid: actor.uid, actorName: actor.name || '', action: auditInfo.action, summary: auditInfo.summary,
        at: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return created;
}
