import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import Layout from '../components/Layout'
import API, { photoUrl } from './Auth/config/API'
import { useCart } from '../context/CartContext'

const ProductDetails = () => {
  const { slug } = useParams()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading')
  const [qty, setQty] = useState(1)
  const { add } = useCart()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset status before refetch when slug changes
    setStatus('loading')
    API.get(`/api/v1/products/${encodeURIComponent(slug)}`)
      .then((r) => { setProduct(r.data.product); setStatus('ok') })
      .catch((e) => setStatus(e.response?.status === 404 ? 'missing' : 'error'))
  }, [slug])

  return (
    <Layout title={product ? `${product.name} - Ecommerce App` : 'Product'}>
      <div className="page">
        <Link to="/">&larr; Back to products</Link>
        {status === 'loading' && <p className="mt-3">Loading...</p>}
        {status === 'missing' && <p className="mt-3">Product not found.</p>}
        {status === 'error' && <p className="mt-3">Could not load product.</p>}
        {status === 'ok' && (
          <div className="row mt-3">
            <div className="col-12 col-md-6 mb-3">
              {product.photo ? <img className="product-detail-img" src={photoUrl(product.photo)} alt={product.name} /> : <div className="product-detail-img" style={{ height: 250 }} />}
            </div>
            <div className="col-12 col-md-6">
              <h3>{product.name}</h3>
              <p className="text-muted">{product.category?.name}</p>
              <h4>${product.price.toFixed(2)}</h4>
              <p>{product.description}</p>
              <p>{product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}</p>
              {product.quantity > 0 && (
                <div className="d-flex gap-2" style={{ maxWidth: 260 }}>
                  <input type="number" min="1" max={product.quantity} className="form-control" value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(product.quantity, parseInt(e.target.value) || 1)))} />
                  <button className="btn btn-primary" onClick={() => { add(product, qty); toast.success('Added to cart') }}>Add to cart</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default ProductDetails
