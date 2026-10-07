import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { CartLines, CartSummary, CouponBox } from '../components/CartParts';
import { State } from '../components/Common';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';

const Cart = () => {
  const { items, clear } = useCart();
  const { confirm } = useUI();
  const navigate = useNavigate();
  return (
    <Layout title="Your cart">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>Your cart</h1>
        {items.length === 0 ? (
          <State icon="🛒" title="Your cart is empty" action={<Link to="/shop" className="btn primary">Start shopping</Link>}>Browse the shop and add something you like.</State>
        ) : (
          <div className="layout2">
            <div className="card"><CartLines /></div>
            <aside className="card stack">
              <h3>Order summary</h3>
              <CouponBox />
              <CartSummary />
              <p className="small muted">Shipping is chosen at checkout. Free standard shipping over $50.</p>
              <button className="btn primary block" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
              <button className="btn block ghost danger" onClick={async () => (await confirm({ title: 'Empty your cart?', message: 'All items will be removed.', confirmLabel: 'Empty cart', danger: true })) && clear()}>Empty cart</button>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Cart;
