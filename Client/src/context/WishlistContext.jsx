import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API, { errMsg } from '../api/client';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { token } = useAuth();
  const { toast } = useUI();
  const [stored, setIds] = useState([]);
  const ids = useMemo(() => (token ? stored : []), [token, stored]);

  useEffect(() => {
    let live = true;
    if (!token) return;
    API.get('/api/v1/wishlist').then((r) => live && setIds(r.data.ids || [])).catch(() => {});
    return () => {
      live = false;
    };
  }, [token]);

  // returns false when the visitor must sign in first
  const toggle = useCallback(
    async (id) => {
      if (!token) return false;
      const has = ids.includes(id);
      setIds((cur) => (has ? cur.filter((x) => x !== id) : [...cur, id])); // optimistic
      try {
        const r = has ? await API.delete(`/api/v1/wishlist/${id}`) : await API.post(`/api/v1/wishlist/${id}`);
        setIds(r.data.ids || []);
        toast.success(has ? 'Removed from wishlist' : 'Saved to wishlist');
      } catch (e) {
        setIds((cur) => (has ? [...cur, id] : cur.filter((x) => x !== id)));
        toast.error(errMsg(e));
      }
      return true;
    },
    [token, ids, toast],
  );

  const value = useMemo(() => ({ ids, toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWishlist = () => useContext(WishlistContext);
