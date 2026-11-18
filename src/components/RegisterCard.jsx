import { dow, fmtLong } from '../lib/dates.js';

// The pinned "duty register" card from the original Staff Duty Register page.
export default function RegisterCard({ date, rows, isToday, emptyText = 'No duties scheduled on this day.', extra }) {
  return (
    <div className="register">
      <div className="pin" />
      <div className="sheet">
        <div className="row between" style={{ margin: '14px 0 12px', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
          <div>
            <div className="mono tiny muted" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>{dow(date)}, duty roster</div>
            <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 21, lineHeight: 1.15 }}>{fmtLong(date)}</div>
          </div>
          <div className="stamp">{isToday ? 'TODAY' : 'ISSUED'}</div>
        </div>
        {rows.length === 0 && <div className="empty small mono" style={{ padding: '14px 0 4px' }}>{emptyText}</div>}
        {rows.map((r, i) => (
          <div key={r.key || i} className={'duty-line' + (r.match ? ' match' : '')}>
            <span className="role">{r.label}{r.time && <span className="mono tiny muted" style={{ display: 'block', textTransform: 'none', fontWeight: 400 }}>{r.time}</span>}</span>
            <span className="who">{r.name || '—'}</span>
          </div>
        ))}
        {extra}
      </div>
    </div>
  );
}
