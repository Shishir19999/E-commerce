import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { CartLines, CartSummary, CouponBox } from '../components/CartParts';
import { Img, State } from '../components/Common';
import { lineKey, useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { money } from '../lib/format';

const SavedForLater = () => {
  const { saved, moveToCart, removeSaved } = useCart();
  if (saved.length === 0) return null;
  return (
    <section className="card" aria-labelledby="saved-h" style={{ marginTop: 20 }}>
      <h2 id="saved-h" style={{ fontSize: '1.3rem' }}>Saved for later ({saved.length})</h2>
      {saved.map((i) => {
        const k = lineKey(i);
        return (
          <div className="line" key={k}>
            <Link to={`/product/${i.slug}`}><Img photo={i.photo} name={i.name} /></Link>
            <div>
              <Link to={`/product/${i.slug}`} style={{ color: 'var(--text)', fontWeight: 600 }}>{i.name}</Link>
              {i.variant && <div className="small muted">{i.variant}</div>}
              <div className="row" style={{ gap: 10, marginTop: 6 }}>
                <button className="btn sm" onClick={() => moveToCart(k)} aria-label={`Move ${i.name} to cart`}>Move to cart</button>
                <button className="btn sm ghost danger" onClick={() => removeSaved(k)} aria-label={`Delete saved ${i.name}`}>Delete</button>
              </div>
            </div>
            <b>{money(i.price * i.quantity)}</b>
          </div>
        );
      })}
    </section>
  );
};

const Cart = () => {
  const { items, saved, clear } = useCart();
  const { confirm } = useUI();
  const navigate = useNavigate();
  return (
    <Layout title="Your cart">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>Your cart</h1>
        {items.length === 0 ? (
          <>
            <State icon="🛒" title="Your cart is empty" action={<Link to="/shop" className="btn primary">Start shopping</Link>}>{saved.length ? 'Items you saved for later are below.' : 'Browse the shop and add something you like.'}</State>
            <SavedForLater />
          </>
        ) : (
          <>
            <div className="layout2">
              <div className="card"><CartLines saveLater /></div>
              <aside className="card stack">
                <h3>Order summary</h3>
                <CouponBox />
                <CartSummary />
                <p className="small muted">Shipping is chosen at checkout. Free standard shipping over $50.</p>
                <button className="btn primary block" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
                <button className="btn block ghost danger" onClick={async () => (await confirm({ title: 'Empty your cart?', message: 'All items will be removed.', confirmLabel: 'Empty cart', danger: true })) && clear()}>Empty cart</button>
              </aside>
            </div>
            <SavedForLater />
          </>
        )}
      </div>
    </Layout>
  );
};

export default Cart;
