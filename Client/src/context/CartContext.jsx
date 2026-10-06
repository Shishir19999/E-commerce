import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);

const load = () => {
  try {
    const c = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
};

// item: { product (id), slug, name, price, photo, stock, quantity }
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const add = (p, qty = 1) =>
    setItems((cur) => {
      const found = cur.find((i) => i.product === p._id);
      const max = p.quantity;
      if (found) return cur.map((i) => (i.product === p._id ? { ...i, stock: max, quantity: Math.min(max, i.quantity + qty) } : i));
      return [...cur, { product: p._id, slug: p.slug, name: p.name, price: p.price, photo: p.photo, stock: max, quantity: Math.min(max, qty) }];
    });
  const setQty = (id, qty) =>
    setItems((cur) => cur.map((i) => (i.product === id ? { ...i, quantity: Math.max(1, Math.min(i.stock || 100, qty)) } : i)));
  const remove = (id) => setItems((cur) => cur.filter((i) => i.product !== id));
  const clear = () => setItems([]);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  // display-only estimate; the server recalculates the real total
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

  return <CartContext.Provider value={{ items, add, setQty, remove, clear, count, subtotal }}>{children}</CartContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
