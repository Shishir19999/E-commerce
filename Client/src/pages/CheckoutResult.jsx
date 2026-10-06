import { useEffect } from 'react';
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useCart } from '../context/CartContext'

// Landing pages for Stripe Checkout redirects (/checkout/success and /checkout/cancel)
export const CheckoutSuccess = () => {
  const { clear } = useCart()
  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Layout title="Payment received - Ecommerce App">
      <div className="page">
        <h3>Payment received</h3>
        <p>Thank you! Your order is confirmed as soon as Stripe notifies the store (usually within seconds).</p>
        <Link to="/orders">View my orders</Link>
      </div>
    </Layout>
  )
}

export const CheckoutCancel = () => (
  <Layout title="Payment cancelled - Ecommerce App">
    <div className="page">
      <h3>Payment cancelled</h3>
      <p>You were not charged. Your cart is unchanged.</p>
      <Link to="/cart">Back to cart</Link>
    </div>
  </Layout>
)
