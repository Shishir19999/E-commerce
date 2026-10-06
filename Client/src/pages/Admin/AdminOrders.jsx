import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify'
import Layout from '../../components/Layout'
import API, { errMsg } from '../Auth/config/API'

const STATUSES = ['Not Processed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

const AdminOrders = () => {
  const [data, setData] = useState({ orders: [], page: 1, totalPages: 1 })
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    API.get('/api/v1/orders', { params: { page, limit: 10 } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)))
  }, [page])
  useEffect(() => { load() }, [load])

  const changeStatus = async (id, status) => {
    try {
      await API.put(`/api/v1/orders/${id}/status`, { status })
      toast.success('Status updated')
      load()
    } catch (err) { toast.error(errMsg(err)) }
  }

  return (
    <Layout title="Manage Orders">
      <div className="page">
        <h3>Orders</h3>
        <div className="table-wrap">
          <table className="table align-middle">
            <thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o._id}>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td>{o.user?.name}<br /><span className="small text-muted">{o.user?.email}</span></td>
                  <td>{o.items.map((i) => `${i.name} x ${i.quantity}`).join(', ')}</td>
                  <td>${o.total.toFixed(2)}</td>
                  <td>
                    <select className="form-select form-select-sm" value={o.status} disabled={o.status === 'Cancelled'} onChange={(e) => changeStatus(o._id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
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

export default AdminOrders
