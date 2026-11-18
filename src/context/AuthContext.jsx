import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase.js';

const Ctx = createContext({ user: null, loading: true });
export const AuthCtx = Ctx; // exported for tests

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);
  return <Ctx.Provider value={{ user, loading, signOut: () => signOut(auth) }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
