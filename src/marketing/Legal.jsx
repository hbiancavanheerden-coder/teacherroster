import { useParams, Link } from 'react-router-dom';
import { SITE } from '../config/site.js';
import NotFound from './NotFound.jsx';

// IMPORTANT: These are starting templates, not legal advice. Have them reviewed before launch.
const DOCS = {
  terms: {
    title: 'Terms of service',
    body: [
      ['The service', `${SITE.name} is provided by ${SITE.companyName} ("we"). By creating an account you agree to these terms on behalf of yourself and, where applicable, your school.`],
      ['Accounts', 'You are responsible for keeping your login details secure and for the activity on your account. Workspace owners and administrators are responsible for the staff they invite and the data they enter.'],
      ['Subscriptions and billing', 'Paid plans renew automatically each month or year until cancelled. Payments are processed by PayFast. You can cancel at any time from the Billing page; access continues until the end of the paid period. Fees already paid are not refundable except where required by the Consumer Protection Act.'],
      ['Free trial', 'New workspaces receive a free trial. When it ends, the workspace becomes read-only until a plan is chosen. We do not delete your data because a trial ends.'],
      ['Acceptable use', 'Do not use the service for unlawful purposes, attempt to access other schools’ data, or disrupt the service.'],
      ['Your data', 'Your school owns its data. We process it only to provide the service, as described in our Privacy Policy.'],
      ['Availability and liability', 'We work hard to keep the service available but do not guarantee uninterrupted access. To the extent permitted by law, our liability is limited to the fees you paid in the 12 months before a claim.'],
      ['Changes', 'We may update these terms and will notify account owners of material changes by email.'],
    ],
  },
  privacy: {
    title: 'Privacy policy (POPIA)',
    body: [
      ['Responsible party', `${SITE.companyName} acts as an operator on behalf of your school (the responsible party) for staff data, and as responsible party for account and billing data. Contact: ${SITE.supportEmail}.`],
      ['What we collect', 'Account details (name, email), staff records your school enters (name, email, phone, department, grades, phase), duty, calendar, timetable and data on which staff are away (no reasons for leave), and billing references from PayFast. We do not collect learner information.'],
      ['Why we use it', 'To provide rosters, calendars, notifications and billing, to secure the service, and to provide support. We do not sell personal information or use it for advertising.'],
      ['Where it is stored', 'Data is stored on Google Cloud (Firebase) and may be processed outside South Africa under appropriate safeguards (section 72 of POPIA). Emails are sent via Resend. Documents you upload for import are read by Anthropic (Claude) and deleted immediately after reading. Payments are handled by PayFast.'],
      ['Sharing', 'Data is visible only to members of your school workspace. If an administrator creates a public roster link, staff names and duties on that roster are visible to anyone with the link until it is revoked.'],
      ['Retention', 'We keep data while your workspace is active. If you delete your account or ask us to delete a workspace, we remove it within 30 days, except where the law requires us to keep records (for example invoices).'],
      ['Your rights', 'You may access, correct or delete your personal information, object to processing, and lodge a complaint with the Information Regulator (inforegulator.org.za).'],
      ['Security', 'Data is encrypted in transit and at rest. Access is controlled by role-based security rules, and administrative actions are recorded in an audit log.'],
    ],
  },
};

export default function Legal() {
  const { doc } = useParams();
  const d = DOCS[doc];
  if (!d) return <NotFound />;
  return (
    <section className="section narrow">
      <div className="eyebrow">Legal</div>
      <h1>{d.title}</h1>
      <p className="muted small">Last updated: {new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' })}</p>
      {d.body.map(([h, t]) => (<div key={h}><h3 className="mt">{h}</h3><p>{t}</p></div>))}
      <p className="mt-lg"><Link to="/contact">Questions? Contact us.</Link></p>
    </section>
  );
}
