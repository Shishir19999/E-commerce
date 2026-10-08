import { useEffect } from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import { CartDrawer } from './CartParts.jsx';
import { DEMO, resetDemo } from '../api/client';
import { useUI } from '../context/UIContext';
import { DEMO_ACCOUNTS } from '../demo/seed.js';

const PreviewBanner = () => {
  const { toast, confirm } = useUI();
  const reset = async () => {
    if (!(await confirm({ title: 'Reset the live preview?', message: 'Products, orders, accounts and your cart go back to the starting state.', confirmLabel: 'Reset', danger: true }))) return;
    await resetDemo();
    try {
      ['cart', 'saved', 'auth', 'recent', 'compare'].forEach((k) => localStorage.removeItem(k));
    } catch { /* storage unavailable */ }
    toast.success('Live preview reset');
    setTimeout(() => window.location.reload(), 400);
  };
  return (
    <div className="demo-banner" role="note">
      <b>Live preview</b>: everything runs in your browser, no real payments or emails. Roles to try: {DEMO_ACCOUNTS.map((a) => `${a.role} (${a.email})`).join(', ')}.
      <button onClick={reset}>Reset preview data</button>
    </div>
  );
};

const Layout = ({ children, title, description }) => {
  useEffect(() => {
    document.title = title ? `${title} | ShopLane` : 'ShopLane | Everyday essentials, delivered';
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {DEMO && <PreviewBanner />}
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
};

export default Layout;
