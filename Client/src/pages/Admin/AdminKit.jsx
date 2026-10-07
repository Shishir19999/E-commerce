import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import Layout from '../../components/Layout';

export const AdminLayout = ({ title, actions, children }) => (
  <Layout title={`Admin: ${title}`}>
    <div className="container page">
      <div className="admin">
        <nav aria-label="Admin">
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/coupons">Coupons</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
        </nav>
        <div style={{ minWidth: 0 }}>
          <div className="row between" style={{ marginBottom: 14 }}><h1 style={{ fontSize: '1.7rem', margin: 0 }}>{title}</h1>{actions}</div>
          {children}
        </div>
      </div>
    </div>
  </Layout>
);

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
