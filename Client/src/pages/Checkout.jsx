import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import Layout from '../components/Layout'
import API, { errMsg } from './Auth/config/API'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

const Checkout = () => {
  const { items, subtotal, clear } = useCart()
  const { user } = useAuth()
  const [address, setAddress] = useState(user?.address || '')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState(null) // 'mock' | 'stripe'

  useEffect(() => {
    API.get('/api/v1/payments/config').then((r) => setMode(r.data.mode)).catch(() => setMode('mock'))
  }, [])
  const navigate = useNavigate()

  const placeOrder = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      // only ids and quantities are sent; the server computes prices
      const res = await API.post('/api/v1/payments/checkout', {
        items: items.map((i) => ({ product: i.product, quantity: i.quantity })),
        shippingAddress: address,
      })
      if (res.data.success && res.data.mode === 'stripe') {
        window.location.assign(res.data.url) // hosted Stripe Checkout; cart is cleared on the success page
        return
      }
      if (res.data.success) {
        clear()
        toast.success('Order placed')
        navigate('/orders')
      } else toast.error(res.data.message)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setBusy(false)
    }
  }

  if (items.length === 0) return <Layout title="Checkout"><div className="page"><p>Your cart is empty. <Link to="/">Shop</Link></p></div></Layout>

  return (
    <Layout title="Checkout - Ecommerce App">
      <div className="page">
        <h3>Checkout</h3>
        <ul className="list-group mb-3">
          {items.map((i) => (
            <li key={i.product} className="list-group-item d-flex justify-content-between">
              <span>{i.name} x {i.quantity}</span><span>${(i.price * i.quantity).toFixed(2)}</span>
            </li>
          ))}
          <li className="list-group-item d-flex justify-content-between"><strong>Estimated total</strong><strong>${subtotal.toFixed(2)}</strong></li>
        </ul>
        <form onSubmit={placeOrder} style={{ maxWidth: 480 }}>
          <div className="mb-3">
            <label className="form-label">Shipping address</label>
            <textarea className="form-control" rows="3" value={address} onChange={(e) => setAddress(e.target.value)} required minLength={5} maxLength={300} />
          </div>
          {mode === 'stripe' ? (
            <p><span className="badge text-bg-primary">Stripe test mode</span> You will be redirected to Stripe Checkout (test card 4242 4242 4242 4242). No real money is charged.</p>
          ) : (
            <p><span className="mock-badge">Mock payment</span> No real payment is taken. Placing the order marks it as paid (mock).</p>
          )}
          <button className="btn btn-success" disabled={busy || !mode}>{mode === 'stripe' ? 'Pay with Stripe' : 'Place order (mock payment)'}</button>
        </form>
      </div>
    </Layout>
  )
}

export default Checkout
