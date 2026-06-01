import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';

type User = { id: string; email: string };
type Ctx  = { user: User | null; loading: boolean; setUser: (u: User | null) => void };

const AuthContext = createContext<Ctx>({ user: null, loading: true, setUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
