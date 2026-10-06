import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify'
import Layout from '../../components/Layout'
import API, { errMsg } from '../Auth/config/API'

const AdminCategories = () => {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null) // {id, name}

  const load = useCallback(() => {
    API.get('/api/v1/categories').then((r) => setCategories(r.data.categories || [])).catch((e) => toast.error(errMsg(e)))
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    try {
      await API.post('/api/v1/categories', { name })
      toast.success('Category created')
      setName('')
      load()
    } catch (err) { toast.error(errMsg(err)) }
  }
  const save = async () => {
    try {
      await API.put(`/api/v1/categories/${editing.id}`, { name: editing.name })
      toast.success('Category updated')
      setEditing(null)
      load()
    } catch (err) { toast.error(errMsg(err)) }
  }
  const del = async (id) => {
    if (!window.confirm('Delete this category?')) return
    try {
      await API.delete(`/api/v1/categories/${id}`)
      toast.success('Category deleted')
      load()
    } catch (err) { toast.error(errMsg(err)) }
  }

  return (
    <Layout title="Manage Categories">
      <div className="page">
        <h3>Categories</h3>
        <form className="d-flex gap-2 mb-3" style={{ maxWidth: 480 }} onSubmit={create}>
          <input className="form-control" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          <button className="btn btn-primary">Add</button>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id}>
                  <td>
                    {editing?.id === c._id
                      ? <input className="form-control form-control-sm" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      : c.name}
                  </td>
                  <td>{c.slug}</td>
                  <td className="text-nowrap">
                    {editing?.id === c._id ? (
                      <>
                        <button className="btn btn-sm btn-primary me-1" onClick={save}>Save</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setEditing({ id: c._id, name: c.name })}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => del(c._id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}

export default AdminCategories
