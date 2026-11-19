// Wraps School-plan pages. On the Teacher plan it explains the feature and offers the upgrade paths.
import { useState } from 'react';
import { useSchool } from '../context/SchoolContext.jsx';
import UpgradeModal from './UpgradeModal.jsx';
import { Icon } from '../components/ui.jsx';

export default function SchoolOnly({ feature, title, points = [], children }) {
  const s = useSchool();
  const [open, setOpen] = useState(false);
  if (s.plan.features[feature]) return children;
  return (
    <div className="card push-card" style={{ maxWidth: 760, padding: 28 }}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 16 }}>
        <span className="ic-badge"><Icon name="users" /></span>
        <div style={{ flex: 1 }}>
          <span className="badge brass">School plan</span>
          <h3 style={{ margin: '10px 0 6px', fontSize: 22 }}>{title}</h3>
          {points.length > 0 && <ul className="ticks" style={{ margin: '12px 0 18px' }}>{points.map((p) => <li key={p}>{p}</li>)}</ul>}
          <p className="small muted">This is part of the School plan because it organises your whole staff. Your Teacher plan keeps working as it is.</p>
          <button className="btn accent" onClick={() => setOpen(true)}>Get this for my school</button>
        </div>
      </div>
      {open && <UpgradeModal onClose={() => setOpen(false)} />}
    </div>
  );
}
