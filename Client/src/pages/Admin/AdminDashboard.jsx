import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout, BarChart } from './AdminKit';
import { ErrorState, Img, Skeleton } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API from '../../api/client';
import { money } from '../../lib/format';

const AdminDashboard = () => {
  const [days, setDays] = useState(14);
  const { data: s, loading, error, reload } = useFetch(() => API.get('/api/v1/admin/stats', { params: { days } }).then((r) => r.data), [days]);
  const sel = (
    <select className="input" style={{ width: 'auto' }} aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
      <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
    </select>
  );
  const day = (d) => d.date.slice(5);
  return (
    <AdminLayout title="Dashboard" actions={sel}>
      {loading && !s ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="kpis">
            <div className="card kpi"><b>{money(s.revenue)}</b><span>Revenue (excl. cancelled)</span></div>
            <div className="card kpi"><b>{s.orders}</b><span>Orders</span></div>
            <div className="card kpi"><b>{s.users}</b><span>Customers</span></div>
            <div className="card kpi"><b>{s.products}</b><span>Products</span></div>
          </div>
          <div className="grid2">
            <div className="card"><h3>Revenue per day</h3><BarChart data={s.series} getValue={(d) => d.revenue} getLabel={day} format={(v) => `$${Math.round(v)}`} label="Revenue per day" /></div>
            <div className="card"><h3>Orders per day</h3><BarChart data={s.series} getValue={(d) => d.orders} getLabel={day} label="Orders per day" /></div>
          </div>
          <div className="grid2">
            <div className="card">
              <h3>Low stock ({s.lowStock.length})</h3>
              {s.lowStock.length === 0 ? <p className="muted">Everything is well stocked.</p> : s.lowStock.map((p) => (
                <div className="row between" key={p._id} style={{ padding: '6px 0' }}>
                  <span className="row" style={{ flexWrap: 'nowrap' }}><Img photo={p.photo} name="" style={{ width: 32, height: 32, borderRadius: 6 }} /><Link to={`/product/${p.slug}`}>{p.name}</Link></span>
                  <span className={`pill ${p.quantity === 0 ? 'danger' : 'warn'}`}>{p.quantity === 0 ? 'Out of stock' : `${p.quantity} left`}</span>
                </div>
              ))}
              <p className="small muted">Alerts at {s.lowStockThreshold} units or fewer.</p>
            </div>
            <div className="card">
              <h3>Top sellers</h3>
              {s.topProducts.map((p, i) => <div className="row between" key={p._id} style={{ padding: '6px 0' }}><span>{i + 1}. <Link to={`/product/${p.slug}`}>{p.name}</Link></span><b>{p.sold} sold</b></div>)}
              <h3 style={{ marginTop: 18 }}>Orders by status</h3>
              <div className="row">{Object.entries(s.ordersByStatus).map(([k, v]) => <span key={k} className="pill">{k}: {v}</span>)}</div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
