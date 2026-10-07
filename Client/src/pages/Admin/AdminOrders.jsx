import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout, Modal } from './AdminKit';
import { Status } from '../MyOrders';
import { ErrorState, Pager, Skeleton, State } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useUI } from '../../context/UIContext';
import { dateTime, money, shortId } from '../../lib/format';

const STATUSES = ['Not Processed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const AdminOrders = () => {
  const { toast, confirm } = useUI();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState(null);
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/orders', { params: { page, limit: 10, status } }).then((r) => r.data), [page, status]);

  const save = async (e) => {
    e.preventDefault();
    if (edit.status === 'Cancelled' && edit.order.status !== 'Cancelled' && !(await confirm({ title: 'Cancel this order?', message: 'Stock is returned and the order cannot be reopened.', confirmLabel: 'Cancel order', danger: true }))) return;
    try {
      await API.put(`/api/v1/orders/${edit.order._id}/status`, { status: edit.status, note: edit.note });
      toast.success('Order updated');
      setEdit(null);
      reload();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  return (
    <AdminLayout title="Orders" actions={
      <select className="input" style={{ width: 'auto' }} aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>}>
      {loading && !data ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.orders.length === 0 ? <State icon="📭" title="No orders match" /> : (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{data.orders.map((o) => (
              <tr key={o._id}>
                <td><Link to={`/orders/${o._id}`}>#{shortId(o._id)}</Link></td><td>{o.user?.name || 'Deleted user'}</td><td>{dateTime(o.createdAt)}</td>
                <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td><td>{money(o.total)}</td><td><Status s={o.status} /></td>
                <td><button className="btn sm" onClick={() => setEdit({ order: o, status: o.status, note: '' })}>Update</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}
      {edit && (
        <Modal title={`Update order #${shortId(edit.order._id)}`} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <div className="field"><label htmlFor="o-status">Status</label>
              <select id="o-status" className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s} disabled={edit.order.status === 'Cancelled' && s !== 'Cancelled'}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="o-note">Note for the customer timeline (optional)</label><input id="o-note" className="input" maxLength={200} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setEdit(null)}>Close</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
};

export default AdminOrders;
