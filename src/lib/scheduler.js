import { eachDay, isoWeekday, weekKey, addDays } from './dates.js';

// Deterministic PRNG so a given seed always produces the same roster.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isAbsent(absences, staffId, date) {
  return absences.some((a) => a.staffId === staffId && a.start <= date && (a.end || a.start) >= date && a.status !== 'cancelled');
}

/**
 * Builds a fair duty roster.
 *
 * @param {object} p
 * @param {string} p.start           first date (YYYY-MM-DD)
 * @param {string} p.end             last date
 * @param {Array}  p.categories      [{id, name, staffNeeded, days:[1..7], phase, active}]
 * @param {Array}  p.staff           [{id, name, active, phase, excludedCategories:[], maxPerWeek, dutyWeight}]
 * @param {Array}  p.absences        [{staffId, start, end}]
 * @param {Set}    p.closed          dates the school is closed
 * @param {Array}  p.existing        duties already in the period that must be kept [{date, categoryId, staffId}]
 * @param {object} p.priorLoad       {staffId: count} duties already done earlier this term (for balancing)
 * @param {object} p.options         {oneDutyPerDay, avoidConsecutive, seed}
 * @returns {{assignments: Array, unfilled: Array, load: object}}
 */
export function generateRoster(p) {
  const {
    start, end, categories, staff, absences = [], closed = new Set(),
    existing = [], priorLoad = {}, options = {},
  } = p;
  const opt = { oneDutyPerDay: true, avoidConsecutive: true, seed: 1, ...options };
  const rand = mulberry32(opt.seed);

  const activeStaff = staff.filter((s) => s.active !== false);
  const cats = categories.filter((c) => c.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const load = {};       // weighted total load
  const catLoad = {};    // per staff per category
  const weekLoad = {};   // per staff per week
  const byDate = {};     // date -> Set(staffId)
  for (const s of activeStaff) {
    load[s.id] = Number(priorLoad[s.id] || 0);
    catLoad[s.id] = {};
  }
  // Per-person "capacity" lets part-time staff carry a lighter load (dutyWeight 0.5 = half).
  const capacity = (s) => Math.max(0.1, Number(s.dutyWeight ?? 1));

  const note = (d) => {
    if (!load[d.staffId] && load[d.staffId] !== 0) return;
    load[d.staffId] += 1;
    catLoad[d.staffId][d.categoryId] = (catLoad[d.staffId][d.categoryId] || 0) + 1;
    const wk = weekKey(d.date);
    weekLoad[d.staffId + wk] = (weekLoad[d.staffId + wk] || 0) + 1;
    (byDate[d.date] ||= new Set()).add(d.staffId);
  };
  existing.forEach(note);

  const assignments = [];
  const unfilled = [];
  const days = eachDay(start, end).filter((d) => !closed.has(d));

  for (const date of days) {
    const wd = isoWeekday(date);
    const yesterday = byDate[addDays(date, -1)] || new Set();
    for (const cat of cats) {
      const days = cat.days && cat.days.length ? cat.days : [1, 2, 3, 4, 5];
      if (!days.includes(wd)) continue;
      const need = Math.max(1, Number(cat.staffNeeded) || 1);
      const already = existing.filter((e) => e.date === date && e.categoryId === cat.id).length;
      for (let slot = already; slot < need; slot++) {
        const taken = byDate[date] || new Set();
        const candidates = activeStaff.filter((s) => {
          if ((s.excludedCategories || []).includes(cat.id)) return false;
          if (cat.phase && cat.phase !== 'all' && s.phase && s.phase !== 'all' && s.phase !== cat.phase) return false;
          if (isAbsent(absences, s.id, date)) return false;
          if (taken.has(s.id) && (opt.oneDutyPerDay || assignments.some((a) => a.date === date && a.categoryId === cat.id && a.staffId === s.id))) return false;
          const max = Number(s.maxPerWeek) || 0;
          if (max && (weekLoad[s.id + weekKey(date)] || 0) >= max) return false;
          return true;
        });
        if (!candidates.length) {
          unfilled.push({ date, categoryId: cat.id, reason: 'No eligible staff (absent, at weekly limit or excluded)' });
          continue;
        }
        let best = null;
        let bestScore = Infinity;
        for (const s of candidates) {
          let score = (load[s.id] / capacity(s)) * 10;
          score += (catLoad[s.id][cat.id] || 0) * 3;
          if (opt.avoidConsecutive && yesterday.has(s.id)) score += 6;
          score += rand(); // tie-break
          if (score < bestScore) { bestScore = score; best = s; }
        }
        const a = { date, categoryId: cat.id, staffId: best.id };
        assignments.push(a);
        note(a);
      }
    }
  }
  return { assignments, unfilled, load };
}

// Summary used for the fairness readout in the UI and tests.
export function loadSpread(load, staffIds) {
  const vals = staffIds.map((id) => load[id] || 0);
  if (!vals.length) return { min: 0, max: 0, spread: 0 };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return { min, max, spread: max - min };
}

// Suggest substitutes for a duty: available staff with the lowest load that day/term.
export function suggestSubstitutes({ date, categoryId, staff, duties, absences, limit = 5 }) {
  const counts = {};
  duties.forEach((d) => { counts[d.staffId] = (counts[d.staffId] || 0) + 1; });
  const busy = new Set(duties.filter((d) => d.date === date).map((d) => d.staffId));
  return staff
    .filter((s) => s.active !== false)
    .filter((s) => !(s.excludedCategories || []).includes(categoryId))
    .filter((s) => !isAbsent(absences, s.id, date))
    .filter((s) => !busy.has(s.id))
    .map((s) => ({ ...s, load: counts[s.id] || 0 }))
    .sort((a, b) => a.load - b.load || a.name.localeCompare(b.name))
    .slice(0, limit);
}
