// RFC 4180-ish CSV parse/serialise without dependencies.

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

const HEADER_ALIASES = {
  name: ['name', 'full name', 'teacher', 'staff', 'staff name', 'first name'],
  surname: ['surname', 'last name'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'cell', 'mobile', 'cellphone'],
  department: ['department', 'dept', 'subject', 'subjects'],
  grades: ['grade', 'grades', 'class', 'classes'],
  phase: ['phase'],
  position: ['role', 'position', 'post'],
};

// Turns rows (first row = headers) into staff objects + per-row errors.
export function rowsToStaff(rows) {
  if (!rows.length) return { staff: [], errors: ['The file is empty.'] };
  const header = rows[0].map((h) => String(h ?? '').trim().toLowerCase());
  const col = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) col[key] = idx;
  }
  if (col.name === undefined) return { staff: [], errors: ['Could not find a "Name" column. Use the template headers: Name, Surname, Email, Phone, Department, Grades, Phase, Position.'] };
  const staff = [];
  const errors = [];
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  rows.slice(1).forEach((r, i) => {
    const get = (k) => (col[k] !== undefined ? String(r[col[k]] ?? '').trim() : '');
    const name = [get('name'), get('surname')].filter(Boolean).join(' ');
    if (!name) return;
    const email = get('email').toLowerCase();
    if (email && !emailRe.test(email)) errors.push(`Row ${i + 2}: "${email}" is not a valid email (row imported without email).`);
    let phase = get('phase').toLowerCase();
    if (phase.startsWith('found')) phase = 'foundation';
    else if (phase.startsWith('inter')) phase = 'intermediate';
    else if (phase.startsWith('sen')) phase = 'senior';
    else phase = 'all';
    staff.push({
      name,
      email: emailRe.test(email) ? email : '',
      phone: get('phone'),
      department: get('department'),
      grades: get('grades'),
      phase,
      position: get('position'),
    });
  });
  return { staff, errors };
}

export function toCSV(rows) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}

export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
