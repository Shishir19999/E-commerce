import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaStar, FaRegStar } from 'react-icons/fa';
import { photoUrl } from '../api/client';
import { fallbackArt } from '../lib/art';
import { watchParallax, watchReveal } from '../lib/motion';

export const Stars = ({ value = 0, size = 14 }) => (
  <span className="stars" role="img" aria-label={`${Number(value).toFixed(1)} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (n <= Math.round(value) ? <FaStar key={n} size={size} /> : <FaRegStar key={n} size={size} className="off" />))}
  </span>
);

export const Img = ({ photo, name, ...rest }) => {
  const [failed, setFailed] = useState(false);
  const src = failed ? fallbackArt(name) : photoUrl(photo, name);
  return <img src={src} alt={name || ''} loading="lazy" decoding="async" onError={() => setFailed(true)} {...rest} />;
};

export const Skeleton = ({ h = 16, w = '100%', style }) => <div className="skel" style={{ height: h, width: w, ...style }} aria-hidden="true" />;

export const ProductSkeletons = ({ n = 8 }) => (
  <div className="grid" aria-busy="true" aria-label="Loading products">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="pcard">
        <Skeleton h={0} style={{ aspectRatio: '1', height: 'auto' }} />
        <div className="body"><Skeleton h={12} w="40%" /><Skeleton h={16} /><Skeleton h={16} w="60%" /></div>
      </div>
    ))}
  </div>
);

export const State = ({ icon = '🧺', title, children, action }) => (
  <div className="state">
    <div className="art" aria-hidden="true">{icon}</div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const ErrorState = ({ message = 'Something went wrong', onRetry }) => (
  <State icon="⚠️" title="We could not load this" action={onRetry && <button className="btn primary" onClick={onRetry}>Try again</button>}>{message}</State>
);

// Fades/slides children in when scrolled into view (disabled by reduced motion and small/low-power screens)
export const Reveal = ({ as: Tag = 'div', delay = 0, children, ...rest }) => {
  const ref = useRef(null);
  useEffect(() => watchReveal(ref.current, delay), [delay]);
  return <Tag ref={ref} {...rest}>{children}</Tag>;
};

// Moves its content relative to the parent frame while scrolling. The parent must clip overflow.
export const Parallax = ({ speed = 0.15, className = '', children, ...rest }) => {
  const ref = useRef(null);
  useEffect(() => watchParallax(ref.current), []);
  return (
    <div ref={ref} data-parallax={speed} className={className} aria-hidden="true" {...rest}>
      {children}
    </div>
  );
};

export const Pager = ({ page, totalPages, onPage }) => {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let p = 1; p <= totalPages; p++) if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      {pages.map((p, i) => (
        <span key={p} className="row" style={{ gap: 6 }}>
          {i > 0 && pages[i - 1] !== p - 1 && <span aria-hidden="true">…</span>}
          <button className={`btn sm ${p === page ? 'primary' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>{p}</button>
        </span>
      ))}
      <button className="btn sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
};

export const BackLink = ({ to, children }) => <Link to={to} className="muted small">&larr; {children}</Link>;
