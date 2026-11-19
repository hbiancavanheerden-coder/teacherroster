import { describe, it, expect } from 'vitest';
import { validSubscription, subId } from '../../netlify/functions/_lib/push.js';
import { buildDigest } from '../../netlify/functions/daily-digest.js';
import manifest from '../../netlify/functions/manifest.js';

const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };

describe('push subscriptions', () => {
  it('accepts real push services only', () => {
    expect(validSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys })).toBe(true);
    expect(validSubscription({ endpoint: 'https://web.push.apple.com/QGuQ', keys })).toBe(true);
    expect(validSubscription({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys })).toBe(true);
    expect(validSubscription({ endpoint: 'https://evil.example.com/hook', keys })).toBe(false);
    expect(validSubscription({ endpoint: 'http://fcm.googleapis.com/x', keys })).toBe(false);
    expect(validSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: {} })).toBe(false);
  });
  it('derives stable ids from endpoints', () => {
    expect(subId('https://a')).toBe(subId('https://a'));
    expect(subId('https://a')).not.toBe(subId('https://b'));
  });
});

describe('morning digest', () => {
  const categories = [{ id: 'c1', name: 'Front gate', startTime: '07:00', endTime: '07:45' }];
  const events = [
    { id: 'e1', title: 'Parents’ evening', start: '2026-11-20', allDay: false, startTime: '18:00', remindDaysBefore: 1 },
    { id: 'e2', title: 'SMT only', start: '2026-11-20', remindDaysBefore: 1, private: true },
  ];
  it('tells each teacher their duty and upcoming events, hiding staff-only events from link users', () => {
    const r = buildDigest({ today: '2026-11-19', schoolName: 'Test', duties: [{ staffId: 's1', categoryId: 'c1' }], categories, events, staffIds: new Set(['s1', 's2']), accountStaff: new Set(['s1']) });
    const s1 = r.find((x) => x.staffId === 's1');
    const s2 = r.find((x) => x.staffId === 's2');
    expect(s1.title).toContain('Front gate 07:00–07:45');
    expect(s1.lines.join(' ')).toContain('SMT only');
    expect(s2.title).toContain('Coming up');
    expect(s2.pushBody).toContain('Parents’ evening at 18:00');
    expect(s2.pushBody).not.toContain('SMT only');
  });
  it('skips staff with nothing to report', () => {
    const r = buildDigest({ today: '2026-11-25', schoolName: 'Test', duties: [], categories, events, staffIds: new Set(['s1']), accountStaff: new Set() });
    expect(r).toHaveLength(0);
  });
});

describe('manifest', () => {
  it('starts the home-screen app on the shared link, and rejects other paths', async () => {
    const ok = await (await manifest(new Request('http://x/api/manifest?start=/r/AbCdEfGhIjKlMn'))).json();
    expect(ok.start_url).toBe('/r/AbCdEfGhIjKlMn');
    const bad = await (await manifest(new Request('http://x/api/manifest?start=https://evil.com'))).json();
    expect(bad.start_url).toBe('/app');
  });
});
