import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { photoUrl } from './Auth/config/API'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

const Cart = () => {
  const { items, setQty, remove, subtotal } = useCart()
  const { token } = useAuth()
  const navigate = useNavigate()

  return (
    <Layout title="Cart - Ecommerce App">
      <div className="page">
        <h3>Your cart</h3>
        {items.length === 0 ? (
          <p>Your cart is empty. <Link to="/">Continue shopping</Link></p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table align-middle">
                <thead><tr><th></th><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.product}>
                      <td>{i.photo ? <img className="thumb" src={photoUrl(i.photo)} alt="" /> : <div className="thumb" />}</td>
                      <td><Link to={`/product/${i.slug}`}>{i.name}</Link></td>
                      <td>${i.price.toFixed(2)}</td>
                      <td style={{ width: 100 }}>
                        <input type="number" min="1" max={i.stock} className="form-control form-control-sm" value={i.quantity}
                          onChange={(e) => setQty(i.product, parseInt(e.target.value) || 1)} />
                      </td>
                      <td>${(i.price * i.quantity).toFixed(2)}</td>
                      <td><button className="btn btn-sm btn-outline-danger" onClick={() => remove(i.product)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h5>Estimated total: ${subtotal.toFixed(2)}</h5>
            <p className="text-muted small">Final prices are confirmed by the server when you place the order.</p>
            <button className="btn btn-primary" onClick={() => navigate(token ? '/checkout' : '/login', { state: { from: '/checkout' } })}>
              {token ? 'Proceed to checkout' : 'Login to checkout'}
            </button>
          </>
        )}
      </div>
    </Layout>
  )
}

export default Cart
