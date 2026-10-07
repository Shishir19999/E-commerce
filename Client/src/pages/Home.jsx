import { Link } from 'react-router-dom';
import { FaTruck, FaUndo, FaLock, FaHeadset } from 'react-icons/fa';
import Layout from '../components/Layout';
import ProductCard from '../components/ProductCard';
import { ErrorState, Img, Parallax, ProductSkeletons, Reveal } from '../components/Common';
import { useFetch } from '../lib/hooks';
import API from '../api/client';
import { fallbackArt } from '../lib/art';
import { readRecent } from '../lib/recent';

export const RecentlyViewed = ({ exclude }) => {
  const ids = readRecent().filter((id) => id !== exclude).slice(0, 4);
  const { data } = useFetch(() => (ids.length ? API.get('/api/v1/products', { params: { ids: ids.join(','), limit: 8 } }).then((r) => r.data.products) : Promise.resolve([])), [ids.join(',')]);
  if (!data?.length) return null;
  const ordered = ids.map((id) => data.find((p) => p._id === id)).filter(Boolean);
  return (
    <section className="section">
      <div className="container">
        <h2>Recently viewed</h2>
        <div className="grid">{ordered.map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}</div>
      </div>
    </section>
  );
};

const Home = () => {
  const feat = useFetch(() => API.get('/api/v1/products', { params: { featured: true, limit: 8, sort: 'popular' } }).then((r) => r.data.products), []);
  const cats = useFetch(() => API.get('/api/v1/categories').then((r) => r.data.categories), []);
  const deals = useFetch(() => API.get('/api/v1/products', { params: { sort: 'rating', limit: 4 } }).then((r) => r.data.products), []);
  const heroArt = (feat.data || []).slice(0, 4);

  return (
    <Layout title="Everyday essentials, delivered" description="Browse electronics, fashion, home and more. Filter, compare, check out and track your order.">
      <section className="hero">
        <Parallax speed={0.12} className="layer"><span className="blob" style={{ width: 380, height: 380, left: '-6%', top: '8%', background: 'rgba(255,255,255,.10)' }} /></Parallax>
        <Parallax speed={0.28} className="layer"><span className="blob" style={{ width: 240, height: 240, right: '6%', top: '20%', background: 'rgba(245,158,11,.30)' }} /><span className="blob" style={{ width: 120, height: 120, left: '42%', bottom: '12%', background: 'rgba(255,255,255,.14)' }} /></Parallax>
        <div className="container">
          <div>
            <p className="pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>New season, new arrivals</p>
            <h1>Everyday essentials, delivered to your door.</h1>
            <p>Thoughtfully chosen electronics, fashion, home and outdoor gear. Free standard shipping over $50 and easy returns.</p>
            <div className="row">
              <Link to="/shop" className="btn primary">Shop now</Link>
              <Link to="/shop?sort=popular" className="btn">Best sellers</Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            {heroArt.map((p) => <Img key={p._id} photo={p.photo} name="" />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal><h2>Shop by category</h2></Reveal>
          {cats.error ? <ErrorState message={cats.error} onRetry={cats.reload} /> : (
            <div className="cats">
              {(cats.data || Array.from({ length: 6 })).slice(0, 8).map((c, i) =>
                c ? (
                  <Reveal key={c._id} delay={(i % 4) * 70}>
                    <Link to={`/shop?category=${c.slug}`} className="band" style={{ textDecoration: 'none' }}>
                      <Parallax speed={0.1} className="bg"><img src={fallbackArt(c.name)} alt="" loading="lazy" /></Parallax>
                      <span className="shade" />
                      <span className="in-text"><h3>{c.name}</h3><span className="small">Browse &rarr;</span></span>
                    </Link>
                  </Reveal>
                ) : <div key={i} className="skel" style={{ height: 190, borderRadius: 14 }} />,
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section alt">
        <Parallax speed={0.18} className="bgdots" />
        <div className="container">
          <div className="row between"><Reveal><h2>Featured picks</h2></Reveal><Link to="/shop?featured=true">View all</Link></div>
          {feat.loading ? <ProductSkeletons n={4} /> : feat.error ? <ErrorState message={feat.error} onRetry={feat.reload} /> : (
            <div className="grid">{feat.data.slice(0, 8).map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="promo">
              <Parallax speed={0.2} className="bgdots" />
              <h2>Take 10% off your first order</h2>
              <p>Use code <b>WELCOME10</b> at checkout. Spend $150 and use <b>BIGSPEND25</b> for 25% off.</p>
              <Link to="/shop?sort=price_asc" className="btn" style={{ background: '#fff', color: '#7a1146', borderColor: '#fff' }}>Find a deal</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <h2>Top rated</h2>
          {deals.loading ? <ProductSkeletons n={4} /> : deals.data && <div className="grid">{deals.data.map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}</div>}
        </div>
      </section>

      <RecentlyViewed />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container trust">
          <div><FaTruck aria-hidden="true" /><span><b>Free shipping</b><br /><span className="muted small">On orders over $50</span></span></div>
          <div><FaUndo aria-hidden="true" /><span><b>30-day returns</b><br /><span className="muted small">No questions asked</span></span></div>
          <div><FaLock aria-hidden="true" /><span><b>Secure checkout</b><br /><span className="muted small">Your data stays private</span></span></div>
          <div><FaHeadset aria-hidden="true" /><span><b>Friendly support</b><br /><span className="muted small">We reply within a day</span></span></div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
