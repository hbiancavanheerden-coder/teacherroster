// Staffroom TV via secret link (/tv/:token): no login on the TV. Refreshes every minute.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { buildToday } from '../lib/today.js';
import TvBoard from '../components/TvBoard.jsx';
import { Spinner } from '../components/ui.jsx';

export default function PublicTv() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [at, setAt] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api('tv-data', { token }, { method: 'GET', authed: false })
      .then((d) => { if (alive) { setData(d); setError(''); setAt(new Date()); } })
      .catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 60000);
    // Keep the screen awake where supported.
    navigator.wakeLock?.request?.('screen').catch(() => {});
    return () => { alive = false; clearInterval(t); };
  }, [token]);
  if (!data && !error) return <Spinner label="Loading the staffroom board…" />;
  if (!data) return <div className="tv"><p style={{ margin: 'auto', fontSize: 24 }}>{error}</p></div>;
  const staffById = Object.fromEntries(data.staff.map((p) => [p.id, p]));
  const today = buildToday({ ...data, staffById, periods: data.school.periods || [] });
  return <TvBoard schoolName={data.school.name} today={today} updatedAt={at} />;
}
