import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useUI } from '../../context/UIContext';
import { downloadCsv, toCsv } from '../../lib/csv';
import { errMsg } from '../../api/client';
import { money } from '../../lib/format';

export const AdminLayout = ({ title, actions, children, seller = false }) => (
  <Layout title={`${seller ? 'Seller' : 'Admin'}: ${title}`}>
    <div className="container page">
      <div className="admin">
        {seller ? (
          <nav aria-label="Seller">
            <NavLink to="/seller" end>Dashboard</NavLink>
            <NavLink to="/seller/products">My products</NavLink>
            <NavLink to="/seller/orders">Orders</NavLink>
          </nav>
        ) : (
          <nav aria-label="Admin">
            <NavLink to="/admin" end>Dashboard</NavLink>
            <NavLink to="/admin/reports">Reports</NavLink>
            <NavLink to="/admin/products">Products</NavLink>
            <NavLink to="/admin/categories">Categories</NavLink>
            <NavLink to="/admin/orders">Orders</NavLink>
            <NavLink to="/admin/coupons">Coupons</NavLink>
            <NavLink to="/admin/users">Users</NavLink>
          </nav>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="row between" style={{ marginBottom: 14 }}><h1 style={{ fontSize: '1.7rem', margin: 0 }}>{title}</h1>{actions}</div>
          {children}
        </div>
      </div>
    </div>
  </Layout>
);

// Downloads the rows returned by load() as a CSV file
export const ExportButton = ({ filename, load, columns, label = 'Export CSV' }) => {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const rows = await load();
      downloadCsv(filename, toCsv(rows, columns));
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast.error(errMsg(e, 'Export failed'));
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" className="btn sm" disabled={busy} onClick={run}>{busy ? 'Exporting…' : label}</button>;
};

// Ranked horizontal bars (a readable alternative to a pie chart); the numbers are always printed next to the bars.
export const HBars = ({ rows, getLabel, getValue, format = money, empty = 'Nothing to show yet.' }) => {
  const max = Math.max(1, ...rows.map(getValue));
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="hbars">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="lbl">{getLabel(r)}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${(getValue(r) / max) * 100}%` }} /></span>
          <b>{format(getValue(r))}</b>
        </li>
      ))}
    </ul>
  );
};

export const Modal = ({ title, onClose, wide, children }) => {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between"><h3 style={{ margin: 0 }}>{title}</h3><button className="icon-btn" ref={ref} aria-label="Close" onClick={onClose}>&times;</button></div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
};

export const TextField = ({ id, label, error, hint, as: Tag = 'input', ...rest }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <Tag id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-e` : undefined} {...rest} />
    {hint && !error && <span className="hint">{hint}</span>}
    {error && <span className="err" id={`${id}-e`} role="alert">{error}</span>}
  </div>
);

// Bar chart drawn as SVG; values are summarised in a visually hidden table-like label for screen readers.
export const BarChart = ({ data, getValue, getLabel, format = String, label }) => {
  const W = 560;
  const H = 180;
  const max = Math.max(1, ...data.map(getValue));
  const bw = W / data.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`${label}: ${data.map((d) => `${getLabel(d)} ${format(getValue(d))}`).join(', ')}`}>
      {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} className="grid" x1="0" x2={W} y1={H - H * t} y2={H - H * t} />)}
      {data.map((d, i) => {
        const h = (getValue(d) / max) * H;
        return (
          <g key={i}>
            <rect className="bar" x={i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={Math.max(h, 1)} rx="3"><title>{`${getLabel(d)}: ${format(getValue(d))}`}</title></rect>
            {(data.length <= 10 || i % 2 === 0) && <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle">{getLabel(d)}</text>}
          </g>
        );
      })}
      <text x="2" y="10">{format(max)}</text>
    </svg>
  );
};
