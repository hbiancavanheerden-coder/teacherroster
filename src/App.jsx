import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { demo } from './demo/store.js';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import { firebaseConfigured } from './lib/firebase.js';
import MarketingLayout from './marketing/MarketingLayout.jsx';
import Home from './marketing/Home.jsx';
import Features from './marketing/Features.jsx';
import Pricing from './marketing/Pricing.jsx';
import FAQ from './marketing/FAQ.jsx';
import Contact from './marketing/Contact.jsx';
import Legal from './marketing/Legal.jsx';
import NotFound from './marketing/NotFound.jsx';

const Login = lazy(() => import('./auth/Login.jsx'));
const Register = lazy(() => import('./auth/Register.jsx'));
const Reset = lazy(() => import('./auth/Reset.jsx'));
const AcceptInvite = lazy(() => import('./auth/AcceptInvite.jsx'));
const AppRoutes = lazy(() => import('./app/AppRoutes.jsx'));
const PublicRoster = lazy(() => import('./public/PublicRoster.jsx'));
const UpgradePage = lazy(() => import('./public/UpgradePage.jsx'));
const PublicTv = lazy(() => import('./public/PublicTv.jsx'));
const DemoApp = lazy(() => import('./demo/DemoApp.jsx').then(async (m) => { await import('./demo/seed.js'); return m; }));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// /demo?as=teacher starts the live demo with sample data (no account needed).
function StartDemo() {
  const nav = useNavigate();
  const { search } = useLocation();
  useEffect(() => {
    const as = new URLSearchParams(search).get('as') === 'teacher' ? 'teacher' : 'owner';
    demo.start(as);
    nav('/app', { replace: true });
  }, [nav, search]);
  return <Spinner label="Opening the demo school…" />;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (demo.on) return <DemoApp />;
  if (!firebaseConfigured) return <ConfigMissing />;
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}

function ConfigMissing() {
  return (
    <div className="auth-wrap"><div className="card auth-card">
      <h3>Firebase is not configured</h3>
      <p className="muted">Add the <code>VITE_FIREBASE_*</code> variables (see <code>.env.example</code> and the README), then rebuild.</p>
    </div></div>
  );
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/legal/:doc" element={<Legal />} />
          </Route>
          <Route path="/login" element={firebaseConfigured ? <Login /> : <ConfigMissing />} />
          <Route path="/register" element={firebaseConfigured ? <Register /> : <ConfigMissing />} />
          <Route path="/reset" element={firebaseConfigured ? <Reset /> : <ConfigMissing />} />
          <Route path="/invite/:token" element={firebaseConfigured ? <AcceptInvite /> : <ConfigMissing />} />
          <Route path="/r/:token" element={<PublicRoster />} />
          <Route path="/demo" element={<StartDemo />} />
          <Route path="/upgrade/:token" element={<UpgradePage />} />
          <Route path="/tv/:token" element={<PublicTv />} />
          <Route path="/app/*" element={<RequireAuth><AppRoutes /></RequireAuth>} />
          <Route element={<MarketingLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
