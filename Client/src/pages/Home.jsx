import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import Layout from '../components/Layout'
import API, { errMsg, photoUrl } from './Auth/config/API'
import { useCart } from '../context/CartContext'

const Home = () => {
  const [params, setParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [data, setData] = useState({ products: [], page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState(params.get('search') || '')
  const { add } = useCart()

  const page = parseInt(params.get('page')) || 1
  const search = params.get('search') || ''
  const category = params.get('category') || ''
  const sort = params.get('sort') || 'newest'

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  useEffect(() => {
    API.get('/api/v1/categories').then((r) => setCategories(r.data.categories || [])).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true)
    API.get('/api/v1/products', { params: { page, limit: 8, search, category, sort } })
      .then((r) => { if (!cancelled) setData(r.data) })
      .catch((e) => toast.error(errMsg(e, 'Could not load products')))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, search, category, sort])

  return (
    <Layout title="Shop - Ecommerce App">
      <div className="page">
        <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); update({ search: searchText.trim() }) }}>
          <div className="col-12 col-md-5">
            <input className="form-control" placeholder="Search products" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select" value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c._id} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
          <div className="col-12 col-md-2 d-flex gap-2">
            <button className="btn btn-primary flex-fill" type="submit">Search</button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => { setSearchText(''); setParams({}) }}>Reset</button>
          </div>
        </form>

        {loading ? <p>Loading...</p> : data.products.length === 0 ? <p>No products found.</p> : (
          <div className="product-grid">
            {data.products.map((p) => (
              <div className="card product-card" key={p._id}>
                {p.photo ? <img className="product-img" src={photoUrl(p.photo)} alt={p.name} /> : <div className="product-img" />}
                <div className="card-body">
                  <h6 className="card-title">{p.name}</h6>
                  <p className="card-text mb-1">${p.price.toFixed(2)}</p>
                  <p className="text-muted small">{p.quantity > 0 ? `${p.quantity} in stock` : 'Out of stock'}</p>
                  <Link to={`/product/${p.slug}`} className="btn btn-sm btn-outline-primary me-2">Details</Link>
                  <button className="btn btn-sm btn-primary" disabled={p.quantity < 1} onClick={() => { add(p); toast.success('Added to cart') }}>Add</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
          <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Prev</button>
          <span>Page {data.page} of {data.totalPages} ({data.total} items)</span>
          <button className="btn btn-outline-secondary" disabled={page >= data.totalPages} onClick={() => update({ page: String(page + 1) })}>Next</button>
        </div>
      </div>
    </Layout>
  )
}

export default Home
