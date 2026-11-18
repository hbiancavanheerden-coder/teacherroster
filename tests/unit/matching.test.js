import { describe, it, expect } from 'vitest';
import { matchStaff, matchByName, matchPeriod, normalize } from '../../src/lib/matching.js';
import { detectType, slimHtml } from '../../netlify/functions/import-upload.js';
import { EXTRACTION_SCHEMA } from '../../netlify/functions/_lib/extract.js';

const staff = [
  { id: 'a', name: 'Annette Botha' }, { id: 'b', name: 'Angé' }, { id: 'c', name: 'Nancy Mokoena' },
  { id: 'd', name: 'Pieter van Wyk' }, { id: 'e', name: 'Johan Botha' }, { id: 'f', name: 'Angela' },
];

describe('staff matching', () => {
  it('matches exact names, ignoring case, accents and titles', () => {
    expect(matchStaff('ANGE', staff)).toEqual({ id: 'b', how: 'exact' });
    expect(matchStaff('Mrs Nancy Mokoena', staff)).toEqual({ id: 'c', how: 'exact' });
  });
  it('matches unique first names, surnames and initials', () => {
    expect(matchStaff('Nancy', staff)).toEqual({ id: 'c', how: 'likely' });
    expect(matchStaff('Mnr van Wyk', staff).id).toBe('d');
    expect(matchStaff('A. Botha', staff)).toEqual({ id: 'a', how: 'likely' });
    expect(matchStaff('Juf. Mokoena', staff).id).toBe('c');
  });
  it('refuses to guess between two people', () => {
    expect(matchStaff('Mrs Botha', staff).id).toBeNull();
    expect(matchStaff('Botha', staff).id).toBeNull();
    expect(matchStaff('Thandi', staff).id).toBeNull();
  });
});

describe('duty point & period matching', () => {
  const cats = [{ id: 'c1', name: 'Morning Taxi' }, { id: 'c2', name: 'Back Gate 1' }];
  it('matches by name and containment', () => {
    expect(matchByName('morning taxi', cats)).toEqual({ id: 'c1', how: 'exact' });
    expect(matchByName('Taxi', cats)).toEqual({ id: 'c1', how: 'likely' });
    expect(matchByName('Tuck shop', cats).id).toBeNull();
  });
  it('matches periods by name or start time and skips breaks', () => {
    const periods = [{ name: 'Period 1', start: '08:00' }, { name: 'Break', start: '10:15', isBreak: true }, { name: 'Period 2', start: '08:45' }];
    expect(matchPeriod('Period 2', '', periods).id).toBe('2');
    expect(matchPeriod('P2', '08:45', periods).id).toBe('2');
    expect(matchPeriod('Break', '10:15', periods).id).toBeNull();
  });
  it('normalizes', () => expect(normalize('  Mev. Rezhané ')).toBe('mev rezhane'));
});

describe('import upload helpers', () => {
  it('detects supported file types', () => {
    expect(detectType('Roster.PDF', '')).toBe('pdf');
    expect(detectType('x.docx', '')).toBe('docx');
    expect(detectType('x.doc', '')).toBe('doc');
    expect(detectType('x.xlsx', '')).toBe('xlsx');
    expect(detectType('photo.jpg', 'image/jpeg')).toBe('image');
    expect(detectType('x.pages', '')).toBeNull();
  });
  it('slims Word HTML but keeps tables', () => {
    expect(slimHtml('<table class="x"><tr style="a"><td><strong>Mon</strong></td></tr></table>')).toBe('<table><tr><td>Mon</td></tr></table>');
  });
  it('schema is strict for structured outputs', () => {
    const walk = (s) => { if (s.type === 'object') { expect(s.additionalProperties).toBe(false); expect(s.required.sort()).toEqual(Object.keys(s.properties).sort()); Object.values(s.properties).forEach(walk); } if (s.type === 'array') walk(s.items); };
    walk(EXTRACTION_SCHEMA);
  });
});
