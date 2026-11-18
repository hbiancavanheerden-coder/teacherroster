// Runs the real app UI against the in-browser demo store, signed in as a sample owner or teacher.
import { useEffect, useMemo, useState } from 'react';
import { AuthCtx } from '../context/AuthContext.jsx';
import { demo } from './store.js';
import { PERSONAS } from './seed.js';
import AppRoutes from '../app/AppRoutes.jsx';

export default function DemoApp() {
  const [persona, setPersona] = useState(demo.persona);
  useEffect(() => demo.subscribe(() => setPersona(demo.persona)), []);
  const p = PERSONAS[persona] || PERSONAS.owner;
  const value = useMemo(() => ({
    user: { uid: p.uid, email: p.email, displayName: p.name, emailVerified: true, providerData: [], getIdToken: async () => 'demo' },
    loading: false,
    signOut: async () => { demo.stop(); },
  }), [p]);
  return (
    <AuthCtx.Provider value={value}>
      <AppRoutes key={persona} />
    </AuthCtx.Provider>
  );
}
