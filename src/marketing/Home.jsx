import { Link } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';
import { TESTIMONIALS } from '../config/site.js';
import { TRIAL_DAYS } from '../config/plans.js';

const SAMPLE = [
  ['Foundation Front', 'Ms Nkosi'], ['Back Gate 1', 'Mr Pretorius'], ['Senior Front', 'Mrs Dlamini'],
  ['Back Gate 2', 'Mr Naidoo'], ['Morning Taxi', 'Ms Venter'], ['Morning Devotion', 'Mrs Khumalo'],
];

export const FEATURES = [
  ['wand', 'Fair rosters in one click', 'Set your duty points once. Staffboard rotates everyone evenly across the term, skips absent staff and public holidays, and never double-books a teacher.'],
  ['user', 'Every teacher sees their own duties', 'Teachers open their phone and see “You’re on Back Gate on Thursday”. No more photographing the staffroom noticeboard.'],
  ['swap', 'Swaps without the WhatsApp chaos', 'A teacher asks a colleague to cover; the colleague accepts; a deputy approves. The roster updates and everyone is notified.'],
  ['absent', 'Absences and substitutes', 'Mark someone absent and instantly see which duties need cover, with the least-loaded available colleagues suggested.'],
  ['calendar', 'One school calendar', 'Term dates, exams, sport, meetings and holidays for the whole school or per phase, in month, week, day and term views.'],
  ['grid', 'Timetables with clash detection', 'Build teacher and class timetables. Staffboard flags a teacher booked in two classes, or put on gate duty during a lesson.'],
  ['bell', 'Reminders that actually arrive', 'Email notifications when duties change, a 06:30 morning digest of today’s duties, and reminders before events.'],
  ['download', 'Print, PDF and calendar sync', 'Download the roster as a PDF for the noticeboard, export CSVs, or subscribe in Google, Outlook or Apple Calendar.'],
  ['chart', 'Workload you can defend', 'Duty counts per teacher, per category, per term. When someone says “I always get taxi duty”, you have the numbers.'],
];

export default function Home() {
  return (
    <>
      <section className="section hero">
        <div>
          <div className="eyebrow">Duty rosters · School calendar · Timetables</div>
          <h1>The duty roster that <em>builds itself</em>, fairly.</h1>
          <p className="lead">Staffboard replaces the spreadsheet, the noticeboard and the WhatsApp group. Generate a fair term of duties in seconds, keep every teacher informed, and handle swaps and absences without the admin.</p>
          <div className="row mt">
            <Link to="/register" className="btn lg">Start your {TRIAL_DAYS}-day free trial</Link>
            <Link to="/features" className="btn secondary lg">See how it works</Link>
          </div>
          <div className="hero-proof"><span>No card needed</span><span>Set up in 15 minutes</span><span>Priced in Rand</span></div>
        </div>
        <div className="register" aria-label="Example duty roster card">
          <div className="pin" />
          <div className="sheet">
            <div className="row between" style={{ margin: '14px 0 12px', alignItems: 'flex-end' }}>
              <div>
                <div className="mono tiny muted" style={{ letterSpacing: '.08em' }}>THU, DUTY ROSTER</div>
                <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 22 }}>Thursday, 12 March</div>
              </div>
              <div className="stamp">TODAY</div>
            </div>
            {SAMPLE.map(([r, n], i) => (
              <div key={r} className={'duty-line' + (i === 3 ? ' match' : '')}><span className="role">{r}</span><span className="who">{n}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="section">
          <div className="grid grid-2" style={{ alignItems: 'center', gap: 40 }}>
            <div>
              <div className="eyebrow" style={{ color: 'var(--brass)' }}>The problem</div>
              <h2>Duty admin eats hours that should go to teaching.</h2>
              <p className="muted">Someone builds the roster by hand every term. It’s printed, photographed, forwarded, changed, and argued about. Then a teacher is sick and the gate is unmanned.</p>
            </div>
            <ul className="problem-list">
              <li>“Who’s on duty today?” asked fifteen times before 07:30</li>
              <li>The same teachers end up with taxi duty every week</li>
              <li>Swaps agreed in the corridor never reach the roster</li>
              <li>Term dates live in three different documents</li>
              <li>Nobody notices the duty clash until the bell rings</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="center" style={{ maxWidth: 680, margin: '0 auto 36px' }}>
          <div className="eyebrow">What you get</div>
          <h2>Everything the deputy principal’s clipboard does, and much more.</h2>
        </div>
        <div className="grid grid-3">
          {FEATURES.map(([icon, title, text]) => (
            <div className="feature-card" key={title}>
              <div className="ico"><Icon name={icon} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="card" style={{ padding: 32 }}>
          <div className="grid grid-3" style={{ textAlign: 'center' }}>
            <div><div className="stat">1 click</div><div className="stat-label">to roster a whole term</div></div>
            <div><div className="stat">±1</div><div className="stat-label">max duty difference between staff</div></div>
            <div><div className="stat">0</div><div className="stat-label">apps for teachers to install</div></div>
          </div>
        </div>
      </section>

      {TESTIMONIALS.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="center mb"><div className="eyebrow">From schools using Staffboard</div></div>
          <div className="grid grid-3">
            {TESTIMONIALS.map((t) => (
              <figure className="card" key={t.name} style={{ margin: 0 }}>
                <blockquote style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18 }}>“{t.quote}”</blockquote>
                <figcaption className="small muted mt">{t.name}, {t.role}<br />{t.school}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="section narrow center">
        <div className="eyebrow">Two ways to start</div>
        <h2>For one teacher, or the whole staffroom.</h2>
        <p className="lead" style={{ margin: '0 auto 22px' }}>If you’re the teacher who makes the roster, the Teacher plan gives you the tools and a shareable link your colleagues can open on their phones. Schools get accounts for every staff member, swaps, notifications and reports.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/pricing" className="btn lg">Compare plans</Link>
          <Link to="/contact" className="btn secondary lg">Book a walkthrough</Link>
        </div>
      </section>
    </>
  );
}
