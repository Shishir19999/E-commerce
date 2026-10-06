import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify'
import Layout from '../../components/Layout'
import API, { errMsg, photoUrl } from '../Auth/config/API'

const empty = { name: '', description: '', price: '', quantity: '', category: '', photoUrl: '' }

const AdminProducts = () => {
  const [categories, setCategories] = useState([])
  const [data, setData] = useState({ products: [], page: 1, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    API.get('/api/v1/products', { params: { page, limit: 10 } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)))
  }, [page])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    API.get('/api/v1/categories').then((r) => setCategories(r.data.categories || [])).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const reset = () => { setForm(empty); setFile(null); setEditingId(null) }

  const submit = async (e) => {
    e.preventDefault()
    if (file && file.size > 1024 * 1024) return toast.error('Image must be 1 MB or smaller')
    const fd = new FormData()
    ;['name', 'description', 'price', 'quantity', 'category'].forEach((k) => fd.append(k, form[k]))
    if (file) fd.append('photo', file)
    else if (form.photoUrl || editingId) fd.append('photo', form.photoUrl)
    setBusy(true)
    try {
      if (editingId) await API.put(`/api/v1/products/${editingId}`, fd)
      else await API.post('/api/v1/products', fd)
      toast.success(editingId ? 'Product updated' : 'Product created')
      reset()
      load()
    } catch (err) { toast.error(errMsg(err)) } finally { setBusy(false) }
  }

  const edit = (p) => {
    setEditingId(p._id)
    setFile(null)
    setForm({ name: p.name, description: p.description, price: String(p.price), quantity: String(p.quantity), category: p.category?._id || '', photoUrl: p.photo || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id) => {
    if (!window.confirm('Delete this product?')) return
    try {
      await API.delete(`/api/v1/products/${id}`)
      toast.success('Product deleted')
      load()
    } catch (err) { toast.error(errMsg(err)) }
  }

  return (
    <Layout title="Manage Products">
      <div className="page">
        <h3>{editingId ? 'Edit product' : 'New product'}</h3>
        <form onSubmit={submit} className="row g-2 mb-4">
          <div className="col-12 col-md-6"><input className="form-control" placeholder="Name" value={form.name} onChange={set('name')} required maxLength={120} /></div>
          <div className="col-12 col-md-6">
            <select className="form-select" value={form.category} onChange={set('category')} required>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-12"><textarea className="form-control" rows="2" placeholder="Description" value={form.description} onChange={set('description')} required maxLength={2000} /></div>
          <div className="col-6 col-md-3"><input className="form-control" type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={set('price')} required /></div>
          <div className="col-6 col-md-3"><input className="form-control" type="number" min="0" step="1" placeholder="Quantity" value={form.quantity} onChange={set('quantity')} required /></div>
          <div className="col-12 col-md-6"><input className="form-control" type="url" placeholder="Photo URL (or upload below)" value={form.photoUrl} onChange={set('photoUrl')} /></div>
          <div className="col-12 col-md-6">
            <input className="form-control" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files[0] || null)} />
            <div className="form-text">Upload max 1 MB; overrides the URL.</div>
          </div>
          <div className="col-12">
            <button className="btn btn-primary me-2" disabled={busy}>{editingId ? 'Update' : 'Create'}</button>
            {editingId && <button type="button" className="btn btn-outline-secondary" onClick={reset}>Cancel</button>}
          </div>
        </form>

        <h3>Products</h3>
        <div className="table-wrap">
          <table className="table align-middle">
            <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p._id}>
                  <td>{p.photo ? <img className="thumb" src={photoUrl(p.photo)} alt="" /> : <div className="thumb" />}</td>
                  <td>{p.name}</td>
                  <td>{p.category?.name}</td>
                  <td>${p.price.toFixed(2)}</td>
                  <td>{p.quantity}</td>
                  <td className="text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => edit(p)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => del(p._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex justify-content-center align-items-center gap-3">
          <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {data.page} of {data.totalPages}</span>
          <button className="btn btn-outline-secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </Layout>
  )
}

export default AdminProducts
