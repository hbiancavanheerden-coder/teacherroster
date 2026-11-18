// Matches names read from a document to existing staff, duty points and periods.
// Returns { id, how } where how is 'exact' | 'likely' | null, so the review screen can flag guesses.

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'mnr', 'mev', 'mej', 'me', 'juf', 'meneer', 'mevrou', 'juffrou', 'sir', 'madam', 'mx', 'rev', 'ds']);

export function normalize(s = '') {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // é -> e
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(name) {
  return normalize(name).split(/[\s-]+/).filter((t) => t && !TITLES.has(t));
}

export function matchStaff(raw, staff) {
  const t = tokens(raw);
  if (!t.length) return { id: null, how: null };
  const full = t.join(' ');
  const people = staff.map((s) => ({ s, t: tokens(s.name) }));

  const exact = people.filter((p) => p.t.join(' ') === full);
  if (exact.length === 1) return { id: exact[0].s.id, how: 'exact' };

  const unique = (list) => (list.length === 1 ? { id: list[0].s.id, how: 'likely' } : null);

  if (t.length === 1) {
    // "Nancy" or "Botha": a unique first name or surname
    const byFirst = people.filter((p) => p.t[0] === t[0]);
    const bySurname = people.filter((p) => p.t.length > 1 && p.t[p.t.length - 1] === t[0]);
    const combined = [...new Set([...byFirst, ...bySurname])];
    return unique(combined) || { id: null, how: null };
  }

  const first = t[0];
  const last = t[t.length - 1];
  // "A Botha" / "A. Botha": initial + surname
  if (first.length === 1) {
    const r = unique(people.filter((p) => p.t.length > 1 && p.t[0][0] === first && p.t[p.t.length - 1] === last));
    if (r) return r;
  }
  // first + surname ignoring middle names
  const r1 = unique(people.filter((p) => p.t.length > 1 && p.t[0] === first && p.t[p.t.length - 1] === last));
  if (r1) return r1;
  // surname only, when unique ("Mrs J Botha" with one Botha on staff)
  const r2 = unique(people.filter((p) => p.t[p.t.length - 1] === last));
  if (r2) return r2;
  return { id: null, how: null };
}

export function matchByName(raw, items) {
  const n = normalize(raw);
  if (!n) return { id: null, how: null };
  const exact = items.filter((i) => normalize(i.name) === n);
  if (exact.length === 1) return { id: exact[0].id, how: 'exact' };
  const contains = items.filter((i) => { const m = normalize(i.name); return m && (m.includes(n) || n.includes(m)); });
  if (contains.length === 1) return { id: contains[0].id, how: 'likely' };
  return { id: null, how: null };
}

// periods are stored as an array; the "id" is the index as a string
export function matchPeriod(name, startTime, periods) {
  const list = periods.map((p, i) => ({ ...p, id: String(i) })).filter((p) => !p.isBreak);
  const byName = matchByName(name, list);
  if (byName.id) return byName;
  if (startTime) {
    const byTime = list.filter((p) => p.start === startTime);
    if (byTime.length === 1) return { id: byTime[0].id, how: 'likely' };
  }
  return { id: null, how: null };
}
