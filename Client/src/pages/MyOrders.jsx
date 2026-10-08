import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Modal } from './Admin/AdminKit';
import { BackLink, ErrorState, Img, ProductSkeletons, Skeleton, State } from '../components/Common';
import { useFetch } from '../lib/hooks';
import API, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { deliveryWindow } from '../lib/pricing';
import { CANCELLABLE, FLOW, RETURN_WINDOW_DAYS, returnEligibility } from '../lib/rules';
import { dateTime, money, shortDate, shortId, STATUS_TONE } from '../lib/format';

const LABEL = { 'Not Processed': 'Placed' };
const BAD_STEP = ['Cancelled', 'Return rejected'];

export const Status = ({ s }) => <span className={`pill ${STATUS_TONE[s] || ''}`}>{LABEL[s] || s}</span>;

export const ReturnPill = ({ r }) =>
  r?.status ? <span className={`pill ${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warn'}`}>Return {r.status}</span> : null;

// puts the items of an old order back into the cart (current prices and stock apply)
const useReorder = () => {
  const { add, setOpen } = useCart();
  const { toast } = useUI();
  return async (order) => {
    try {
      const ids = [...new Set(order.items.map((i) => i.product))].join(',');
      const { data } = await API.get('/api/v1/products', { params: { ids, limit: 50 } });
      let n = 0;
      for (const it of order.items) {
        const p = data.products.find((x) => x._id === it.product);
        if (!p || p.quantity <= 0) continue;
        add(p, Math.min(it.quantity, p.quantity), it.variant || '');
        n += 1;
      }
      if (!n) return toast.error('None of these items are available right now');
      toast.success(n === order.items.length ? 'Items added to your cart' : `${n} of ${order.items.length} items added (the rest are unavailable)`);
      setOpen(true);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
};

const MyOrders = () => {
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/orders/mine').then((r) => r.data.orders), []);
  const reorder = useReorder();
  return (
    <Layout title="My orders">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>My orders</h1>
        {loading ? <ProductSkeletons n={3} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? (
          <State icon="📦" title="No orders yet" action={<Link className="btn primary" to="/shop">Start shopping</Link>}>When you place an order it will appear here.</State>
        ) : (
          <div className="stack">
            {data.map((o) => (
              <article className="card" key={o._id} aria-label={`Order ${shortId(o._id)}`}>
                <div className="row between">
                  <span><b>Order #{shortId(o._id)}</b> <span className="muted small">placed {shortDate(o.createdAt)}</span></span>
                  <span className="row"><ReturnPill r={o.returnRequest} /><Status s={o.status} /><b>{money(o.total)}</b></span>
                </div>
                <div className="row" style={{ margin: '12px 0' }}>
                  {o.items.slice(0, 5).map((i, n) => <div key={n} title={i.name} style={{ width: 48, height: 48 }}><Img photo={i.photo} name={i.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} /></div>)}
                  {o.items.length > 5 && <span className="muted small">+{o.items.length - 5} more</span>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Link className="btn sm" to={`/orders/${o._id}`}>Track order</Link>
                  <Link className="btn sm" to={`/orders/${o._id}/invoice`}>Invoice</Link>
                  <button className="btn sm" onClick={() => reorder(o)}>Buy again</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const ReturnDialog = ({ order, onClose, onDone }) => {
  const { toast } = useUI();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) return setErr('Tell us why you are returning it (at least 5 characters)');
    setBusy(true);
    try {
      await API.post(`/api/v1/orders/${order._id}/return`, { reason });
      toast.success('Return requested');
      onDone();
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Request a return" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="muted small">Returns are accepted for {RETURN_WINDOW_DAYS} days after delivery. Approved returns go back into stock and the order is refunded.</p>
        <div className="field">
          <label htmlFor="ret-reason">Why are you returning this order?</label>
          <textarea id="ret-reason" className="input" rows="3" maxLength={300} value={reason} aria-invalid={Boolean(err)} onChange={(e) => { setReason(e.target.value); setErr(''); }} />
          {err && <span className="err" role="alert">{err}</span>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={onClose}>Close</button><button className="btn primary" disabled={busy}>Send request</button></div>
      </form>
    </Modal>
  );
};

export const OrderDetail = () => {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const reorder = useReorder();
  const [returning, setReturning] = useState(false);
  const { data: o, loading, error, reload } = useFetch(() => API.get(`/api/v1/orders/${id}`).then((r) => r.data.order), [id]);

  const cancel = async () => {
    if (!(await confirm({ title: 'Cancel this order?', message: 'Items go back into stock and the order cannot be reopened.', confirmLabel: 'Cancel order', danger: true }))) return;
    try {
      await API.post(`/api/v1/orders/${id}/cancel`);
      toast.success('Order cancelled');
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const mine = o && (o.user?._id || o.user) === user?._id;
  const el = o ? returnEligibility(o) : null;
  const partial = o && o.sellerSubtotal !== undefined; // a seller sees only their own lines
  const eta = o && !['Delivered', 'Cancelled', 'Returned'].includes(o.status) ? deliveryWindow(o.shippingMethod, o.createdAt) : null;

  return (
    <Layout title={o ? `Order #${shortId(o._id)}` : 'Order'}>
      <div className="container page">
        <BackLink to={user?.role === 2 ? '/seller/orders' : '/orders'}>{user?.role === 2 ? 'Seller orders' : 'All orders'}</BackLink>
        {loading && !o ? <Skeleton h={260} style={{ marginTop: 16 }} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <div className="stack" style={{ marginTop: 12 }}>
            {state?.placed && <div className="card" role="status" style={{ background: 'var(--success-soft)' }}><b>Thank you! Your order has been placed.</b> A confirmation is shown here; no real payment is taken in this store.</div>}
            <div className="row between"><h1 style={{ fontSize: '1.7rem', margin: 0 }}>Order #{shortId(o._id)} <Status s={o.status} /> <ReturnPill r={o.returnRequest} /></h1>
              <span className="row no-print">
                {mine && <Link className="btn" to={`/orders/${o._id}/invoice`}>View invoice</Link>}
                {mine && <button className="btn" onClick={() => reorder(o)}>Buy again</button>}
                {mine && CANCELLABLE.includes(o.status) && <button className="btn danger" onClick={cancel}>Cancel order</button>}
                {mine && o.status === 'Delivered' && (el.ok ? <button className="btn" onClick={() => setReturning(true)}>Return items</button> : !o.returnRequest?.status && <span className="muted small">{el.reason}</span>)}
              </span></div>
            {partial && <div className="card" role="note">You are viewing the items from your store in this order. Your earnings after the 10% platform fee: <b>{money(o.sellerEarnings)}</b>.</div>}
            {o.returnRequest?.status && (
              <div className="card" role="status">
                <b>Return {o.returnRequest.status}.</b> <span className="muted">Reason: {o.returnRequest.reason}</span>
                {o.returnRequest.note && <div className="small muted">Store note: {o.returnRequest.note}</div>}
                {o.returnRequest.status === 'requested' && <div className="small muted">We will review it shortly and notify you.</div>}
              </div>
            )}
            {!['Cancelled', 'Returned'].includes(o.status) && (
              <div className="progress" aria-label="Order progress">
                {FLOW.map((s, i) => <div key={s} className={i <= FLOW.indexOf(o.status) ? 'on' : ''}>{LABEL[s] || s}</div>)}
              </div>
            )}
            {eta && <p className="muted" style={{ margin: 0 }}>Estimated delivery: <b>{shortDate(eta[0])}{eta[1] > eta[0] ? ` to ${shortDate(eta[1])}` : ''}</b></p>}
            {o.trackingNumber && <p style={{ margin: 0 }}>Tracking number: <b>{o.trackingNumber}</b></p>}
            <div className="layout2">
              <div className="card">
                <h3>Items</h3>
                {o.items.map((i, n) => (
                  <div className="line" key={n}>
                    <Img photo={i.photo} name={i.name} />
                    <div><b>{i.name}</b>{i.variant && <div className="small muted">{i.variant}</div>}<div className="small muted">{money(i.price)} &times; {i.quantity}</div></div>
                    <b>{money(i.price * i.quantity)}</b>
                  </div>
                ))}
                {!partial && (
                  <div className="sum" style={{ marginTop: 12 }}>
                    <div><span>Subtotal</span><span>{money(o.subtotal ?? o.total)}</span></div>
                    {o.discount > 0 && <div><span>Discount {o.couponCode && `(${o.couponCode})`}</span><span>-{money(o.discount)}</span></div>}
                    <div><span>Shipping</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
                    {o.tax > 0 && <div><span>Sales tax</span><span>{money(o.tax)}</span></div>}
                    <div className="total"><span>Total</span><span>{money(o.total)}</span></div>
                  </div>
                )}
                {partial && <div className="sum" style={{ marginTop: 12 }}><div><span>Your items</span><span>{money(o.sellerSubtotal)}</span></div><div className="total"><span>Your earnings</span><span>{money(o.sellerEarnings)}</span></div></div>}
              </div>
              <div className="stack">
                <div className="card"><h3>Tracking</h3>
                  <ol className="timeline">
                    {[...o.timeline].reverse().map((t, n) => <li key={n} className={BAD_STEP.includes(t.status) ? 'cancel' : ''}><b>{LABEL[t.status] || t.status}</b>{t.note && <span className="muted small"> &middot; {t.note}</span>}<div className="muted small">{dateTime(t.at)}</div></li>)}
                  </ol>
                </div>
                <div className="card"><h3>Delivery</h3>{!mine && o.user?.name && <p><b>{o.user.name}</b></p>}<p className="muted">{o.shippingAddress}</p><p className="small muted">Payment: {o.payment?.status || 'n/a'}</p></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {returning && <ReturnDialog order={o} onClose={() => setReturning(false)} onDone={() => { setReturning(false); reload(); }} />}
    </Layout>
  );
};

export const Invoice = () => {
  const { id } = useParams();
  const { data: o, loading, error, reload } = useFetch(() => API.get(`/api/v1/orders/${id}`).then((r) => r.data.order), [id]);
  return (
    <Layout title="Invoice">
      <div className="container page" style={{ maxWidth: 820 }}>
        <div className="row between no-print" style={{ marginBottom: 14 }}><BackLink to={`/orders/${id}`}>Back to order</BackLink><button className="btn primary" onClick={() => window.print()}>Print invoice</button></div>
        {loading ? <Skeleton h={400} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <div className="invoice">
            <div className="row between"><h1 style={{ margin: 0 }}>Invoice</h1><div className="right"><b>ShopLane</b><br />1 Market Street<br />Springfield<br /><span>billing@example.com</span></div></div>
            <hr />
            <div className="row between"><div><b>Bill to</b><br />{o.user?.name || ''}<br />{o.shippingAddress}</div><div className="right">Invoice #{shortId(o._id)}<br />Date: {shortDate(o.createdAt)}<br />Status: {o.status}<br />Payment: {o.payment?.status}</div></div>
            <table style={{ marginTop: 18 }}>
              <thead><tr><th>Item</th><th className="right">Price</th><th className="right">Qty</th><th className="right">Amount</th></tr></thead>
              <tbody>{o.items.map((i, n) => <tr key={n}><td>{i.name}{i.variant && ` (${i.variant})`}</td><td className="right">{money(i.price)}</td><td className="right">{i.quantity}</td><td className="right">{money(i.price * i.quantity)}</td></tr>)}</tbody>
            </table>
            <div className="sum" style={{ marginLeft: 'auto', maxWidth: 280, marginTop: 14 }}>
              <div><span>Subtotal</span><span>{money(o.subtotal ?? o.total)}</span></div>
              {o.discount > 0 && <div><span>Discount{o.couponCode && ` (${o.couponCode})`}</span><span>-{money(o.discount)}</span></div>}
              <div><span>Shipping</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
              {o.tax > 0 && <div><span>Sales tax (8%)</span><span>{money(o.tax)}</span></div>}
              <div className="total"><span>Total</span><span>{money(o.total)}</span></div>
            </div>
            <p className="small" style={{ marginTop: 24 }}>Thank you for shopping with ShopLane.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyOrders;
