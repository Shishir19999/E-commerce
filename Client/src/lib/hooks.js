import { useEffect, useState } from 'react';

export const useDebounced = (value, ms = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

// Fetch helper: `loading` is true whenever the result on hand belongs to an older key (stale data stays visible meanwhile).
export const useFetch = (fn, deps) => {
  const [tick, setTick] = useState(0);
  const key = `${JSON.stringify(deps)}#${tick}`;
  const [res, setRes] = useState({ key: null, data: null, error: '' });
  useEffect(() => {
    let live = true;
    fn()
      .then((data) => live && setRes({ key, data, error: '' }))
      .catch((e) => live && setRes({ key, data: null, error: e?.response?.data?.message || 'Request failed' }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data: res.data, error: res.key === key ? res.error : '', loading: res.key !== key, reload: () => setTick((t) => t + 1) };
};
