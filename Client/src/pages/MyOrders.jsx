import { Link, useLocation, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { BackLink, ErrorState, Img, ProductSkeletons, Skeleton, State } from '../components/Common';
import { useFetch } from '../lib/hooks';
import API, { errMsg } from '../api/client';
import { useUI } from '../context/UIContext';
import { dateTime, money, shortDate, shortId, STATUS_TONE } from '../lib/format';

const FLOW = ['Not Processed', 'Processing', 'Shipped', 'Delivered'];
const LABEL = { 'Not Processed': 'Placed' };

export const Status = ({ s }) => <span className={`pill ${STATUS_TONE[s] || ''}`}>{LABEL[s] || s}</span>;

const MyOrders = () => {
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/orders/mine').then((r) => r.data.orders), []);
  return (
    <Layout title="My orders">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>My orders</h1>
        {loading ? <ProductSkeletons n={3} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? (
          <State icon="📦" title="No orders yet" action={<Link className="btn primary" to="/shop">Start shopping</Link>}>When you place an order it will appear here.</State>
        ) : (
          <div className="stack">
            {data.map((o) => (
              <article className="card" key={o._id}>
                <div className="row between">
                  <span><b>Order #{shortId(o._id)}</b> <span className="muted small">placed {shortDate(o.createdAt)}</span></span>
                  <span className="row"><Status s={o.status} /><b>{money(o.total)}</b></span>
                </div>
                <div className="row" style={{ margin: '12px 0' }}>
                  {o.items.slice(0, 5).map((i, n) => <div key={n} title={i.name} style={{ width: 48, height: 48 }}><Img photo={i.photo} name={i.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} /></div>)}
                  {o.items.length > 5 && <span className="muted small">+{o.items.length - 5} more</span>}
                </div>
                <Link className="btn sm" to={`/orders/${o._id}`}>Track order</Link>{' '}
                <Link className="btn sm" to={`/orders/${o._id}/invoice`}>Invoice</Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export const OrderDetail = () => {
  const { id } = useParams();
  const { state } = useLocation();
  const { toast, confirm } = useUI();
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

  return (
    <Layout title={o ? `Order #${shortId(o._id)}` : 'Order'}>
      <div className="container page">
        <BackLink to="/orders">All orders</BackLink>
        {loading && !o ? <Skeleton h={260} style={{ marginTop: 16 }} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <div className="stack" style={{ marginTop: 12 }}>
            {state?.placed && <div className="card" role="status" style={{ background: 'var(--success-soft)' }}><b>Thank you! Your order has been placed.</b> A confirmation is shown here; there is no real payment in this store.</div>}
            <div className="row between"><h1 style={{ fontSize: '1.7rem', margin: 0 }}>Order #{shortId(o._id)} <Status s={o.status} /></h1>
              <span className="row no-print"><Link className="btn" to={`/orders/${o._id}/invoice`}>View invoice</Link>
                {['Not Processed', 'Processing'].includes(o.status) && o.user && <button className="btn danger" onClick={cancel}>Cancel order</button>}</span></div>
            {o.status !== 'Cancelled' && (
              <div className="progress" aria-label="Order progress">
                {FLOW.map((s, i) => <div key={s} className={i <= FLOW.indexOf(o.status) ? 'on' : ''}>{LABEL[s] || s}</div>)}
              </div>
            )}
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
                <div className="sum" style={{ marginTop: 12 }}>
                  <div><span>Subtotal</span><span>{money(o.subtotal ?? o.total)}</span></div>
                  {o.discount > 0 && <div><span>Discount {o.couponCode && `(${o.couponCode})`}</span><span>-{money(o.discount)}</span></div>}
                  <div><span>Shipping</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
                  <div className="total"><span>Total</span><span>{money(o.total)}</span></div>
                </div>
              </div>
              <div className="stack">
                <div className="card"><h3>Tracking</h3>
                  <ol className="timeline">
                    {[...o.timeline].reverse().map((t, n) => <li key={n} className={t.status === 'Cancelled' ? 'cancel' : ''}><b>{LABEL[t.status] || t.status}</b>{t.note && <span className="muted small"> &middot; {t.note}</span>}<div className="muted small">{dateTime(t.at)}</div></li>)}
                  </ol>
                </div>
                <div className="card"><h3>Delivery</h3><p className="muted">{o.shippingAddress}</p><p className="small muted">Payment: {o.payment?.status || 'n/a'}</p></div>
              </div>
            </div>
          </div>
        )}
      </div>
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
              {o.discount > 0 && <div><span>Discount</span><span>-{money(o.discount)}</span></div>}
              <div><span>Shipping</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
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
