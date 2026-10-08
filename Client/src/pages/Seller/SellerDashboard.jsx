import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout, BarChart, HBars } from '../Admin/AdminKit';
import { ErrorState, Img, Skeleton } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';

const SellerDashboard = () => {
  const { user } = useAuth();
  const [days, setDays] = useState(14);
  const { data: s, loading, error, reload } = useFetch(() => API.get('/api/v1/seller/stats', { params: { days } }).then((r) => r.data), [days]);
  const sel = (
    <select className="input" style={{ width: 'auto' }} aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
      <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
    </select>
  );
  const day = (d) => d.date.slice(5);
  return (
    <AdminLayout title={user.storeName ? `${user.storeName}: dashboard` : 'Seller dashboard'} seller actions={sel}>
      {loading && !s ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="kpis">
            <div className="card kpi"><b>{money(s.earnings)}</b><span>Earnings after 10% fee</span></div>
            <div className="card kpi"><b>{money(s.gross)}</b><span>Gross sales</span></div>
            <div className="card kpi"><b>{s.units}</b><span>Units sold</span></div>
            <div className="card kpi"><b>{s.pending}</b><span>Orders to ship</span></div>
          </div>
          {s.pending > 0 && <p className="card" role="status">You have <b>{s.pending}</b> order{s.pending === 1 ? '' : 's'} waiting. <Link to="/seller/orders">Go to orders</Link></p>}
          {s.products === 0 && <p className="card" role="status">You have no products yet. <Link to="/seller/products">Add your first product</Link> to start selling.</p>}
          <div className="grid2">
            <div className="card"><h3>Sales per day</h3><BarChart data={s.series} getValue={(d) => d.revenue} getLabel={day} format={(v) => `$${Math.round(v)}`} label="Your sales per day" /></div>
            <div className="card"><h3>Orders per day</h3><BarChart data={s.series} getValue={(d) => d.orders} getLabel={day} label="Your orders per day" /></div>
          </div>
          <div className="grid2">
            <div className="card">
              <h3>Low stock ({s.lowStock.length})</h3>
              {s.lowStock.length === 0 ? <p className="muted">All your products are well stocked.</p> : s.lowStock.map((p) => (
                <div className="row between" key={p._id} style={{ padding: '6px 0' }}>
                  <span className="row" style={{ flexWrap: 'nowrap' }}><Img photo={p.photo} name="" style={{ width: 32, height: 32, borderRadius: 6 }} /><Link to={`/product/${p.slug}`}>{p.name}</Link></span>
                  <span className={`pill ${p.quantity === 0 ? 'danger' : 'warn'}`}>{p.quantity === 0 ? 'Out of stock' : `${p.quantity} left`}</span>
                </div>
              ))}
              <p className="small muted">Alerts at {s.lowStockThreshold} units or fewer. You also get a notification when stock runs low.</p>
            </div>
            <div className="card">
              <h3>Your best sellers</h3>
              <HBars rows={s.topProducts} getLabel={(p) => p.name} getValue={(p) => p.revenue} empty="No sales yet." />
              <h3 style={{ marginTop: 18 }}>Orders by status</h3>
              <div className="row">{Object.keys(s.ordersByStatus).length === 0 ? <span className="muted">No orders yet.</span> : Object.entries(s.ordersByStatus).map(([k, v]) => <span key={k} className="pill">{k}: {v}</span>)}</div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default SellerDashboard;
