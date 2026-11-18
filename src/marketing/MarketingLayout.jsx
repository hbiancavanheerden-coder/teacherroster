import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { SITE } from '../config/site.js';

export function Brand({ to = '/' }) {
  return <Link to={to} className="brand"><span className="brand-mark" aria-hidden="true" />{SITE.name}</Link>;
}

export default function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const close = () => setOpen(false);
  return (
    <>
      <header className="m-nav">
        <div className="m-nav-inner">
          <Brand />
          <nav className={'m-links' + (open ? ' open' : '')} aria-label="Main">
            <NavLink to="/features" onClick={close}>Features</NavLink>
            <NavLink to="/pricing" onClick={close}>Pricing</NavLink>
            <NavLink to="/faq" onClick={close}>FAQ</NavLink>
            <NavLink to="/contact" onClick={close}>Contact</NavLink>
            {!user && <NavLink to="/login" onClick={close} className="mobile-only">Sign in</NavLink>}
          </nav>
          <div className="spacer" />
          {user ? (
            <Link to="/app" className="btn sm">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn ghost sm m-cta-login">Sign in</Link>
              <Link to="/register" className="btn sm">Start free trial</Link>
            </>
          )}
          <button className="icon-btn m-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Icon name={open ? 'x' : 'menu'} /></button>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="m-footer">
        <div className="section">
          <div>
            <Brand />
            <p className="muted small" style={{ marginTop: 10 }}>{SITE.tagline}<br />Made for schools in {SITE.country}.</p>
          </div>
          <div><b className="small">Product</b><Link to="/features">Features</Link><Link to="/pricing">Pricing</Link><Link to="/register">Free trial</Link></div>
          <div><b className="small">Support</b><Link to="/faq">FAQ</Link><Link to="/contact">Contact us</Link><a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></div>
          <div><b className="small">Legal</b><Link to="/legal/terms">Terms of service</Link><Link to="/legal/privacy">Privacy &amp; POPIA</Link></div>
        </div>
        <div className="center tiny muted" style={{ paddingBottom: 24 }}>© {new Date().getFullYear()} {SITE.companyName}</div>
      </footer>
    </>
  );
}
