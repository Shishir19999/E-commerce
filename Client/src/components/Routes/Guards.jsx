import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const PrivateRoute = () => {
  const { token } = useAuth();
  const location = useLocation();
  return token ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
};

export const AdminRoute = () => {
  const { token, isAdmin } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

export const SellerRoute = () => {
  const { token, isSeller } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return isSeller ? <Outlet /> : <Navigate to="/profile" replace />;
};
