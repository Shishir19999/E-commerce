import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lineKey, useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { Img, State } from './Common';
import { money } from '../lib/format';

export const CartLines = () => {
  const { items, setQty, remove } = useCart();
  return items.map((i) => {
    const k = lineKey(i);
    return (
      <div className="line" key={k}>
        <Link to={`/product/${i.slug}`}><Img photo={i.photo} name={i.name} /></Link>
        <div>
          <Link to={`/product/${i.slug}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{i.name}</Link>
          {i.variant && <div className="small muted">{i.variant}</div>}
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <span className="stepper" role="group" aria-label={`Quantity for ${i.name}`}>
              <button aria-label="Decrease quantity" disabled={i.quantity <= 1} onClick={() => setQty(k, i.quantity - 1)}>&minus;</button>
              <span aria-live="polite">{i.quantity}</span>
              <button aria-label="Increase quantity" disabled={i.quantity >= (i.stock || 100)} onClick={() => setQty(k, i.quantity + 1)}>+</button>
            </span>
            <button className="btn sm ghost danger" onClick={() => remove(k)} aria-label={`Remove ${i.name}`}>Remove</button>
          </div>
        </div>
        <b>{money(i.price * i.quantity)}</b>
      </div>
    );
  });
};

export const CouponBox = () => {
  const { coupon, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const apply = async (e) => {
    e.preventDefault();
    if (!code.trim()) return setMsg('Enter a coupon code');
    setBusy(true);
    const r = await applyCoupon(code.trim());
    setBusy(false);
    setMsg(r.ok ? '' : r.message);
    if (r.ok) setCode('');
  };
  if (coupon)
    return (
      <div className="row between small" style={{ background: 'var(--success-soft)', color: 'var(--success)', padding: '8px 12px', borderRadius: 10 }}>
        <span><b>{coupon.code}</b> applied: -{money(coupon.discount)}</span>
        <button className="btn sm ghost" onClick={removeCoupon}>Remove</button>
      </div>
    );
  return (
    <form onSubmit={apply} noValidate>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input className="input" placeholder="Coupon code (try WELCOME10)" aria-label="Coupon code" aria-invalid={Boolean(msg)} value={code} onChange={(e) => { setCode(e.target.value); setMsg(''); }} />
        <button className="btn" disabled={busy}>Apply</button>
      </div>
      {msg && <div className="err" role="alert">{msg}</div>}
    </form>
  );
};

export const CartSummary = ({ shipping = 0, showShipping = false }) => {
  const { subtotal, discount } = useCart();
  const total = Math.max(0, subtotal - discount) + shipping;
  return (
    <div className="sum">
      <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
      {discount > 0 && <div><span>Discount</span><span>-{money(discount)}</span></div>}
      {showShipping && <div><span>Shipping</span><span>{shipping ? money(shipping) : 'Free'}</span></div>}
      <div className="total"><span>{showShipping ? 'Total' : 'Estimated total'}</span><span>{money(total)}</span></div>
    </div>
  );
};

export const CartDrawer = () => {
  const { items, open, setOpen } = useCart();
  const { confirm } = useUI();
  const navigate = useNavigate();
  const loc = useLocation();
  const closeRef = useRef(null);
  const { clear } = useCart();

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  if (!open) return null;

  return (
    <div className="drawer-wrap" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <header>
          <h3 style={{ margin: 0 }}>Your cart ({items.length})</h3>
          <button className="icon-btn" ref={closeRef} aria-label="Close cart" onClick={() => setOpen(false)}>&times;</button>
        </header>
        <div className="body">
          {items.length === 0 ? (
            <State icon="🛒" title="Your cart is empty" action={<Link to="/shop" className="btn primary" onClick={() => setOpen(false)}>Start shopping</Link>}>Add something you like and it will show up here.</State>
          ) : (
            <>
              <CartLines />
              <div style={{ margin: '14px 0' }}><CouponBox /></div>
            </>
          )}
        </div>
        {items.length > 0 && (
          <footer>
            <CartSummary />
            <button className="btn primary block" onClick={() => navigate('/checkout')}>Checkout</button>
            <div className="row between">
              <Link to="/cart" className="small">View full cart</Link>
              <button className="btn sm ghost" onClick={async () => (await confirm({ title: 'Empty your cart?', message: 'All items will be removed.', confirmLabel: 'Empty cart', danger: true })) && clear()}>Empty cart</button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
};
