import { useEffect } from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import { CartDrawer } from './CartParts.jsx';
import { DEMO, resetDemo } from '../api/client';
import { useUI } from '../context/UIContext';
import { DEMO_ACCOUNTS } from '../demo/seed.js';

const DemoBanner = () => {
  const { toast, confirm } = useUI();
  const reset = async () => {
    if (!(await confirm({ title: 'Reset demo data?', message: 'Products, orders, accounts and your cart go back to the starting state.', confirmLabel: 'Reset', danger: true }))) return;
    await resetDemo();
    try {
      localStorage.removeItem('cart');
      localStorage.removeItem('auth');
      localStorage.removeItem('recent');
    } catch { /* storage unavailable */ }
    toast.success('Demo data reset');
    setTimeout(() => window.location.reload(), 400);
  };
  return (
    <div className="demo-banner" role="note">
      <b>Demo mode</b>: everything runs in your browser, no real payments or emails. Logins: {DEMO_ACCOUNTS.map((a) => a.email).join(' / ')}.
      <button onClick={reset}>Reset demo data</button>
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
      {DEMO && <DemoBanner />}
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
};

export default Layout;
