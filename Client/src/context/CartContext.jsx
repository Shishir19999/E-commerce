import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API, { errMsg } from '../api/client';

const CartContext = createContext(null);

const load = () => {
  try {
    const c = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(c) ? c.filter((i) => i && i.product) : [];
  } catch {
    return [];
  }
};

// eslint-disable-next-line react-refresh/only-export-components
export const lineKey = (i) => `${i.product}|${i.variant || ''}`;

const loadSaved = () => {
  try {
    const c = JSON.parse(localStorage.getItem('saved') || '[]');
    return Array.isArray(c) ? c.filter((i) => i && i.product) : [];
  } catch {
    return [];
  }
};

// item: { product (id), variant, slug, name, price, photo, stock, quantity }
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(load);
  const [saved, setSaved] = useState(loadSaved); // saved for later (not part of the order)
  const [open, setOpen] = useState(false);
  const [couponState, setCoupon] = useState(null); // { code, discount, description }

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(items));
    } catch {
      /* storage unavailable */
    }
  }, [items]);
  useEffect(() => {
    try {
      localStorage.setItem('saved', JSON.stringify(saved));
    } catch {
      /* storage unavailable */
    }
  }, [saved]);

  const add = useCallback((p, qty = 1, variant = '') => {
    setItems((cur) => {
      const max = p.quantity;
      const found = cur.find((i) => i.product === p._id && (i.variant || '') === variant);
      if (found) return cur.map((i) => (i === found ? { ...i, stock: max, quantity: Math.min(max, i.quantity + qty) } : i));
      return [...cur, { product: p._id, variant, slug: p.slug, name: p.name, price: p.price, photo: p.photo, stock: max, quantity: Math.min(max, qty) }];
    });
  }, []);
  const setQty = useCallback((key, qty) => setItems((cur) => cur.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.max(1, Math.min(i.stock || 100, qty)) } : i))), []);
  const remove = useCallback((key) => setItems((cur) => cur.filter((i) => lineKey(i) !== key)), []);
  const saveForLater = useCallback((key) => {
    const line = items.find((i) => lineKey(i) === key);
    if (!line) return;
    setItems((cur) => cur.filter((i) => lineKey(i) !== key));
    setSaved((cur) => [...cur.filter((i) => lineKey(i) !== key), line]);
  }, [items]);
  const moveToCart = useCallback((key) => {
    const line = saved.find((i) => lineKey(i) === key);
    if (!line) return;
    setSaved((cur) => cur.filter((i) => lineKey(i) !== key));
    setItems((cur) => {
      const found = cur.find((i) => lineKey(i) === key);
      if (found) return cur.map((i) => (i === found ? { ...i, quantity: Math.min(i.stock || 100, i.quantity + line.quantity) } : i));
      return [...cur, line];
    });
  }, [saved]);
  const removeSaved = useCallback((key) => setSaved((cur) => cur.filter((i) => lineKey(i) !== key)), []);
  const clear = useCallback(() => {
    setItems([]);
    setCoupon(null);
  }, []);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

  // Coupons are re-validated whenever the subtotal changes (the server decides the real discount at checkout).
  const coupon = subtotal > 0 ? couponState : null;
  const code = coupon?.code;
  useEffect(() => {
    if (!code) return;
    let live = true;
    API.post('/api/v1/coupons/validate', { code, subtotal })
      .then((r) => live && setCoupon((c) => (c && c.discount !== r.data.discount ? { ...c, discount: r.data.discount } : c)))
      .catch(() => live && setCoupon(null));
    return () => {
      live = false;
    };
  }, [code, subtotal]);

  const applyCoupon = useCallback(
    async (c) => {
      try {
        const r = await API.post('/api/v1/coupons/validate', { code: c, subtotal });
        setCoupon({ code: r.data.coupon.code, discount: r.data.discount, description: r.data.coupon.description });
        return { ok: true, message: r.data.message };
      } catch (e) {
        return { ok: false, message: errMsg(e, 'Could not apply the coupon') };
      }
    },
    [subtotal],
  );
  const removeCoupon = useCallback(() => setCoupon(null), []);

  const value = useMemo(
    () => ({ items, saved, saveForLater, moveToCart, removeSaved, add, setQty, remove, clear, count, subtotal, open, setOpen, coupon, applyCoupon, removeCoupon, discount: coupon?.discount || 0 }),
    [items, saved, saveForLater, moveToCart, removeSaved, open, coupon, count, subtotal, add, setQty, remove, clear, applyCoupon, removeCoupon],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
