import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section narrow center">
      <div className="eyebrow">404</div>
      <h1>This page is off duty.</h1>
      <p className="lead" style={{ margin: '0 auto 20px' }}>We couldn’t find what you were looking for.</p>
      <Link to="/" className="btn">Back to the homepage</Link>
    </section>
  );
}
