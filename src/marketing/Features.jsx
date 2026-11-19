import { Link } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';

const GROUPS = [
  {
    title: 'Duty rosters',
    icon: 'roster',
    benefit: 'Hours of term planning become a two-minute task, and nobody can say the roster is unfair.',
    items: [
      'Your own duty points: gates, taxi rank, devotion, aftercare, sport supervision',
      'Set how many staff each duty needs and which weekdays it runs',
      'Automatic fair rotation that balances total and per-duty load',
      'Part-time staff weighting, weekly limits and duty exclusions',
      'Skips public holidays, closed days and staff marked away',
      'Edit any slot by hand; changes notify the teachers affected',
      'Already have a roster? Upload the PDF, Word or Excel file, or a photo, and AI reads it in',
      'Conflict detection: double bookings, staff away and lesson clashes',
    ],
  },
  {
    title: 'For every teacher',
    icon: 'user',
    benefit: 'Teachers know where to be without asking, and they stop missing duties.',
    items: [
      'Personal “My duties” view with upcoming and past duties',
      'Swap requests to a colleague with deputy approval',
      'Morning email digest of today’s duties and events',
      'Subscribe to their duties in Google, Outlook or Apple Calendar',
      'A shared roster link (School plan) that staff open without logging in, with free morning reminders',
    ],
  },
  {
    title: 'School calendar & terms',
    icon: 'calendar',
    benefit: 'One trusted source of dates for the whole staff.',
    items: [
      'Activities, exams, meetings, sport, holidays and deadlines',
      'Whole school, Foundation, Intermediate or Senior Phase',
      'Term dates per phase',
      'Recurring events (daily, weekly, monthly) with exceptions',
      'Month, week, day and full-term agenda views',
      'Configurable reminders before each event',
    ],
  },
  {
    title: 'Timetables',
    icon: 'grid',
    benefit: 'Clashes are caught when the timetable is built, not on the first Monday of term.',
    items: [
      'Your school’s own period structure and break times',
      'Timetables by teacher and by class',
      'Teacher, class and room clash detection',
      'Duty-versus-lesson clash warnings',
      'Print-ready timetable sheets',
      'Import existing timetables from PDF, Word, Excel or a photo',
    ],
  },
  {
    title: 'Admin & reporting',
    icon: 'chart',
    benefit: 'Defensible numbers for SMT meetings and union questions.',
    items: [
      'Workload reports by teacher and duty category, for any date range',
      'Duty history per teacher',
      'Bulk staff import from Excel or CSV',
      'Announcements with email delivery',
      'Full audit log of who changed what, and when',
      'PDF and CSV exports of rosters, calendars and reports',
    ],
  },
  {
    title: 'Security & privacy',
    icon: 'shield',
    benefit: 'Staff data stays inside your school.',
    items: [
      'Each school’s data is isolated and enforced by database security rules',
      'Role-based access: owner, administrator, teacher',
      'Hosted on Google Cloud (Firebase), encrypted in transit and at rest',
      'Built with POPIA in mind: export your data and delete accounts at any time',
      'Payments by PayFast. We never see or store card numbers',
    ],
  },
];

export default function Features() {
  return (
    <>
      <section className="section narrow center">
        <div className="eyebrow">Features</div>
        <h1 style={{ fontSize: 'clamp(34px, 5vw, 58px)' }}>Built around how South African schools <em className="serif-i">actually</em> run.</h1>
        <p className="lead" style={{ margin: '0 auto' }}>Phases, gate and taxi duty, devotions, sport afternoons, and the admin that comes with them. StaffBoard fits the way your staffroom already works.</p>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="grid grid-2">
          {GROUPS.map((g) => (
            <div className="card" key={g.title}>
              <div className="row" style={{ marginBottom: 6 }}>
                <div className="feature-card" style={{ padding: 0, border: 0, background: 'none' }}><div className="ico" style={{ margin: 0 }}><Icon name={g.icon} /></div></div>
                <h3 style={{ margin: 0 }}>{g.title}</h3>
              </div>
              <p className="muted small">{g.benefit}</p>
              <ul className="ticks">{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="center mt-lg">
          <Link to="/register" className="btn lg">Try it free for 14 days</Link>
        </div>
      </section>
    </>
  );
}
