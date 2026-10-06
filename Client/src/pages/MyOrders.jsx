import { useEffect, useState } from 'react';
import { toast } from 'react-toastify'
import Layout from '../components/Layout'
import API, { errMsg } from './Auth/config/API'

const MyOrders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    API.get('/api/v1/orders/mine')
      .then((r) => setOrders(r.data.orders || []))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout title="My Orders - Ecommerce App">
      <div className="page">
        <h3>My orders</h3>
        {loading ? <p>Loading...</p> : orders.length === 0 ? <p>No orders yet.</p> : orders.map((o) => (
          <div className="card mb-3" key={o._id}>
            <div className="card-header d-flex flex-wrap justify-content-between gap-2">
              <span>{new Date(o.createdAt).toLocaleString()}</span>
              <span className="badge text-bg-secondary">{o.status}</span>
            </div>
            <div className="card-body">
              <ul className="mb-2">
                {o.items.map((i) => <li key={i._id}>{i.name} x {i.quantity} @ ${i.price.toFixed(2)}</li>)}
              </ul>
              <p className="mb-1"><strong>Total: ${o.total.toFixed(2)}</strong> <span className={o.payment?.method === 'stripe' ? 'badge text-bg-info' : 'mock-badge'}>Payment: {o.payment?.status}</span></p>
              <p className="mb-0 text-muted small">Ship to: {o.shippingAddress}</p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}

export default MyOrders
