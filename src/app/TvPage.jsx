// In-app staffroom TV (School plan): open on the staffroom PC/TV while signed in. Updates live.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../context/SchoolContext.jsx';
import { useToday } from './hooks.js';
import TvBoard from '../components/TvBoard.jsx';
import SchoolOnly from './SchoolOnly.jsx';

export default function TvPage() {
  return (
    <SchoolOnly feature="tvDisplay" title="Staffroom TV display"
      points={['A full-screen board for the staffroom TV or a spare screen', 'Today’s duties, who’s away, relief, exams, events and notices', 'Updates by itself all day, with no one to maintain it', 'Works from a secret link, so the TV needs no login']}>
      <TvInner />
    </SchoolOnly>
  );
}

function TvInner() {
  const s = useSchool();
  const nav = useNavigate();
  const today = useToday(s.today);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // Rendered on <body> so it fills the whole screen (the app's page transition would otherwise contain it).
  return createPortal(<TvBoard schoolName={s.school.name} today={today} onExit={() => nav('/app')} />, document.body);
}
