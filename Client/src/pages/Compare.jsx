import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ErrorState, Img, Skeleton, Stars, State } from '../components/Common';
import API from '../api/client';
import { useFetch } from '../lib/hooks';
import { useCart } from '../context/CartContext';
import { useCompare } from '../context/CompareContext';
import { useUI } from '../context/UIContext';
import { discountPct, money, sellerName } from '../lib/format';

const Compare = () => {
  const { ids, remove, clear } = useCompare();
  const { add, setOpen } = useCart();
  const { toast } = useUI();
  const navigate = useNavigate();
  const key = ids.join(',');
  const { data, loading, error, reload } = useFetch(
    () => (key ? API.get('/api/v1/products', { params: { ids: key, limit: 10 } }).then((r) => ids.map((id) => r.data.products.find((p) => p._id === id)).filter(Boolean)) : Promise.resolve([])),
    [key],
  );

  const rows = [
    ['Price', (p) => <b>{money(p.price)}{discountPct(p) > 0 && <> <s className="muted">{money(p.compareAtPrice)}</s></>}</b>],
    ['Rating', (p) => <span className="row" style={{ gap: 6 }}><Stars value={p.rating} /> <span className="small muted">{p.numReviews ? `(${p.numReviews})` : 'No reviews'}</span></span>],
    ['Category', (p) => p.category?.name || '–'],
    ['Sold by', (p) => (p.seller ? <Link to={`/shop?seller=${p.seller._id}`}>{sellerName(p.seller)}</Link> : 'ShopLane')],
    ['Availability', (p) => (p.quantity <= 0 ? <span className="pill danger">Out of stock</span> : p.quantity <= 10 ? <span className="pill warn">Only {p.quantity} left</span> : <span className="pill success">In stock</span>)],
    ['Options', (p) => (p.variants?.length ? p.variants.map((v) => `${v.name}: ${v.options.join(', ')}`).join(' | ') : 'None')],
    ['About', (p) => <span className="small">{p.description.slice(0, 140)}{p.description.length > 140 ? '…' : ''}</span>],
  ];

  return (
    <Layout title="Compare products">
      <div className="container page">
        <div className="row between">
          <h1 style={{ fontSize: '1.9rem' }}>Compare products</h1>
          {ids.length > 0 && <button className="btn sm" onClick={clear}>Clear all</button>}
        </div>
        {ids.length === 0 ? (
          <State icon="⚖️" title="Nothing to compare yet" action={<Link className="btn primary" to="/shop">Browse products</Link>}>Use the compare button on any product to line up to four products side by side.</State>
        ) : loading && !data ? <Skeleton h={320} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <div className="table-wrap">
            <table className="compare">
              <caption className="sr-only">Product comparison</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Feature</span></th>
                  {data.map((p) => (
                    <th scope="col" key={p._id}>
                      <div className="cmp-head">
                        <Link to={`/product/${p.slug}`}><Img photo={p.photo} name={p.name} /></Link>
                        <Link to={`/product/${p.slug}`} className="name">{p.name}</Link>
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="btn sm primary"
                            disabled={p.quantity <= 0}
                            onClick={() => {
                              if (p.variants?.length) return navigate(`/product/${p.slug}`);
                              add(p, 1, '');
                              toast.success(`${p.name} added to cart`);
                              setOpen(true);
                            }}
                          >{p.variants?.length ? 'Options' : 'Add to cart'}</button>
                          <button className="btn sm ghost danger" onClick={() => remove(p._id)} aria-label={`Remove ${p.name} from comparison`}>Remove</button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, cell]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {data.map((p) => <td key={p._id}>{cell(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ids.length === 1 && <p className="muted small" style={{ marginTop: 12 }}>Add at least one more product to compare.</p>}
      </div>
    </Layout>
  );
};

export default Compare;
