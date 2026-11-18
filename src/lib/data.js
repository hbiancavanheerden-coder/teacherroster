// Data layer. Pages talk to Firestore only through these helpers, which lets the
// same pages run against the in-browser demo store (src/demo) when demo mode is on.
import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, query, writeBatch, serverTimestamp, getDocs,
  where as fsWhere, orderBy as fsOrderBy, limit as fsLimit,
  updateDoc, setDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { demo } from '../demo/store.js';

export const col = (sid, name) => collection(db, 'schools', sid, name);

let idSeq = 0;
const demoId = () => 'd' + Date.now().toString(36) + (idSeq++).toString(36);
// Returns an object with an `.id` (a new or existing document id).
export const ref = (sid, name, id) => {
  if (demo.on) return { id: id || demoId() };
  return id ? doc(db, 'schools', sid, name, id) : doc(col(sid, name));
};

// ---- query constraints as plain descriptors (work for Firestore and the demo store) ----
export const where = (f, op, v) => ({ k: 'where', f, op, v });
export const orderBy = (f, dir = 'asc') => ({ k: 'orderBy', f, dir });
export const limit = (n) => ({ k: 'limit', n });
const toFs = (c) => (c.k === 'where' ? fsWhere(c.f, c.op, c.v) : c.k === 'orderBy' ? fsOrderBy(c.f, c.dir) : fsLimit(c.n));

// Live collection subscription. Pass primitive deps for anything the constraints depend on.
export function useCollection(sid, name, constraints = [], deps = []) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    if (!sid) return undefined;
    if (demo.on) {
      const run = () => setState({ data: demo.query(name, constraints), loading: false, error: null });
      run();
      return demo.subscribe(run);
    }
    if (!db) return undefined;
    setState((s) => ({ ...s, loading: true }));
    const q = query(col(sid, name), ...constraints.map(toFs));
    return onSnapshot(q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => { console.error(name, error); setState({ data: [], loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, name, ...deps]);
  return state;
}

// One-off read (used by import and auto-schedule).
export async function fetchCollection(sid, name, constraints = []) {
  if (demo.on) return demo.query(name, constraints);
  const snap = await getDocs(query(col(sid, name), ...constraints.map(toFs)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function useDoc(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = path ? path.join('/') : null;
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null }); return undefined; }
    if (demo.on) {
      const run = () => setState({ data: demo.getDoc(path), loading: false, error: null });
      run();
      return demo.subscribe(run);
    }
    if (!db) { setState({ data: null, loading: false, error: null }); return undefined; }
    return onSnapshot(doc(db, ...path),
      (snap) => setState({ data: snap.exists() ? { id: snap.id, ...snap.data() } : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
  return state;
}

// Single-document writes by path, e.g. ['schools', sid] or ['schools', sid, 'notifications', id].
export async function docUpdate(path, data) {
  if (demo.on) return demo.updateDoc(path, data);
  return updateDoc(doc(db, ...path), data);
}
export async function docSet(path, data, merge = true) {
  if (demo.on) return demo.updateDoc(path, data, true);
  return setDoc(doc(db, ...path), data, merge ? { merge: true } : undefined);
}
export async function docDelete(path) {
  if (demo.on) return demo.deleteDoc(path);
  return deleteDoc(doc(db, ...path));
}
export const now = () => (demo.on ? new Date() : serverTimestamp());

/**
 * Atomic write helper with audit trail.
 * ops: [{type:'set'|'update'|'delete', coll, id?, data?, raw?}]
 * Batches are chunked at 450 ops (Firestore limit is 500).
 */
export async function commit(sid, actor, ops, auditInfo) {
  if (demo.on) return demo.commit(ops, actor, auditInfo);
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
