// "Get your duties as notifications" card: install guidance + one-tap enable/disable.
import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import {
  pushSupported, pushConfigured, isIOS, isStandalone, currentSubscription, enablePush, disablePush,
  sendTestPush, canPromptInstall, onInstallAvailable, promptInstall,
} from '../lib/push.js';

export default function PushCard({ target, compact, hideWhenOn, title = 'Morning reminders on your phone' }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [installable, setInstallable] = useState(canPromptInstall());
  useEffect(() => onInstallAvailable(setInstallable), []);
  useEffect(() => { currentSubscription().then((s) => setOn(Boolean(s))).catch(() => setOn(false)); }, []);

  const ios = isIOS();
  const needsInstall = ios && !isStandalone(); // iPhone only allows web notifications from a home-screen app
  const run = async (fn, ok) => {
    setBusy(true); setMsg('');
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (!pushConfigured() || (hideWhenOn && on !== false)) return null;
  const unsupported = !pushSupported() && !needsInstall;

  return (
    <div className="card push-card" style={compact ? { padding: 16 } : undefined}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
        <span className="ic-badge"><Icon name="bell" /></span>
        <div style={{ flex: 1 }}>
          <b>{on ? 'Notifications are on for this device' : title}</b>
          <p className="small muted" style={{ margin: '4px 0 12px' }}>
            {on ? 'You’ll get a reminder at 06:30 on school days when you’re on duty, plus duty changes and swap requests.'
              : 'A free reminder at 06:30 on school days telling you exactly where to be. No email needed.'}
          </p>
          {needsInstall && !on && (
            <ol className="small install-steps">
              <li>Tap the <b>Share</b> button <span aria-hidden="true">(□↑)</span> at the bottom of Safari.</li>
              <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              <li>Open StaffBoard from your home screen and tap <b>Turn on notifications</b> here.</li>
            </ol>
          )}
          {unsupported && <p className="small" style={{ margin: 0 }}>This browser can’t show notifications. Try Chrome on Android, or Safari on iPhone (iOS 16.4 or later).</p>}
          <div className="row">
            {!needsInstall && !unsupported && (on
              ? <>
                  <button className="btn secondary sm" disabled={busy} onClick={() => run(sendTestPush, 'Test sent. Check your notifications.')}>Send a test</button>
                  <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => { await disablePush(); setOn(false); })}>Turn off</button>
                </>
              : <button className="btn accent sm" disabled={busy} onClick={() => run(async () => { await enablePush(target); setOn(true); }, 'Done! You’re all set.')}>{busy ? 'Turning on…' : 'Turn on notifications'}</button>)}
            {installable && !isStandalone() && <button className="btn secondary sm" onClick={() => promptInstall()}><Icon name="download" />Add to home screen</button>}
          </div>
          {msg && <p className="small" style={{ margin: '10px 0 0', color: msg.startsWith('Done') || msg.startsWith('Test') ? 'var(--green)' : 'var(--red)' }}>{msg}</p>}
        </div>
      </div>
    </div>
  );
}
