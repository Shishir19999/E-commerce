import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import Layout from '../components/Layout';
import ProductCard from '../components/ProductCard';
import { ErrorState, Img, Skeleton, Stars } from '../components/Common';
import { useFetch } from '../lib/hooks';
import { RecentlyViewed } from './Home';
import API, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useWishlist } from '../context/WishlistContext';
import { discountPct, money, shortDate } from '../lib/format';
import { pushRecent } from '../lib/recent';

const Gallery = ({ product }) => {
  const imgs = [product.photo, ...(product.images || [])].filter(Boolean);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div>
      <div className={`zoom ${zoom ? 'on' : ''}`} onMouseMove={move} onMouseEnter={() => setZoom(true)} onMouseLeave={() => setZoom(false)} onClick={() => setZoom((z) => !z)} title="Hover or tap to zoom">
        <Img photo={imgs[i]} name={product.name} loading="eager" />
      </div>
      {imgs.length > 1 && (
        <div className="thumbs" role="group" aria-label="Product images">
          {imgs.map((im, n) => (
            <button key={n} aria-label={`Show image ${n + 1}`} aria-current={n === i} onClick={() => setI(n)}><Img photo={im} name="" /></button>
          ))}
        </div>
      )}
    </div>
  );
};

const ReviewForm = ({ product, mine, onSaved }) => {
  const { toast } = useUI();
  const [rating, setRating] = useState(mine?.rating || 0);
  const [comment, setComment] = useState(mine?.comment || '');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setErr('Choose a star rating');
    try {
      await API.post('/api/v1/reviews', { product: product._id, rating, comment });
      toast.success('Thanks for your review');
      setErr('');
      onSaved();
    } catch (x) {
      setErr(errMsg(x));
    }
  };
  return (
    <form className="card" onSubmit={submit} noValidate>
      <h3>{mine ? 'Update your review' : 'Write a review'}</h3>
      <div className="star-input" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>)}
      </div>
      <div className="field"><label htmlFor="rc">Comment (optional)</label><textarea id="rc" className="input" rows="3" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn primary">{mine ? 'Update review' : 'Submit review'}</button>
    </form>
  );
};

const Reviews = ({ product, onChange }) => {
  const { user, token } = useAuth();
  const { toast, confirm } = useUI();
  const { data, reload } = useFetch(() => API.get('/api/v1/reviews', { params: { product: product._id } }).then((r) => r.data.reviews), [product._id]);
  const mine = data?.find((r) => r.user === user?._id);
  const refresh = async () => {
    reload();
    onChange();
  };
  const del = async (r) => {
    if (!(await confirm({ title: 'Delete review?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await API.delete(`/api/v1/reviews/${r._id}`);
      toast.success('Review deleted');
      refresh();
    } catch (x) {
      toast.error(errMsg(x));
    }
  };
  const dist = [5, 4, 3, 2, 1].map((n) => [n, (data || []).filter((r) => r.rating === n).length]);

  return (
    <section aria-labelledby="rev-h" className="stack">
      <h2 id="rev-h">Customer reviews</h2>
      <div className="layout2">
        <div className="stack">
          {!data ? <Skeleton h={80} /> : data.length === 0 ? <p className="muted">No reviews yet. Be the first to share your thoughts.</p> : data.map((r) => (
            <article key={r._id} className="card">
              <div className="row between"><span><Stars value={r.rating} /> <b>{r.userName}</b>{r.verified && <span className="pill success" style={{ marginLeft: 8 }}>Verified purchase</span>}</span><span className="muted small">{shortDate(r.createdAt)}</span></div>
              {r.comment && <p style={{ margin: '8px 0 0' }}>{r.comment}</p>}
              {(r.user === user?._id || user?.role === 1) && <button className="btn sm ghost danger" onClick={() => del(r)}>Delete</button>}
            </article>
          ))}
        </div>
        <div className="stack">
          <div className="card bars" aria-label="Rating breakdown">
            <div className="row between"><b style={{ fontSize: '1.6rem' }}>{product.rating ? product.rating.toFixed(1) : '–'}</b><span className="muted small">{product.numReviews} review{product.numReviews === 1 ? '' : 's'}</span></div>
            {dist.map(([n, c]) => (
              <div className="bar" key={n}><span>{n} star</span><div className="track"><div className="fill" style={{ width: `${data?.length ? (c / data.length) * 100 : 0}%` }} /></div><span>{c}</span></div>
            ))}
          </div>
          {token ? (
            <ReviewForm key={`${mine?._id}-${mine?.rating}-${mine?.comment}`} product={product} mine={mine} onSaved={refresh} />
          ) : <p className="card small">Please <Link to="/login" state={{ from: `/product/${product.slug}` }}>sign in</Link> to write a review.</p>}
        </div>
      </div>
    </section>
  );
};

const ProductDetails = () => {
  const { slug } = useParams();
  return <ProductPage key={slug} slug={slug} />; // remount per product so selection state resets
};

const ProductPage = ({ slug }) => {
  const navigate = useNavigate();
  const { add, setOpen } = useCart();
  const { ids, toggle } = useWishlist();
  const { toast } = useUI();
  const { data: product, loading, error, reload } = useFetch(() => API.get(`/api/v1/products/${slug}`).then((r) => r.data.product), [slug]);
  const related = useFetch(() => API.get(`/api/v1/products/${slug}/related`).then((r) => r.data.products), [slug]);
  const [sel, setSel] = useState({});
  const [qty, setQty] = useState(1);
  const [vErr, setVErr] = useState('');

  useEffect(() => {
    if (product) pushRecent(product._id);
  }, [product]);

  if (loading && !product) return <Layout title="Loading"><div className="container page"><div className="pdp"><Skeleton h={420} /><div className="stack"><Skeleton h={30} w="70%" /><Skeleton h={20} w="30%" /><Skeleton h={90} /></div></div></div></Layout>;
  if (error || !product)
    return <Layout title="Product not found"><div className="container page"><ErrorState message={error || 'This product does not exist.'} onRetry={error ? reload : undefined} /><p className="center"><Link to="/shop">Back to the shop</Link></p></div></Layout>;

  const out = product.quantity <= 0;
  const off = discountPct(product);
  const wished = ids.includes(product._id);
  const variantLabel = () => (product.variants || []).map((v) => `${v.name}: ${sel[v.name]}`).join(', ');
  const missing = (product.variants || []).find((v) => !sel[v.name]);

  const addToCart = (go) => {
    if (missing) return setVErr(`Choose a ${missing.name.toLowerCase()}`);
    add(product, qty, variantLabel());
    toast.success('Added to cart');
    if (go) navigate('/checkout');
    else setOpen(true);
  };

  return (
    <Layout title={product.name} description={product.description.slice(0, 150)}>
      <div className="container page stack" style={{ display: 'grid', gap: 36, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <nav className="small muted" aria-label="Breadcrumb"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link>{product.category && <> / <Link to={`/shop?category=${product.category.slug}`}>{product.category.name}</Link></>}</nav>
        <div className="pdp">
          <Gallery key={product._id} product={product} />
          <div className="stack">
            <h1 style={{ fontSize: '2rem' }}>{product.name}</h1>
            <div className="row"><Stars value={product.rating} size={18} /><a href="#rev-h" className="small">{product.numReviews} review{product.numReviews === 1 ? '' : 's'}</a><span className="muted small">{product.sold} sold</span></div>
            <p style={{ fontSize: '1.7rem' }} className="price">{money(product.price)}{off > 0 && <><s>{money(product.compareAtPrice)}</s> <span className="pill sale">Save {off}%</span></>}</p>
            <p>{product.description}</p>
            {(product.variants || []).map((v) => (
              <fieldset key={v.name} style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small"><b>{v.name}</b>{sel[v.name] ? `: ${sel[v.name]}` : ''}</legend>
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  {v.options.map((o) => <button key={o} type="button" className="chip" aria-pressed={sel[v.name] === o} onClick={() => { setSel({ ...sel, [v.name]: o }); setVErr(''); }}>{o}</button>)}
                </div>
              </fieldset>
            ))}
            {vErr && <div className="err" role="alert">{vErr}</div>}
            <p className="small">{out ? <span className="pill danger">Out of stock</span> : product.quantity <= 10 ? <span className="pill warn">Only {product.quantity} left in stock</span> : <span className="pill success">In stock</span>}</p>
            <div className="row">
              <span className="stepper" role="group" aria-label="Quantity">
                <button aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>&minus;</button><span>{qty}</span>
                <button aria-label="Increase quantity" disabled={qty >= product.quantity} onClick={() => setQty(qty + 1)}>+</button>
              </span>
              <button className="btn primary" disabled={out} onClick={() => addToCart(false)}>Add to cart</button>
              <button className="btn" disabled={out} onClick={() => addToCart(true)}>Buy now</button>
              <button className="btn" aria-pressed={wished} onClick={async () => { if (!(await toggle(product._id))) { toast('Sign in to save items to your wishlist'); navigate('/login', { state: { from: `/product/${product.slug}` } }); } }}>
                {wished ? <FaHeart color="#e11d48" /> : <FaRegHeart />} {wished ? 'Saved' : 'Wishlist'}
              </button>
            </div>
            <p className="small muted">Free standard shipping over $50. 30-day returns.</p>
          </div>
        </div>
        <Reviews product={product} onChange={reload} />
        {related.data?.length > 0 && (
          <section><h2>You may also like</h2><div className="grid">{related.data.map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}</div></section>
        )}
      </div>
      <RecentlyViewed exclude={product._id} />
    </Layout>
  );
};

export default ProductDetails;
