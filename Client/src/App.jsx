import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import MyOrders, { Invoice, OrderDetail } from './pages/MyOrders';
import { CheckoutSuccess, CheckoutCancel } from './pages/CheckoutResult';
import { Login, Profile, Register, Wishlist } from './pages/Account';
import { About, Contact, NotFound, Policy } from './pages/Info';
import { PrivateRoute, AdminRoute, SellerRoute } from './components/Routes/Guards';
import Compare from './pages/Compare';
import Notifications from './pages/Notifications';
import { Skeleton } from './components/Common';

// admin screens are split into their own chunks; shoppers never download them
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/Admin/AdminProducts'));
const AdminCategories = lazy(() => import('./pages/Admin/AdminCategories'));
const AdminOrders = lazy(() => import('./pages/Admin/AdminOrders'));
const AdminCoupons = lazy(() => import('./pages/Admin/AdminCoupons'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminReports = lazy(() => import('./pages/Admin/AdminReports'));
const SellerDashboard = lazy(() => import('./pages/Seller/SellerDashboard'));

const ScrollTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
};

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<div className="container page"><Skeleton h={300} /></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/category" element={<Navigate to="/shop" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/product/:slug" element={<ProductDetails />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/compare" element={<Compare />} />
          <Route element={<PrivateRoute />}>
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/orders/:id/invoice" element={<Invoice />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>
          <Route element={<SellerRoute />}>
            <Route path="/seller" element={<SellerDashboard />} />
            <Route path="/seller/products" element={<AdminProducts seller />} />
            <Route path="/seller/orders" element={<AdminOrders seller />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
