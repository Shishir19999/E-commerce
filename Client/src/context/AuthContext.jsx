import { createContext, useContext, useEffect, useState } from 'react';
import API from '../api/client';

const AuthContext = createContext(null);

const load = () => {
  try {
    const s = JSON.parse(localStorage.getItem('auth') || 'null');
    return s && s.token && s.user ? s : { user: null, token: '' };
  } catch {
    return { user: null, token: '' };
  }
};

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(load);

  useEffect(() => {
    try {
      if (auth.token) localStorage.setItem('auth', JSON.stringify(auth));
      else localStorage.removeItem('auth');
    } catch { /* storage unavailable */ }
  }, [auth]);

  // Validate a restored session once: drop it if the server says the token is revoked or the user is gone
  useEffect(() => {
    if (!auth.token) return;
    API.get('/api/v1/auth/me')
      .then((r) => r.data?.user && setAuth((a) => ({ ...a, user: r.data.user })))
      .catch((e) => { if (e?.response?.status === 401) setAuth({ user: null, token: '' }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (user, token) => setAuth({ user, token });
  const setUser = (user) => setAuth((a) => ({ ...a, user }));
  // Revokes the token server-side first (tokenVersion bump), then clears local state regardless of the outcome
  const logout = async () => {
    try { await API.post('/api/v1/auth/logout'); } catch { /* offline or already revoked: still log out locally */ }
    setAuth({ user: null, token: '' });
  };

  return <AuthContext.Provider value={{ ...auth, login, logout, setUser, isAdmin: auth.user?.role === 1 }}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
