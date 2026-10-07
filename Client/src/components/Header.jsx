import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { FaShoppingBag, FaSearch, FaMoon, FaSun, FaUser, FaBars, FaHeart } from 'react-icons/fa';
import API from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';
import { useWishlist } from '../context/WishlistContext';
import { Img } from './Common';
import { useDebounced } from '../lib/hooks';
import { money } from '../lib/format';

const SearchBox = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const debounced = useDebounced(q.trim(), 220);
  const box = useRef(null);
  const shown = debounced.length >= 2 ? results : [];

  useEffect(() => {
    let live = true;
    if (debounced.length < 2) return;
    API.get('/api/v1/products', { params: { search: debounced, limit: 5, sort: 'popular' } })
      .then((r) => live && setResults(r.data.products || []))
      .catch(() => live && setResults([]));
    return () => {
      live = false;
    };
  }, [debounced]);

  useEffect(() => {
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const go = (path) => {
    setOpen(false);
    setQ('');
    navigate(path);
  };
  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && shown[active]) return go(`/product/${shown[active].slug}`);
    if (q.trim()) go(`/shop?search=${encodeURIComponent(q.trim())}`);
  };
  const key = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Escape') setOpen(false);
  };
  const show = open && debounced.length >= 2;

  return (
    <form className="search" role="search" onSubmit={submit} ref={box}>
      <FaSearch aria-hidden="true" />
      <input
        className="input" type="search" placeholder="Search products" aria-label="Search products" value={q} autoComplete="off"
        role="combobox" aria-expanded={show} aria-controls="suggest-list" aria-autocomplete="list" aria-activedescendant={active >= 0 ? `sg-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={key}
      />
      {show && (
        <ul className="suggest" id="suggest-list" role="listbox">
          {shown.length === 0 && <li className="muted small" style={{ padding: 10 }}>No matches for “{debounced}”</li>}
          {shown.map((p, i) => (
            <li key={p._id} role="option" id={`sg-${i}`} aria-selected={i === active}>
              <Link to={`/product/${p.slug}`} onClick={() => go(`/product/${p.slug}`)}>
                <Img photo={p.photo} name="" />
                <span className="grow">{p.name}</span><b>{money(p.price)}</b>
              </Link>
            </li>
          ))}
          {shown.length > 0 && <li><button type="button" onClick={() => go(`/shop?search=${encodeURIComponent(q.trim())}`)}>See all results for “{debounced}”</button></li>}
        </ul>
      )}
    </form>
  );
};

const UserMenu = () => {
  const { user, logout, isAdmin } = useAuth();
  const { toast } = useUI();
  const loc = useLocation();
  const [openAt, setOpenAt] = useState(null); // the page the menu was opened on; navigating closes it
  const open = openAt === loc.pathname;
  const setOpen = (v) => setOpenAt(v ? loc.pathname : null);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && setOpenAt(null);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  if (!user) return <Link to="/login" className="btn sm primary">Sign in</Link>;
  return (
    <div className="menu" ref={ref}>
      <button className="icon-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><FaUser /></button>
      {open && (
        <div className="menu-pop" role="menu">
          <span className="small muted" style={{ padding: '6px 12px' }}>Signed in as<br /><b style={{ color: 'var(--text)' }}>{user.name}</b></span>
          <hr />
          <Link to="/orders" role="menuitem">My orders</Link>
          <Link to="/wishlist" role="menuitem">Wishlist</Link>
          <Link to="/profile" role="menuitem">Profile</Link>
          {isAdmin && <Link to="/admin" role="menuitem">Admin dashboard</Link>}
          <hr />
          <button role="menuitem" onClick={async () => { await logout(); toast('Signed out'); navigate('/'); }}>Sign out</button>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  const { count, setOpen } = useCart();
  const { ids } = useWishlist();
  const { theme, setTheme } = useUI();
  const loc = useLocation();
  const [navAt, setNavAt] = useState(null);
  const nav = navAt === loc.pathname;
  const setNav = (v) => setNavAt(v ? loc.pathname : null);

  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="brand"><FaShoppingBag aria-hidden="true" color="var(--primary)" /> <span>Shop<b>Lane</b></span></Link>
        <nav className={`nav ${nav ? 'open' : ''}`} aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          <NavLink to="/wishlist" className="m-only">Wishlist</NavLink>
        </nav>
        <SearchBox />
        <span className="spacer" />
        <button className="icon-btn" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <FaSun /> : <FaMoon />}
        </button>
        <Link to="/wishlist" className="icon-btn wish-link" aria-label={`Wishlist (${ids.length})`}><FaHeart />{ids.length > 0 && <span className="badge">{ids.length}</span>}</Link>
        <button className="icon-btn" aria-label={`Open cart (${count} items)`} onClick={() => setOpen(true)}><FaShoppingBag />{count > 0 && <span className="badge">{count}</span>}</button>
        <UserMenu />
        <button className="icon-btn burger" aria-label="Toggle menu" aria-expanded={nav} onClick={() => setNav(!nav)}><FaBars /></button>
      </div>
    </header>
  );
};

export default Header;
