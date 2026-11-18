import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
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
          <Route path="/app/*" element={<RequireAuth><AppRoutes /></RequireAuth>} />
          <Route element={<MarketingLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
