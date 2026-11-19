import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';
import { useReveal, Words, CountUp, spotlight } from '../components/motion.jsx';
import { TESTIMONIALS } from '../config/site.js';
import { PLANS, TRIAL_DAYS, formatRand } from '../config/plans.js';
import { QUESTIONS } from './FAQ.jsx';

// Kept for the Features page and tests.
export const FEATURES = [
  ['wand', 'Fair rosters in one click', 'Rotates everyone evenly across the term, skips absences and holidays, never double-books.'],
  ['user', 'Every teacher sees their own duties', 'Teachers open their phone and see exactly where to be.'],
  ['swap', 'Swaps without the WhatsApp chaos', 'Request, accept, approve. The roster updates itself.'],
];

const DUTIES = [['Front gate', '#2952FF'], ['Back gate', '#7C5CFF'], ['Taxi rank', '#FF7A2F'], ['Devotion', '#0F9F74'], ['Aftercare', '#E5484D']];
const NAMES = ['NM', 'PV', 'TD', 'AN', 'BK', 'SM', 'LV', 'RK', 'JD', 'MB', 'TS', 'CF'];
const AV = ['#2952FF', '#7C5CFF', '#FF7A2F', '#0F9F74', '#E5484D', '#0B1124'];
const MARQUEE = ['Front gate', 'Taxi rank', 'Morning devotion', 'Aftercare', 'Sport supervision', 'Exam invigilation', 'Term dates', 'Duty swaps', 'Away & cover', 'Timetables', 'Parents’ evenings', 'Staff meetings', 'Foundation Phase', 'Intermediate Phase', 'Senior Phase'];

function HeroMock() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => { const t = setInterval(() => setCycle((c) => c + 1), 9000); return () => clearInterval(t); }, []);
  let n = 0;
  return (
    <div className="hero-stage">
      <div className="glow" />
      <div key={cycle} className="mock go" role="img" aria-label="Staffboard filling a week of duties automatically">
        <div className="mock-bar"><i /><i /><i /><span className="url">app.staffboard.co.za/roster</span></div>
        <div className="mock-body">
          <div className="mock-side">
            {['Today', 'My duties', 'Duty roster', 'Calendar', 'Timetable', 'Swaps', 'Away & cover', 'Reports'].map((x) => <span key={x} className={x === 'Duty roster' ? 'on' : ''}>{x}</span>)}
          </div>
          <div className="mock-main">
            <div className="mock-head">
              <b>Week of 9 March</b>
              <span className="mock-btn pulse">✦ Auto-schedule</span>
            </div>
            <div className="mock-grid">
              <span className="h" />
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => <span key={d} className="h">{d}</span>)}
              {DUTIES.map(([duty, c], r) => [
                <span key={duty} className="duty"><span className="dot" style={{ background: c }} />{duty}</span>,
                ...[0, 1, 2, 3, 4].map((d) => {
                  const who = NAMES[(r * 5 + d * 7) % NAMES.length];
                  const i = n++;
                  return (
                    <span key={duty + d} className="mock-cell">
                      <b data-i={who} style={{ '--t': `${600 + i * 70}ms`, '--cc': AV[(r + d) % AV.length], '--c': `${c}14` }}>{who === 'BK' ? 'You' : ['Nkosi', 'Venter', 'Dlamini', 'Naidoo', 'Botha', 'Mokoena', 'Le Roux', 'Khumalo', 'Dube', 'Meyer', 'Sithole', 'Fourie'][NAMES.indexOf(who)]}</b>
                    </span>
                  );
                }),
              ])}
            </div>
            <div className="mock-foot">
              <div className="mock-kpi"><small>Slots filled</small><strong>25 / 25</strong></div>
              <div className="mock-kpi"><small>Fairness</small><strong>±1 duty</strong></div>
              <div className="mock-kpi"><small>Clashes</small><strong style={{ color: 'var(--green)' }}>0</strong></div>
            </div>
          </div>
        </div>
      </div>
      <div key={'a' + cycle} className="float-card" style={{ left: -6, top: 120, animationDelay: '2.6s, 3.4s' }}>
        <span className="ic" style={{ background: 'var(--green)' }}>✓</span>
        <span><b>Nancy accepted your swap</b><small>Taxi rank · Thursday</small></span>
      </div>
      <div key={'b' + cycle} className="float-card" style={{ right: -10, top: 60, animationDelay: '3.4s, 4.2s' }}>
        <span className="ic" style={{ background: 'var(--warm)' }}>☀</span>
        <span><b>Morning digest sent</b><small>42 teachers · 06:30</small></span>
      </div>
      <div key={'c' + cycle} className="float-card" style={{ right: 40, bottom: -18, animationDelay: '4.2s, 5s' }}>
        <span className="ic" style={{ background: 'var(--violet)' }}>↥</span>
        <span><b>term-4-roster.pdf imported</b><small>228 duties matched to staff</small></span>
      </div>
    </div>
  );
}

const BENTO = [
  { cls: 'xl', title: 'A whole term, rostered fairly in one click', text: 'Set your duty points once. Staffboard balances total load and each duty type, respects part-time staff and weekly limits, and skips holidays and absences.', viz: 'bars' },
  { cls: '', title: 'Swaps without the chaos', text: 'Request, accept, approve. Everyone is told, and the roster updates itself.', viz: 'swap' },
  { cls: 'dark', title: 'On every teacher’s phone', text: 'Personal duties, a 06:30 digest and calendar sync. Nothing to install.', viz: 'phone' },
  { cls: 'wide', title: 'One school calendar', text: 'Term dates, exams, sport, meetings and holidays, per phase, with reminders.', viz: 'cal' },
  { cls: '', title: 'Bring your old roster', text: 'Upload a PDF, Word or Excel file, or a photo. AI reads it in for you to check.', viz: 'import' },
];

function Viz({ kind }) {
  if (kind === 'bars') {
    const hs = [58, 62, 60, 64, 59, 61, 63, 60, 62, 58, 61, 60];
    return <div className="v-bars">{hs.map((h, i) => <i key={i} style={{ '--h': `${h + 30}%`, '--d': `${i * 60}ms` }} />)}</div>;
  }
  if (kind === 'swap') return <div className="v-swap"><span className="who" style={{ background: 'var(--accent)' }}>NM</span><span className="arr" /><span className="who" style={{ background: 'var(--warm)' }}>PV</span></div>;
  if (kind === 'phone') return (
    <div className="v-phone">
      {[['☀ On duty today', 'Front gate · 07:00'], ['⇄ Swap request', 'From Mr Venter'], ['📅 Tomorrow', 'Parents’ evening 18:00']].map(([a, b], i) => <div key={a} style={{ '--d': `${0.4 + i * 0.5}s` }}><b>{a}</b><br />{b}</div>)}
    </div>
  );
  if (kind === 'cal') {
    const ev = { 3: '#2952FF', 9: '#FF7A2F', 10: '#FF7A2F', 16: '#7C5CFF', 22: '#0F9F74', 24: '#E5484D', 30: '#2952FF' };
    return <div className="v-cal">{Array.from({ length: 35 }, (_, i) => <i key={i} className={ev[i] ? 'e' : ''} style={ev[i] ? { '--c': ev[i], '--d': `${(i % 5) * 0.4}s` } : undefined} />)}</div>;
  }
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ width: 54, height: 66, borderRadius: 8, background: 'var(--red-tint)', color: 'var(--red)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, border: '1px solid #F7CFD0' }}>PDF</span>
        <span className="mono" style={{ color: 'var(--muted)' }}>→</span>
        <span style={{ display: 'grid', gap: 5 }}>{[90, 70, 80].map((w, i) => <span key={i} style={{ width: w, height: 10, borderRadius: 5, background: i === 1 ? 'var(--warm-tint)' : 'var(--accent-tint)' }} />)}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const ref = useReveal();
  return (
    <div ref={ref}>
      <section className="hero-wrap">
        <div className="mesh" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="grid-bg" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div className="hero">
          <Link to="/demo" className="pill"><b>New</b> Import last term’s roster from a PDF <span aria-hidden="true">→</span></Link>
          <h1><Words text="Duty rosters that *build themselves.*" delay={150} /></h1>
          <p className="lead reveal in" style={{ '--d': '500ms' }}>Staffboard replaces the spreadsheet, the noticeboard and the WhatsApp group. Generate a fair term of duties in seconds, keep every teacher informed, and handle swaps and absences without the admin.</p>
          <div className="hero-cta">
            <Link to="/register" className="btn lg accent">Start your {TRIAL_DAYS}-day free trial <span className="arrow">→</span></Link>
            <Link to="/demo" className="btn lg glass">Explore the live demo</Link>
          </div>
          <div className="hero-proof"><span>No card needed</span><span>Set up in 15 minutes</span><span>Priced in Rand</span><span>POPIA-minded</span></div>
          <HeroMock />
        </div>
        <div style={{ height: 80 }} />
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">{[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}</div>
      </div>

      <section className="section">
        <div className="section-head reveal">
          <div className="eyebrow">How it works</div>
          <h2>From spreadsheet chaos to <em className="serif-i">calm</em> in three steps.</h2>
        </div>
        <div className="steps">
          {[
            ['Bring what you have', 'Import your staff list from Excel, and last term’s roster or timetable from a PDF, Word file or photo.', 'import'],
            ['Press auto-schedule', 'Staffboard spreads every gate, taxi and devotion duty fairly across the term, around holidays and absences.', 'bars'],
            ['Everyone just knows', 'Teachers see their duties on their phones, get a morning reminder, and swap without chasing anyone.', 'phone'],
          ].map(([t, p, v], i) => (
            <div key={t} className="step reveal" style={{ '--d': `${i * 120}ms` }}>
              <div className="art"><div style={{ position: 'absolute', inset: 18 }}><Viz kind={v} /></div></div>
              <h3>{t}</h3><p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <div className="eyebrow">Everything in one place</div>
          <h2>Built for how South African schools <em className="serif-i">actually</em> run.</h2>
          <p>Phases, gate and taxi duty, devotions, sport afternoons, exams and the admin that comes with them.</p>
        </div>
        <div className="bento">
          {BENTO.map((b, i) => (
            <div key={b.title} className={`tile ${b.cls} reveal`} style={{ '--d': `${(i % 3) * 100}ms` }} onMouseMove={spotlight}>
              <div className="viz"><Viz kind={b.viz} /></div>
              <h3>{b.title}</h3><p>{b.text}</p>
            </div>
          ))}
        </div>
        <div className="center mt-lg reveal"><Link to="/features" className="btn secondary">See every feature <span className="arrow">→</span></Link></div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="stats-band reveal">
          <div><div className="stat"><CountUp to={1} /> click</div><div className="stat-label">to roster a whole term</div></div>
          <div><div className="stat">±<CountUp to={1} /></div><div className="stat-label">max duty difference between staff</div></div>
          <div><div className="stat"><CountUp to={0} /></div><div className="stat-label">apps for teachers to install</div></div>
          <div><div className="stat"><CountUp to={15} /> min</div><div className="stat-label">from sign-up to first roster</div></div>
        </div>
      </section>

      {TESTIMONIALS.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head reveal"><div className="eyebrow">From schools using Staffboard</div></div>
          <div className="grid grid-3">
            {TESTIMONIALS.map((t, i) => (
              <figure className="card reveal" key={t.name} style={{ margin: 0, '--d': `${i * 100}ms` }}>
                <blockquote style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 22, lineHeight: 1.3 }}>“{t.quote}”</blockquote>
                <figcaption className="small muted mt">{t.name}, {t.role}<br />{t.school}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head reveal">
          <div className="eyebrow">Pricing</div>
          <h2>Simple pricing, <em className="serif-i">in Rand.</em></h2>
        </div>
        <div className="grid grid-2" style={{ maxWidth: 860, margin: '0 auto' }}>
          {['solo', 'school'].map((id, i) => {
            const p = PLANS[id];
            return (
              <div key={id} className={'price-card reveal' + (p.popular ? ' popular' : '')} style={{ '--d': `${i * 120}ms` }}>
                {p.popular && <span className="badge warm tag">Most popular</span>}
                <div><h3 style={{ margin: 0 }}>{p.name}</h3><div className="muted small">{p.tagline}</div></div>
                <div className="price">{formatRand(p.monthly)}<small> / month</small></div>
                <ul className="ticks">{p.highlights.slice(0, 4).map((h) => <li key={h}>{h}</li>)}</ul>
                <Link to="/register" className={'btn block ' + (p.popular ? 'light' : 'secondary')}>Start free trial</Link>
              </div>
            );
          })}
        </div>
        <p className="center small muted mt">Annual plans get two months free. <Link to="/pricing">Compare plans</Link></p>
      </section>

      <section className="section narrow" style={{ paddingTop: 0 }}>
        <div className="section-head reveal" style={{ marginBottom: 20 }}><h2>Questions</h2></div>
        {QUESTIONS.slice(0, 5).map(([q, a]) => <details className="faq reveal" key={q}><summary>{q}</summary><p>{a}</p></details>)}
        <p className="center mt"><Link to="/faq">More answers</Link></p>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cta reveal" onMouseMove={spotlight}>
          <div className="spot" aria-hidden="true" />
          <div className="grid-bg" aria-hidden="true" />
          <div className="eyebrow" style={{ color: '#9DB2FF' }}>Ready when you are</div>
          <h2 style={{ maxWidth: 680, margin: '12px auto 14px' }}>Give your deputy principal their <em className="serif-i">afternoons</em> back.</h2>
          <p style={{ maxWidth: 520, margin: '0 auto 26px' }}>Start free for {TRIAL_DAYS} days with every School feature. No card, no commitment.</p>
          <div className="hero-cta" style={{ marginTop: 0 }}>
            <Link to="/register" className="btn lg light">Start free trial <span className="arrow">→</span></Link>
            <Link to="/contact" className="btn lg glass"><Icon name="calendar" />Book a walkthrough</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
