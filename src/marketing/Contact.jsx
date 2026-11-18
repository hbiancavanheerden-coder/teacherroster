import { useState } from 'react';
import { Field, ErrorBox } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { SITE } from '../config/site.js';

export default function Contact() {
  const [f, setF] = useState({ name: '', email: '', school: '', topic: 'Demo / walkthrough', message: '', website: '' });
  const [state, setState] = useState({ busy: false, done: false, error: null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: null });
    try {
      await api('contact', f, { authed: false });
      setState({ busy: false, done: true, error: null });
    } catch (err) {
      setState({ busy: false, done: false, error: err });
    }
  };
  return (
    <section className="section">
      <div className="grid grid-2" style={{ gap: 40 }}>
        <div>
          <div className="eyebrow">Contact</div>
          <h1>Let’s talk about your staffroom.</h1>
          <p className="lead">Book a 20-minute walkthrough, ask about a school or district licence, or get help importing your current roster.</p>
          <p className="muted">Email us directly at <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. We reply within one school day.</p>
        </div>
        <div className="card">
          {state.done ? (
            <div className="ok-box">Thank you! Your message has been sent. We’ll be in touch shortly.</div>
          ) : (
            <form className="stack" onSubmit={submit}>
              <div className="form-grid">
                <Field label="Your name"><input required value={f.name} onChange={set('name')} autoComplete="name" /></Field>
                <Field label="Email"><input required type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
                <Field label="School"><input value={f.school} onChange={set('school')} /></Field>
                <Field label="Topic">
                  <select value={f.topic} onChange={set('topic')}>
                    <option>Demo / walkthrough</option><option>School or district licence</option><option>Billing</option><option>Support</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Message" className="full"><textarea required minLength={10} value={f.message} onChange={set('message')} /></Field>
              </div>
              <input className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} name="website" />
              <ErrorBox error={state.error} />
              <button className="btn" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send message'}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
