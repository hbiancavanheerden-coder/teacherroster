import { dow, fmtLong } from '../lib/dates.js';

const AV = ['#2952FF', '#7C5CFF', '#FF7A2F', '#0F9F74', '#E5484D', '#0B1124', '#0EA5B7', '#B5470C'];
export function initials(name = '') {
  const parts = name.replace(/^(mr|mrs|ms|miss|dr|mnr|mev|mej)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase();
}
export function avatarColor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV[h % AV.length];
}
export function Avatar({ name, size = 26 }) {
  return <span className="avatar" style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{initials(name)}</span>;
}

// "Today's duties" card: used on the dashboard and the public roster link.
export default function RegisterCard({ date, rows, isToday, emptyText = 'No duties scheduled on this day.', extra }) {
  return (
    <div className="register">
      <div className="sheet">
        <div className="sheet-head">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <small>{dow(date)} · duty roster</small>
            <strong>{fmtLong(date)}</strong>
          </div>
          <div className={'stamp' + (isToday ? '' : ' muted-stamp')}>{isToday ? '● Today' : 'Scheduled'}</div>
        </div>
        <div className="sheet-rows">
          {rows.length === 0 && <div className="empty small" style={{ padding: '22px 0 12px' }}>{emptyText}</div>}
          {rows.map((r, i) => (
            <div key={(r.key || i) + date} className={'duty-line' + (r.match ? ' match' : '')} style={{ animationDelay: `${i * 45}ms` }}>
              <span className="role">
                <span className="dot" style={{ background: r.color || 'var(--accent)' }} />
                <span>{r.label}{r.time && <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>{r.time}</span>}</span>
              </span>
              <span className="who">{r.name ? <>{r.name}<Avatar name={r.name.split(',')[0]} /></> : <span className="muted">—</span>}</span>
            </div>
          ))}
        </div>
        {extra}
      </div>
    </div>
  );
}
