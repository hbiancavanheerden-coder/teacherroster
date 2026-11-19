#!/usr/bin/env node
// Imports an old single-file "Staff Duty Register" HTML (DUTIES + TERM_DATES arrays) into a StaffBoard workspace.
//
// Usage:
//   node --env-file=.env scripts/import-legacy.mjs <path/to/duty-roster.html> <schoolId> [--dry-run]
//
// Creates missing duty points and staff (matched by name), then adds every duty and term-date event.
// Safe to re-run: duties/events that already exist for the same date + duty point/title are skipped.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [file, schoolId, flag] = process.argv.slice(2);
if (!file || !schoolId) {
  console.error('Usage: node --env-file=.env scripts/import-legacy.mjs <file.html> <schoolId> [--dry-run]');
  process.exit(1);
}
const dry = flag === '--dry-run';
const html = readFileSync(file, 'utf8');
const grab = (name) => {
  const m = html.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\])(?:\\.sort|;?\\s*\\n)`));
  if (!m) throw new Error(`Could not find ${name} in ${file}`);
  return JSON.parse(m[1]);
};
const DUTIES = grab('DUTIES');
const TERM_DATES = grab('TERM_DATES');
const ROLES = grab('ROLES');

const classify = (label) => {
  const l = label.toLowerCase();
  if (l.includes('holiday')) return 'holiday';
  if (l.includes('exam') || l.includes('test') || l.includes('moderation')) return 'exam';
  if (l.includes('meeting')) return 'meeting';
  if (l.includes('sport') || l.includes('athletic') || l.includes('fun day')) return 'sport';
  if (l.includes('marks') || l.includes('in ') || l.includes('due')) return 'deadline';
  if (l.includes('school starts') || l.includes('last day')) return 'term';
  return 'activity';
};

initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
const db = getFirestore();
const school = db.collection('schools').doc(schoolId);
if (!(await school.get()).exists) throw new Error(`School ${schoolId} not found`);

const [catSnap, staffSnap, dutySnap, evSnap] = await Promise.all([
  school.collection('dutyCategories').get(), school.collection('staff').get(), school.collection('duties').get(), school.collection('events').get(),
]);
const catByName = Object.fromEntries(catSnap.docs.map((d) => [d.data().name.toLowerCase(), d.id]));
const staffByName = Object.fromEntries(staffSnap.docs.map((d) => [d.data().name.toLowerCase(), d.id]));
const dutyKeys = new Set(dutySnap.docs.map((d) => `${d.data().date}|${d.data().categoryId}|${d.data().staffId}`));
const evKeys = new Set(evSnap.docs.map((d) => `${d.data().start}|${d.data().title}`));

const writes = [];
let order = catSnap.size;
const catId = {};
for (const [key, label] of ROLES) {
  let id = catByName[label.toLowerCase()];
  if (!id) {
    const ref = school.collection('dutyCategories').doc();
    id = ref.id;
    writes.push([ref, { name: label, order: order++, staffNeeded: 1, days: [1, 2, 3, 4, 5], active: true, phase: 'all', color: '#20283D', startTime: '', endTime: '' }]);
  }
  catId[key] = id;
}
const staffId = (name) => {
  const k = name.trim().toLowerCase();
  if (!staffByName[k]) {
    const ref = school.collection('staff').doc();
    staffByName[k] = ref.id;
    writes.push([ref, { name: name.trim(), email: '', active: true, phase: 'all', excludedCategories: [], dutyWeight: 1, createdAt: FieldValue.serverTimestamp() }]);
  }
  return staffByName[k];
};
let duties = 0, events = 0;
for (const d of DUTIES) {
  for (const [key] of ROLES) {
    if (!d[key]) continue;
    const sid = staffId(d[key]);
    const k = `${d.date}|${catId[key]}|${sid}`;
    if (dutyKeys.has(k)) continue;
    dutyKeys.add(k);
    writes.push([school.collection('duties').doc(), { date: d.date, categoryId: catId[key], staffId: sid, note: '', imported: true }]);
    duties++;
  }
}
for (const t of TERM_DATES) {
  if (evKeys.has(`${t.start}|${t.label}`)) continue;
  writes.push([school.collection('events').doc(), { title: t.label, type: classify(t.label), phase: 'all', start: t.start, end: t.end || null, allDay: true, remindDaysBefore: 1, imported: true }]);
  events++;
}
console.log(`${dry ? '[dry run] ' : ''}${writes.length} writes: ${duties} duties, ${events} events, ${Object.keys(staffByName).length - staffSnap.size} new staff, ${order - catSnap.size} new duty points`);
if (!dry) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach(([ref, data]) => batch.set(ref, data));
    await batch.commit();
  }
  await school.collection('auditLogs').add({ actorUid: 'system', actorName: 'Import script', action: 'import.legacy', summary: `Imported ${duties} duties and ${events} events from ${file.split('/').pop()}`, at: FieldValue.serverTimestamp() });
  console.log('Done.');
}
