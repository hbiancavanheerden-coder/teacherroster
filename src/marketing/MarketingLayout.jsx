import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { SITE } from '../config/site.js';

export function Brand({ to = '/' }) {
  return <Link to={to} className="brand"><img src="/brand/mark-128.png" className="brand-mark" alt="" width="30" height="30" />{SITE.name}</Link>;
}

export default function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const home = pathname === '/';
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 520);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  const dark = home && !scrolled && !open;

  return (
    <>
      <header className={'m-nav' + (dark ? ' dark' : '')}>
        <div className="m-nav-inner">
          <Brand />
          <nav className={'m-links' + (open ? ' open' : '')} aria-label="Main">
            <NavLink to="/features">Features</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/faq">FAQ</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <Link to="/demo">Live demo</Link>
            {!user && <NavLink to="/login" className="mobile-only">Sign in</NavLink>}
          </nav>
          <div className="spacer" />
          {user ? (
            <Link to="/app" className="btn sm accent">Open dashboard <span className="arrow">→</span></Link>
          ) : (
            <>
              <Link to="/login" className="btn ghost sm m-cta-login">Sign in</Link>
              <Link to="/register" className="btn sm accent">Start free trial</Link>
            </>
          )}
          <button className="icon-btn m-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Icon name={open ? 'x' : 'menu'} /></button>
        </div>
      </header>
      <main className={home ? '' : 'with-nav'}><Outlet /></main>
      <footer className="m-footer">
        <div className="section">
          <div>
            <Brand />
            <p className="small" style={{ marginTop: 12, maxWidth: 300 }}>{SITE.tagline} Fair duty rosters, one school calendar and timetables for schools in {SITE.country}.</p>
          </div>
          <div><b className="small">Product</b><Link to="/features">Features</Link><Link to="/pricing">Pricing</Link><Link to="/demo">Live demo</Link><Link to="/register">Free trial</Link></div>
          <div><b className="small">Support</b><Link to="/faq">FAQ</Link><Link to="/contact">Contact us</Link><a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></div>
          <div><b className="small">Legal</b><Link to="/legal/terms">Terms of service</Link><Link to="/legal/privacy">Privacy &amp; POPIA</Link></div>
        </div>
        <div className="center tiny" style={{ paddingBottom: 28, color: '#6B7391' }}>© {new Date().getFullYear()} {SITE.companyName}</div>
      </footer>
    </>
  );
}
