import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaThLarge, FaList, FaFilter } from 'react-icons/fa';
import Layout from '../components/Layout';
import ProductCard from '../components/ProductCard';
import { ErrorState, Pager, ProductSkeletons, State } from '../components/Common';
import { useFetch } from '../lib/hooks';
import API from '../api/client';
import { money } from '../lib/format';

const SORTS = [['newest', 'Newest'], ['popular', 'Most popular'], ['rating', 'Top rated'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['name', 'Name A-Z']];
const PAGE_SIZE = 12;

const Shop = () => {
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
  });
  const [showFilters, setShowFilters] = useState(false);
  const cats = useFetch(() => API.get('/api/v1/categories').then((r) => r.data.categories), []);

  const q = {
    search: sp.get('search') || '', category: sp.get('category') || '', sort: sp.get('sort') || 'newest',
    maxPrice: sp.get('maxPrice') || '', minRating: sp.get('minRating') || '', inStock: sp.get('inStock') === 'true',
    featured: sp.get('featured') === 'true', page: Math.max(1, Number(sp.get('page')) || 1),
  };
  const set = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v === false || v == null ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };

  // the slider follows the pointer locally and commits to the URL after a short pause
  const [drag, setDrag] = useState(null);
  const timer = useRef(null);
  const onSlide = (e) => {
    const v = e.target.value === String(ceiling) ? '' : e.target.value;
    setDrag(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { set({ maxPrice: v }); setDrag(null); }, 300);
  };
  const sliderVal = drag ?? q.maxPrice;

  const params = { search: q.search, category: q.category, sort: q.sort, maxPrice: q.maxPrice, minRating: q.minRating, inStock: q.inStock || undefined, featured: q.featured || undefined, page: q.page, limit: PAGE_SIZE };
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/products', { params }).then((r) => r.data), [JSON.stringify(params)]);
  const ceiling = data?.maxPrice || 1000;
  const activeCat = cats.data?.find((c) => c.slug === q.category || c._id === q.category);
  const filtersOn = q.category || q.maxPrice || q.minRating || q.inStock || q.featured || q.search;

  const setViewMode = (v) => {
    setView(v);
    try { localStorage.setItem('view', v); } catch { /* storage unavailable */ }
  };
  const clear = () => setSp(new URLSearchParams(q.sort !== 'newest' ? { sort: q.sort } : {}), { replace: true });

  return (
    <Layout title={q.search ? `Search: ${q.search}` : activeCat ? activeCat.name : 'Shop'} description="Filter by category, price and rating. Sort and search across the whole catalogue.">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>{q.search ? <>Results for “{q.search}”</> : activeCat ? activeCat.name : 'All products'}</h1>
        <div className="shop">
          <aside className={`filters card ${showFilters ? 'open' : ''}`} aria-label="Filters">
            <h4>Category</h4>
            <label className="opt"><input type="radio" name="cat" checked={!q.category} onChange={() => set({ category: '' })} /> All categories</label>
            {cats.data?.map((c) => (
              <label className="opt" key={c._id}><input type="radio" name="cat" checked={q.category === c.slug} onChange={() => set({ category: c.slug })} /> {c.name}</label>
            ))}
            <h4>Max price: {money(sliderVal || ceiling)}</h4>
            <input type="range" min="5" max={ceiling} step="5" value={sliderVal || ceiling} aria-label="Maximum price" onChange={onSlide} />
            <h4>Customer rating</h4>
            {[['', 'Any rating'], ['4', '4 stars & up'], ['3', '3 stars & up']].map(([v, l]) => (
              <label className="opt" key={v}><input type="radio" name="rating" checked={q.minRating === v} onChange={() => set({ minRating: v })} /> {l}</label>
            ))}
            <h4>Availability</h4>
            <label className="opt"><input type="checkbox" checked={q.inStock} onChange={(e) => set({ inStock: e.target.checked })} /> In stock only</label>
            <label className="opt"><input type="checkbox" checked={q.featured} onChange={(e) => set({ featured: e.target.checked })} /> Featured only</label>
            {filtersOn && <button className="btn sm block" style={{ marginTop: 14 }} onClick={clear}>Clear all filters</button>}
          </aside>

          <section aria-live="polite">
            <div className="toolbar">
              <button className="btn sm filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><FaFilter /> Filters</button>
              <span className="muted small grow">{loading ? 'Loading…' : `${data?.total ?? 0} product${data?.total === 1 ? '' : 's'}`}</span>
              <label className="sr-only" htmlFor="sort">Sort by</label>
              <select id="sort" className="input" style={{ width: 'auto' }} value={q.sort} onChange={(e) => set({ sort: e.target.value })}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="seg" role="group" aria-label="Layout">
                <button aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setViewMode('grid')}><FaThLarge /></button>
                <button aria-pressed={view === 'list'} aria-label="List view" onClick={() => setViewMode('list')}><FaList /></button>
              </span>
            </div>
            {loading && !data ? <ProductSkeletons n={6} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.products.length === 0 ? (
              <State icon="🔍" title="No products match" action={<button className="btn primary" onClick={clear}>Clear filters</button>}>Try a different search or remove some filters.</State>
            ) : (
              <>
                <div className={`grid ${view === 'list' ? 'list' : ''}`} style={{ opacity: loading ? 0.6 : 1 }}>
                  {data.products.map((p, i) => <ProductCard key={p._id} p={p} index={i} list={view === 'list'} />)}
                </div>
                <Pager page={data.page} totalPages={data.totalPages} onPage={(p) => { set({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Shop;
