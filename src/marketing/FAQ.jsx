import { Link } from 'react-router-dom';
import { TRIAL_DAYS } from '../config/plans.js';

export const QUESTIONS = [
  ['How does the free trial work?', `You get ${TRIAL_DAYS} days of the full School plan with no card required. At the end, choose a plan to keep editing. If you don't, your workspace becomes read-only. Nothing is deleted.`],
  ['Do teachers need to install an app?', 'No app store needed. Staffboard runs in any browser and can be added to the home screen like an app, with free morning notifications. On the School plan, staff without accounts can use the shared roster link.'],
  ['What’s the difference between the Teacher and School plans?', 'The Teacher plan is your personal organiser: your own duties, timetable, calendar and morning reminders, plus tools to build and print a roster. The School plan shares it live with everyone: a roster link staff open without logging in, free reminders on every teacher’s phone, staff accounts, swaps, absences and cover.'],
  ['I’m on the Teacher plan. How do I get my whole school on Staffboard?', 'Tap “Share with staff” and choose “Send to my principal”. We email a short proposal with a secure link your principal or bursar can use to activate the School plan (card or Instant EFT, or ask us for an invoice). Everything you’ve already set up is kept.'],
  ['How does the automatic roster stay fair?', 'For each duty slot Staffboard picks the eligible teacher with the lowest load so far. It accounts for total duties, how often they have had that specific duty, back-to-back days, weekly limits, part-time weighting, absences and holidays. You can always adjust slots by hand afterwards.'],
  ['Can I import my existing staff list?', 'Yes. Upload an Excel (.xlsx) or CSV file with names, emails, departments, grades and phases. A template is provided.'],
  ['We already have this term’s roster and timetables. Do we have to retype them?', 'No. Upload them as a PDF, Word document, Excel sheet or even a clear photo. AI reads the document and matches the names to your staff, and you check every match before anything is saved.'],
  ['How do payments work?', 'Subscriptions are billed monthly or annually in Rand through PayFast, a South African payment provider. We never see your card details. You can update your card or cancel from the Billing page.'],
  ['Can I change or cancel my plan?', 'Yes, any time. Upgrades take effect immediately. If you cancel, you keep access until the end of the period you have paid for.'],
  ['Is our data safe? What about POPIA?', 'Each school’s data is isolated and protected by database-level security rules, encrypted in transit and at rest, and only visible to your staff. You can export your data and delete accounts at any time. See our privacy policy.'],
  ['Can we have different term dates for Foundation and Intermediate Phase?', 'Yes. Terms and events can apply to the whole school or to a specific phase, and staff can filter the calendar by phase.'],
  ['Does it work offline?', 'Recently viewed rosters and calendars stay available on your device when the school Wi-Fi drops, and changes sync when you reconnect.'],
];

export default function FAQ() {
  return (
    <section className="section narrow">
      <div className="center mb">
        <div className="eyebrow">FAQ</div>
        <h1>Questions, answered.</h1>
      </div>
      {QUESTIONS.map(([q, a]) => (
        <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>
      ))}
      <p className="center mt-lg">Still unsure? <Link to="/contact">Send us a message</Link>. A real person replies.</p>
    </section>
  );
}
