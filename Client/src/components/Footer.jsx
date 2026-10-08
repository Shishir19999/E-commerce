import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="footer">
    <div className="container cols">
      <div>
        <h4>ShopLane</h4>
        <p>Everyday essentials, fairly priced. Shop, sell and manage orders: customers, sellers and admins all in one store.</p>
      </div>
      <div>
        <h4>Shop</h4>
        <Link to="/shop">All products</Link><Link to="/wishlist">Wishlist</Link><Link to="/compare">Compare</Link><Link to="/orders">My orders</Link>
      </div>
      <div>
        <h4>Company</h4>
        <Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/policy">Privacy policy</Link>
      </div>
    </div>
    <div className="container small" style={{ marginTop: 20 }}>&copy; {new Date().getFullYear()} ShopLane. Sample store: no real orders or payments.</div>
  </footer>
);

export default Footer;
