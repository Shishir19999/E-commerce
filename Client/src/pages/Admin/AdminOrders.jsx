import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout, ExportButton, Modal } from './AdminKit';
import { ReturnPill, Status } from '../MyOrders';
import { ErrorState, Pager, Skeleton, State } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API, { errMsg } from '../../api/client';
import { useUI } from '../../context/UIContext';
import { fetchAll } from '../../lib/csv';
import { FLOW, SELLER_STATUSES, SETTABLE_STATUSES, ORDER_STATUSES } from '../../lib/rules';
import { dateTime, money, shortId } from '../../lib/format';

// Orders screen shared by admins (all orders) and sellers (orders that contain their products).
const AdminOrders = ({ seller = false }) => {
  const { toast, confirm } = useUI();
  const base = seller ? '/api/v1/seller/orders' : '/api/v1/orders';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [returnsOnly, setReturnsOnly] = useState(false);
  const [edit, setEdit] = useState(null);
  const [ret, setRet] = useState(null);
  const params = (p, limit) => ({ page: p, limit, status, returns: returnsOnly ? 'requested' : undefined });
  const { data, loading, error, reload } = useFetch(() => API.get(base, { params: params(page, 10) }).then((r) => r.data), [page, status, returnsOnly, base]);

  const allowed = (o) => (seller ? SELLER_STATUSES.filter((s) => FLOW.indexOf(s) > FLOW.indexOf(o.status)) : SETTABLE_STATUSES);

  const save = async (e) => {
    e.preventDefault();
    if (edit.status === 'Cancelled' && edit.order.status !== 'Cancelled' && !(await confirm({ title: 'Cancel this order?', message: 'Stock is returned and the order cannot be reopened.', confirmLabel: 'Cancel order', danger: true }))) return;
    try {
      await API.put(`/api/v1/orders/${edit.order._id}/status`, { status: edit.status, note: edit.note, trackingNumber: edit.status === 'Shipped' ? edit.tracking : undefined });
      toast.success('Order updated');
      setEdit(null);
      reload();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  const decide = async (decision) => {
    try {
      await API.put(`/api/v1/orders/${ret.order._id}/return`, { decision, note: ret.note });
      toast.success(decision === 'approve' ? 'Return approved and refunded' : 'Return declined');
      setRet(null);
      reload();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };

  const exportRows = () => fetchAll((p) => API.get(base, { params: params(p, 100) }).then((r) => r.data), 'orders');
  const columns = [
    ['Order', (o) => shortId(o._id)],
    ['Date', (o) => new Date(o.createdAt).toISOString()],
    ['Customer', (o) => o.user?.name || ''],
    ['Email', (o) => o.user?.email || ''],
    ['Status', (o) => o.status],
    ['Items', (o) => o.items.reduce((n, i) => n + i.quantity, 0)],
    ...(seller
      ? [['Your items', (o) => o.sellerSubtotal], ['Your earnings', (o) => o.sellerEarnings]]
      : [['Subtotal', (o) => o.subtotal], ['Discount', (o) => o.discount], ['Shipping', (o) => o.shipping], ['Tax', (o) => o.tax || 0], ['Total', (o) => o.total]]),
    ['Return', (o) => o.returnRequest?.status || ''],
    ['Tracking', (o) => o.trackingNumber || ''],
  ];

  return (
    <AdminLayout title="Orders" seller={seller} actions={
      <span className="row">
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={returnsOnly} onChange={(e) => { setReturnsOnly(e.target.checked); setPage(1); }} /> Open returns only</label>
        <select className="input" style={{ width: 'auto' }} aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <ExportButton filename={seller ? 'seller-orders.csv' : 'orders.csv'} load={exportRows} columns={columns} />
      </span>}>
      {loading && !data ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.orders.length === 0 ? <State icon="📭" title="No orders match" /> : (
        <>
          <div className="table-wrap"><table>
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>{seller ? 'Your earnings' : 'Total'}</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{data.orders.map((o) => (
              <tr key={o._id}>
                <td><Link to={`/orders/${o._id}`}>#{shortId(o._id)}</Link></td><td>{o.user?.name || 'Deleted user'}</td><td>{dateTime(o.createdAt)}</td>
                <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td><td>{money(seller ? o.sellerEarnings : o.total)}</td>
                <td><span className="row" style={{ gap: 6 }}><Status s={o.status} /><ReturnPill r={o.returnRequest} /></span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {allowed(o).length > 0 && !['Cancelled', 'Returned'].includes(o.status) && <button className="btn sm" onClick={() => setEdit({ order: o, status: seller ? allowed(o)[0] : o.status, note: '', tracking: o.trackingNumber || '' })} aria-label={`Update order ${shortId(o._id)}`}>Update</button>}{' '}
                  {o.returnRequest?.status === 'requested' && <button className="btn sm primary" onClick={() => setRet({ order: o, note: '' })} aria-label={`Review return for order ${shortId(o._id)}`}>Review return</button>}
                </td>
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
              <select id="o-status" className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{allowed(edit.order).map((s) => <option key={s}>{s}</option>)}</select></div>
            {edit.status === 'Shipped' && (
              <div className="field"><label htmlFor="o-track">Tracking number (optional)</label><input id="o-track" className="input" maxLength={40} value={edit.tracking} onChange={(e) => setEdit({ ...edit, tracking: e.target.value })} placeholder="TRK-123456" /></div>
            )}
            <div className="field"><label htmlFor="o-note">Note for the customer timeline (optional)</label><input id="o-note" className="input" maxLength={200} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setEdit(null)}>Close</button><button className="btn primary">Save</button></div>
          </form>
        </Modal>
      )}
      {ret && (
        <Modal title={`Return request for #${shortId(ret.order._id)}`} onClose={() => setRet(null)}>
          <p><b>Customer reason</b><br /><span className="muted">{ret.order.returnRequest.reason}</span></p>
          <p className="small muted">Approving puts the items back into stock and refunds the order. {seller ? 'Only your own items are listed here, the whole order is refunded.' : ''}</p>
          <div className="field"><label htmlFor="r-note">Note to the customer (optional)</label><input id="r-note" className="input" maxLength={200} value={ret.note} onChange={(e) => setRet({ ...ret, note: e.target.value })} /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setRet(null)}>Close</button>
            <button className="btn danger" onClick={() => decide('reject')}>Decline</button>
            <button className="btn primary" onClick={() => decide('approve')}>Approve and refund</button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};

export default AdminOrders;
