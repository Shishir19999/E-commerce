import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useUI } from '../context/UIContext';

export const About = () => (
  <Layout title="About us" description="ShopLane is a small demo store built to show a complete shopping experience.">
    <div className="container page" style={{ maxWidth: 780 }}>
      <h1>About ShopLane</h1>
      <p>ShopLane is a complete online store: a catalogue with filters and search, product pages with reviews, a wishlist, a cart with coupons, a multi-step checkout, order tracking and an admin area to run it all.</p>
      <p>It is a portfolio project. The full-stack version runs on Express and MongoDB with optional Stripe test payments; the public demo runs entirely in your browser with sample data, so nothing you enter ever leaves your device.</p>
      <div className="grid3" style={{ marginTop: 24 }}>
        <div className="card"><h3>Curated</h3><p className="muted">Every product has a clear description, honest photos and real specs.</p></div>
        <div className="card"><h3>Fair</h3><p className="muted">Free standard shipping over $50 and a 30-day return window.</p></div>
        <div className="card"><h3>Private</h3><p className="muted">We only keep what is needed to deliver your order.</p></div>
      </div>
    </div>
  </Layout>
);

export const Contact = () => {
  const { toast } = useUI();
  const [f, setF] = useState({ name: '', email: '', message: '' });
  const [errs, setErrs] = useState({});
  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!f.name.trim()) next.name = 'Please tell us your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) next.email = 'Enter a valid email address';
    if (f.message.trim().length < 10) next.message = 'Write at least 10 characters';
    setErrs(next);
    if (Object.keys(next).length) return;
    toast.success('Thanks! In this demo the message stays on your device.');
    setF({ name: '', email: '', message: '' });
  };
  const bind = (k) => ({ id: `c-${k}`, className: 'input', value: f[k], 'aria-invalid': Boolean(errs[k]), 'aria-describedby': errs[k] ? `c-${k}-e` : undefined, onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Layout title="Contact us" description="Questions about an order or a product? Send us a message.">
      <div className="container page" style={{ maxWidth: 640 }}>
        <h1>Contact us</h1>
        <p className="muted">Questions about an order or a product? Write to support@example.com or use the form.</p>
        <form className="card" onSubmit={submit} noValidate>
          {[['name', 'Your name', 'input'], ['email', 'Email', 'input'], ['message', 'Message', 'textarea']].map(([k, label, kind]) => (
            <div className="field" key={k}>
              <label htmlFor={`c-${k}`}>{label}</label>
              {kind === 'textarea' ? <textarea rows="5" {...bind(k)} /> : <input type={k === 'email' ? 'email' : 'text'} {...bind(k)} />}
              {errs[k] && <span className="err" id={`c-${k}-e`}>{errs[k]}</span>}
            </div>
          ))}
          <button className="btn primary">Send message</button>
        </form>
      </div>
    </Layout>
  );
};

export const Policy = () => (
  <Layout title="Privacy policy" description="How ShopLane handles your data.">
    <div className="container page" style={{ maxWidth: 780 }}>
      <h1>Privacy policy</h1>
      <h3>What we collect</h3>
      <p>Your name, email, phone number and delivery address, so we can create your account and ship your orders. Passwords are stored hashed, never in plain text.</p>
      <h3>Payments</h3>
      <p>This store never sees your card details. Payments are handled by a payment provider in test mode, or simulated when no provider is configured.</p>
      <h3>Demo version</h3>
      <p>The public demo stores everything in your browser&apos;s local storage. Clearing site data, or using “Reset demo data”, removes it.</p>
      <h3>Returns</h3>
      <p>Unused items can be returned within 30 days of delivery for a full refund.</p>
    </div>
  </Layout>
);

export const NotFound = () => (
  <Layout title="Page not found">
    <div className="container notfound">
      <div className="big" aria-hidden="true">404</div>
      <h1 style={{ fontSize: '1.6rem' }}>This page wandered off</h1>
      <p className="muted">The link may be broken or the page may have moved.</p>
      <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary" to="/">Back to home</Link><Link className="btn" to="/shop">Browse products</Link></div>
    </div>
  </Layout>
);
