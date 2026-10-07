const KEY = 'recent';

export const readRecent = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// most recent first, no duplicates, capped
export const pushRecent = (id, cap = 8) => {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, cap);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
};
