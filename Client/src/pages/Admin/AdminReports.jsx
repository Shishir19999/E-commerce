import { useState } from 'react';
import { AdminLayout, BarChart, ExportButton, HBars } from './AdminKit';
import { ErrorState, Skeleton } from '../../components/Common';
import { useFetch } from '../../lib/hooks';
import API from '../../api/client';
import { money } from '../../lib/format';

const AdminReports = () => {
  const [days, setDays] = useState(30);
  const { data: r, loading, error, reload } = useFetch(() => API.get('/api/v1/admin/reports', { params: { days } }).then((x) => x.data), [days]);
  const day = (d) => d.date.slice(5);

  const exports = r && (
    <span className="row">
      <ExportButton label="Export daily sales" filename={`sales-last-${days}-days.csv`} load={async () => r.series} columns={[['Date', (d) => d.date], ['Orders', (d) => d.orders], ['Revenue', (d) => d.revenue]]} />
      <ExportButton label="Export products" filename="top-products.csv" load={async () => r.topProducts} columns={[['Product', (p) => p.name], ['Units', (p) => p.units], ['Revenue', (p) => p.revenue]]} />
      <ExportButton label="Export sellers" filename="sales-by-seller.csv" load={async () => r.bySeller} columns={[['Seller', (s) => s.name], ['Units', (s) => s.units], ['Revenue', (s) => s.revenue]]} />
    </span>
  );

  return (
    <AdminLayout title="Reports" actions={
      <span className="row">
        {exports}
        <select className="input" style={{ width: 'auto' }} aria-label="Report period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </span>}>
      {loading && !r ? <Skeleton h={300} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="kpis">
            <div className="card kpi"><b>{money(r.summary.revenue)}</b><span>Revenue</span></div>
            <div className="card kpi"><b>{r.summary.orders}</b><span>Orders</span></div>
            <div className="card kpi"><b>{money(r.summary.averageOrder)}</b><span>Average order</span></div>
            <div className="card kpi"><b>{r.summary.units}</b><span>Units sold</span></div>
          </div>
          <div className="kpis">
            <div className="card kpi"><b>{money(r.summary.tax)}</b><span>Sales tax collected</span></div>
            <div className="card kpi"><b>{money(r.summary.shipping)}</b><span>Shipping charged</span></div>
            <div className="card kpi"><b>{money(r.summary.discounts)}</b><span>Discounts given</span></div>
            <div className="card kpi"><b>{r.summary.cancelled} / {r.summary.returned}</b><span>Cancelled / returned</span></div>
          </div>
          <div className="card"><h3>Revenue per day</h3><BarChart data={r.series} getValue={(d) => d.revenue} getLabel={day} format={(v) => `$${Math.round(v)}`} label="Revenue per day" /></div>
          <div className="grid2">
            <div className="card"><h3>Sales by category</h3><HBars rows={r.byCategory} getLabel={(c) => `${c.name} (${c.units})`} getValue={(c) => c.revenue} /></div>
            <div className="card"><h3>Sales by seller</h3><HBars rows={r.bySeller} getLabel={(s) => `${s.name} (${s.units})`} getValue={(s) => s.revenue} /></div>
          </div>
          <div className="grid2">
            <div className="card"><h3>Top products by revenue</h3><HBars rows={r.topProducts} getLabel={(p) => `${p.name} (${p.units})`} getValue={(p) => p.revenue} /></div>
            <div className="card">
              <h3>Coupon usage</h3>
              {r.coupons.length === 0 ? <p className="muted">No coupons were used in this period.</p> : (
                <table><thead><tr><th>Code</th><th>Orders</th><th className="right">Discount</th></tr></thead>
                  <tbody>{r.coupons.map((c) => <tr key={c.code}><td>{c.code}</td><td>{c.orders}</td><td className="right">{money(c.discount)}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminReports;
