import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProductCard from '../components/ProductCard';
import { ErrorState, ProductSkeletons, State } from '../components/Common';
import { useFetch } from '../lib/hooks';
import API, { DEMO, errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useWishlist } from '../context/WishlistContext';
import { DEMO_ACCOUNTS } from '../demo/seed.js';
import { AddressBook } from '../components/AddressBook';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Field = ({ id, label, error, ...rest }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <input id={id} className="input" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-e` : undefined} {...rest} />
    {error && <span className="err" id={`${id}-e`} role="alert">{error}</span>}
  </div>
);

export const Login = () => {
  const [f, setF] = useState({ email: '', password: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e, creds = f) => {
    e?.preventDefault();
    const next = {};
    if (!EMAIL.test(creds.email.trim())) next.email = 'Enter a valid email address';
    if (!creds.password) next.password = 'Enter your password';
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await API.post('/api/v1/auth/login', creds);
      login(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}`);
      navigate(location.state?.from || (res.data.user.role === 1 ? '/admin' : res.data.user.role === 2 ? '/seller' : '/'), { replace: true });
    } catch (err) {
      setErrs({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Sign in">
      <div className="container page auth">
        <h1 style={{ fontSize: '1.9rem' }}>Sign in</h1>
        {DEMO && (
          <div className="demo-creds">
            <b>Live preview logins</b> (password <code>{DEMO_ACCOUNTS[0].password}</code>)
            <div className="row">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.role} type="button" className="btn sm" onClick={() => { setF({ email: a.email, password: a.password }); submit(null, { email: a.email, password: a.password }); }}>
                  Sign in as {a.role} ({a.email})
                </button>
              ))}
            </div>
          </div>
        )}
        <form className="card" onSubmit={submit} noValidate>
          <Field id="l-email" label="Email" type="email" autoComplete="email" value={f.email} error={errs.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Field id="l-pass" label="Password" type="password" autoComplete="current-password" value={f.password} error={errs.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          {errs.form && <div className="err" role="alert" style={{ marginBottom: 10 }}>{errs.form}</div>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="small center" style={{ marginTop: 14 }}>New here? <Link to="/register">Create an account</Link></p>
        </form>
      </div>
    </Layout>
  );
};

export const Register = () => {
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', address: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const { toast } = useUI();
  const navigate = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!f.name.trim()) next.name = 'Enter your name';
    if (!EMAIL.test(f.email.trim())) next.email = 'Enter a valid email address';
    if (f.password.length < 6) next.password = 'Use at least 6 characters';
    if (f.phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a phone number';
    if (f.address.trim().length < 5) next.address = 'Enter your address';
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await API.post('/api/v1/auth/register', f);
      toast.success('Account created. Please sign in.');
      navigate('/login');
    } catch (err) {
      setErrs({ form: errMsg(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Create account">
      <div className="container page auth">
        <h1 style={{ fontSize: '1.9rem' }}>Create account</h1>
        <form className="card" onSubmit={submit} noValidate>
          <Field id="r-name" label="Full name" autoComplete="name" value={f.name} error={errs.name} onChange={set('name')} />
          <Field id="r-email" label="Email" type="email" autoComplete="email" value={f.email} error={errs.email} onChange={set('email')} />
          <Field id="r-pass" label="Password" type="password" autoComplete="new-password" value={f.password} error={errs.password} onChange={set('password')} />
          <Field id="r-phone" label="Phone" autoComplete="tel" value={f.phone} error={errs.phone} onChange={set('phone')} />
          <Field id="r-addr" label="Address" autoComplete="street-address" value={f.address} error={errs.address} onChange={set('address')} />
          {errs.form && <div className="err" role="alert" style={{ marginBottom: 10 }}>{errs.form}</div>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="small center" style={{ marginTop: 14 }}>Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </Layout>
  );
};

const SellerPanel = () => {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const [store, setStore] = useState(user.storeName || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user.role === 1) return null;
  const apply = async (e) => {
    e.preventDefault();
    if (store.trim().length < 2) return setErr('Enter a store name (at least 2 characters)');
    setBusy(true);
    try {
      const r = await API.post('/api/v1/auth/seller-request', { storeName: store });
      setUser(r.data.user);
      toast.success(r.data.message);
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-labelledby="sell-h" style={{ marginTop: 20 }}>
      <h2 id="sell-h" style={{ fontSize: '1.3rem' }}>Selling on ShopLane</h2>
      {user.role === 2 ? (
        <p className="muted">You are a seller{user.storeName ? <> at <b>{user.storeName}</b></> : ''}. <Link to="/seller">Open your seller dashboard</Link>.</p>
      ) : user.sellerRequest ? (
        <p role="status"><span className="pill warn">Application pending</span> <span className="muted">Your store <b>{user.storeName}</b> is waiting for an admin to approve it.</span></p>
      ) : (
        <form onSubmit={apply} noValidate>
          <p className="muted">Want to sell your own products? Apply for a seller account. An admin reviews every application.</p>
          <Field id="sell-store" label="Store name" value={store} error={err} onChange={(e) => { setStore(e.target.value); setErr(''); }} maxLength={60} />
          <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Apply to sell'}</button>
        </form>
      )}
    </section>
  );
};

export const Profile = () => {
  const { user, setUser } = useAuth();
  const { toast } = useUI();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', address: user.address || '', storeName: user.storeName || '' });
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!f.name.trim()) next.name = 'Enter your name';
    if (!f.phone.trim()) next.phone = 'Enter a phone number';
    if (!f.address.trim()) next.address = 'Enter your address';
    if (user.role === 2 && f.storeName.trim().length < 2) next.storeName = 'Enter a store name';
    setErrs(next);
    if (Object.keys(next).length) return;
    try {
      const r = await API.put('/api/v1/auth/profile', user.role === 2 ? f : { name: f.name, phone: f.phone, address: f.address });
      setUser(r.data.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <Layout title="My profile">
      <div className="container page" style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: '1.9rem' }}>My profile</h1>
        <form className="card" onSubmit={submit} noValidate>
          <Field id="p-email" label="Email" value={user.email} readOnly disabled />
          <Field id="p-name" label="Full name" value={f.name} error={errs.name} onChange={set('name')} />
          <Field id="p-phone" label="Phone" value={f.phone} error={errs.phone} onChange={set('phone')} />
          <Field id="p-addr" label="Address" value={f.address} error={errs.address} onChange={set('address')} />
          {user.role === 2 && <Field id="p-store" label="Store name" value={f.storeName} error={errs.storeName} onChange={set('storeName')} maxLength={60} />}
          <button className="btn primary">Save changes</button>
        </form>
        <AddressBook defaults={{ name: user.name, phone: user.phone || '' }} />
        <SellerPanel />
      </div>
    </Layout>
  );
};

export const Wishlist = () => {
  const { ids } = useWishlist();
  const key = ids.join(',');
  const { data, loading, error, reload } = useFetch(() => API.get('/api/v1/wishlist').then((r) => r.data.products), [key]);
  return (
    <Layout title="Wishlist">
      <div className="container page">
        <h1 style={{ fontSize: '1.9rem' }}>My wishlist</h1>
        {loading && !data ? <ProductSkeletons n={4} /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
          <State icon="💜" title="Nothing saved yet" action={<Link className="btn primary" to="/shop">Discover products</Link>}>Tap the heart on any product to save it here.</State>
        ) : <div className="grid">{data.map((p, i) => <ProductCard key={p._id} p={p} index={i} />)}</div>}
      </div>
    </Layout>
  );
};
