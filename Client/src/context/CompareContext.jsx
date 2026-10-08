import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CompareContext = createContext(null);
export const COMPARE_MAX = 4;

const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem('compare') || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
};

// Product ids picked for side-by-side comparison (kept in the browser, up to COMPARE_MAX).
export const CompareProvider = ({ children }) => {
  const [ids, setIds] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem('compare', JSON.stringify(ids));
    } catch {
      /* storage unavailable */
    }
  }, [ids]);

  // returns { ok, added } or { ok: false, reason }
  const toggle = useCallback(
    (id) => {
      if (ids.includes(id)) {
        setIds(ids.filter((x) => x !== id));
        return { ok: true, added: false };
      }
      if (ids.length >= COMPARE_MAX) return { ok: false, reason: `You can compare up to ${COMPARE_MAX} products` };
      setIds([...ids, id]);
      return { ok: true, added: true };
    },
    [ids],
  );
  const remove = useCallback((id) => setIds((cur) => cur.filter((x) => x !== id)), []);
  const clear = useCallback(() => setIds([]), []);

  const value = useMemo(() => ({ ids, toggle, remove, clear }), [ids, toggle, remove, clear]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCompare = () => useContext(CompareContext);
