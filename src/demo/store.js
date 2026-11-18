// In-browser store for the live demo (/demo). Nothing here touches Firebase or leaves the browser.
// Changes made in the demo live only in this tab and reset when it closes.

const KEY = 'sb-demo';
const listeners = new Set();
let seedFn = null;

export const ts = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return { toDate: () => date, toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000) };
};
const val = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : v);
const wrap = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Date ? ts(v) : v]));

function readFlag() {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export const demo = {
  on: typeof window !== 'undefined' && Boolean(readFlag()),
  persona: (typeof window !== 'undefined' && readFlag()) || 'owner',
  state: null,

  registerSeed(fn) { seedFn = fn; },
  start(persona = 'owner') {
    try { sessionStorage.setItem(KEY, persona); } catch { /* private mode: demo still works for this page */ }
    this.on = true;
    this.persona = persona;
    this.notify();
  },
  setPersona(persona) { this.start(persona); },
  stop() {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    this.on = false;
    this.state = null;
    this.notify();
  },
  ensure() {
    if (!this.state && seedFn) this.state = seedFn();
    return this.state;
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  notify() { listeners.forEach((fn) => fn()); },

  query(name, constraints = []) {
    const s = this.ensure();
    let list = [...(s.cols[name] || [])];
    for (const c of constraints) {
      if (c.k !== 'where') continue;
      list = list.filter((d) => {
        const a = val(d[c.f]); const b = val(c.v);
        switch (c.op) {
          case '==': return a === b;
          case '!=': return a !== b;
          case '>=': return a >= b;
          case '<=': return a <= b;
          case '>': return a > b;
          case '<': return a < b;
          case 'in': return c.v.includes(a);
          default: return true;
        }
      });
    }
    const order = constraints.filter((c) => c.k === 'orderBy');
    if (order.length) {
      list.sort((x, y) => {
        for (const o of order) {
          const a = val(x[o.f]); const b = val(y[o.f]);
          if (a === b) continue;
          const r = a > b ? 1 : -1;
          return o.dir === 'desc' ? -r : r;
        }
        return 0;
      });
    }
    const lim = constraints.find((c) => c.k === 'limit');
    return (lim ? list.slice(0, lim.n) : list).map((d) => ({ ...d }));
  },

  getDoc(path) {
    const s = this.ensure();
    if (path[0] === 'users') return s.users[path[1]] ? { id: path[1], ...s.users[path[1]] } : null;
    if (path[0] === 'schools' && path.length === 2) return { id: path[1], ...s.school };
    if (path[0] === 'schools' && path.length === 4) {
      const d = (s.cols[path[2]] || []).find((x) => x.id === path[3]);
      return d ? { ...d } : null;
    }
    return null;
  },

  updateDoc(path, data, create = false) {
    const s = this.ensure();
    const apply = (obj) => {
      for (const [k, v] of Object.entries(wrap(data))) {
        if (k.includes('.')) {
          const parts = k.split('.');
          let o = obj;
          parts.slice(0, -1).forEach((p) => { o[p] = { ...(o[p] || {}) }; o = o[p]; });
          o[parts[parts.length - 1]] = v;
        } else if (v && typeof v === 'object' && !Array.isArray(v) && !v.toMillis && obj[k] && typeof obj[k] === 'object') {
          obj[k] = { ...obj[k], ...v };
        } else obj[k] = v;
      }
    };
    if (path[0] === 'users') { s.users[path[1]] ||= {}; apply(s.users[path[1]]); }
    else if (path[0] === 'schools' && path.length === 2) { s.school = { ...s.school }; apply(s.school); }
    else if (path[0] === 'schools' && path.length === 4) {
      const list = (s.cols[path[2]] ||= []);
      let d = list.find((x) => x.id === path[3]);
      if (!d && create) { d = { id: path[3] }; list.push(d); }
      if (d) apply(d);
      s.cols[path[2]] = [...list];
    }
    this.notify();
  },

  deleteDoc(path) {
    const s = this.ensure();
    if (path.length === 4) s.cols[path[2]] = (s.cols[path[2]] || []).filter((x) => x.id !== path[3]);
    this.notify();
  },

  commit(ops, actor, audit) {
    const s = this.ensure();
    const created = [];
    const stamp = { updatedAt: ts(new Date()) };
    for (const op of ops) {
      const list = (s.cols[op.coll] ||= []);
      if (op.type === 'set') {
        const id = op.id || 'd' + Math.random().toString(36).slice(2, 10);
        const i = list.findIndex((x) => x.id === id);
        const doc = { id, ...wrap(op.data), ...(op.raw ? {} : stamp) };
        if (i >= 0) list[i] = op.merge ? { ...list[i], ...doc } : doc; else list.push(doc);
        created.push(id);
      } else if (op.type === 'update') {
        const d = list.find((x) => x.id === op.id);
        if (d) Object.assign(d, wrap(op.data), op.raw ? {} : stamp);
      } else if (op.type === 'delete') {
        s.cols[op.coll] = list.filter((x) => x.id !== op.id);
      }
      s.cols[op.coll] = [...(s.cols[op.coll] || [])];
    }
    if (audit) {
      (s.cols.auditLogs ||= []).unshift({ id: 'a' + Date.now(), actorUid: actor.uid, actorName: actor.name || '', action: audit.action, summary: audit.summary, at: ts(new Date()) });
      s.cols.auditLogs = [...s.cols.auditLogs];
    }
    this.notify();
    return Promise.resolve(created);
  },
};
