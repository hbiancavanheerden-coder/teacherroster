import { describe, it, expect } from 'vitest';
import { canShare } from '../../netlify/functions/_lib/core.js';
import { proposalText } from '../../netlify/functions/upgrade.js';
import { PLANS } from '../../src/config/plans.js';

const ts = (ms) => ({ toMillis: () => ms });
const future = ts(Date.now() + 86400000);
const past = ts(Date.now() - 1000);

describe('Teacher vs School sharing', () => {
  it('only School plan or trial can share with colleagues', () => {
    expect(PLANS.solo.features.publicRoster).toBe(false);
    expect(PLANS.school.features.publicRoster).toBe(true);
    expect(canShare({ billing: { plan: 'solo', status: 'active', accessUntil: future } })).toBe(false);
    expect(canShare({ billing: { plan: 'school', status: 'active', accessUntil: future } })).toBe(true);
    expect(canShare({ billing: { plan: 'solo', status: 'trialing', accessUntil: future } })).toBe(true);
    expect(canShare({ billing: { plan: 'school', status: 'active', accessUntil: past } })).toBe(false);
  });
});

describe('principal proposal', () => {
  it('states the School price and includes the teacher’s note', () => {
    const p = proposalText({ schoolName: 'Laerskool Sonskyn', teacher: 'Mrs Botha', staffCount: 40, dutyCount: 600, note: 'Please!' });
    expect(p.subject).toBe('Mrs Botha recommends StaffBoard for Laerskool Sonskyn');
    expect(p.price).toContain(`R${PLANS.school.monthly}/month`);
    expect(p.points.join(' ')).toMatch(/about \d+ hours a term/);
    expect(p.note).toBe('Please!');
  });
});
