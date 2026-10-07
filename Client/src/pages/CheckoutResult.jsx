import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { State } from '../components/Common';
import { useCart } from '../context/CartContext';

// Landing pages for Stripe Checkout redirects (/checkout/success and /checkout/cancel)
export const CheckoutSuccess = () => {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return (
    <Layout title="Payment received">
      <div className="container page"><State icon="✅" title="Payment received" action={<Link className="btn primary" to="/orders">View my orders</Link>}>Thank you! Your order is confirmed as soon as Stripe notifies the store (usually within seconds).</State></div>
    </Layout>
  );
};

export const CheckoutCancel = () => (
  <Layout title="Payment cancelled">
    <div className="container page"><State icon="↩️" title="Payment cancelled" action={<Link className="btn primary" to="/cart">Back to cart</Link>}>You were not charged. Your cart is unchanged.</State></div>
  </Layout>
);
