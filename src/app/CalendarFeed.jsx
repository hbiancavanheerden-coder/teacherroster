import { useEffect, useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import { api } from '../lib/api.js';
import { useAction, useToast } from '../components/ui.jsx';

// Live calendar subscription (ICS feed) for a staff member's duties or the whole school calendar.
export default function CalendarFeed({ staffId, scope = 'staff' }) {
  const s = useSchool();
  const [links, setLinks] = useState(null);
  const [run, busy] = useAction();
  const toast = useToast();
  const load = () => api('links', { schoolId: s.sid, action: 'list' }).then((r) => setLinks(r.links)).catch(() => setLinks([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [s.sid]);

  const link = (links || []).find((l) => l.type === 'ics' && (scope === 'school' ? l.scope === 'school' : l.staffId === staffId));
  const url = link ? `${window.location.origin}/api/ics?token=${link.token}` : '';
  const webcal = url.replace(/^https?:/, 'webcal:');

  const create = () => run(async () => { await api('links', { schoolId: s.sid, action: 'create', type: 'ics', scope, staffId }); await load(); });
  const revoke = () => run(async () => { await api('links', { schoolId: s.sid, action: 'revoke', token: link.token }); await load(); }, 'Feed link revoked');

  if (links === null) return null;
  return (
    <div className="stack mt" style={{ gap: 8 }}>
      <div className="label">{scope === 'school' ? 'Subscribe to the school calendar' : 'Subscribe in your calendar app'}</div>
      {!link ? (
        <>
          <p className="tiny muted" style={{ margin: 0 }}>Adds {scope === 'school' ? 'school events' : 'your duties and school events'} to Google, Outlook or Apple Calendar and keeps them updated automatically.</p>
          <button className="btn secondary sm" disabled={busy || !s.canWrite} onClick={create}>Create calendar link</button>
        </>
      ) : (
        <>
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Calendar feed URL" />
          <div className="row">
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copied'); }}>Copy link</button>
            <a className="btn secondary sm" href={webcal}>Open in calendar app</a>
            <a className="btn secondary sm" target="_blank" rel="noreferrer" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Google Calendar</a>
            <button className="btn ghost sm" disabled={busy} onClick={revoke}>Revoke</button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>Anyone with this link can see these entries. Revoke it if it’s shared by mistake.</p>
        </>
      )}
    </div>
  );
}
