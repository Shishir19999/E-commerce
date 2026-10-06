import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const Header = () => {
  const { user, logout, isAdmin } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div>
      <nav className="navbar navbar-expand-lg bg-body-tertiary">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand">🛒 E-Commerce App</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarTogglerDemo01" aria-controls="navbarTogglerDemo01" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="navbarTogglerDemo01">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
              <li className="nav-item"><NavLink to="/" className="nav-link">Home</NavLink></li>
              <li className="nav-item"><NavLink to="/category" className="nav-link">Category</NavLink></li>
              {!user ? (
                <>
                  <li className="nav-item"><NavLink to="/register" className="nav-link">Register</NavLink></li>
                  <li className="nav-item"><NavLink to="/login" className="nav-link">Login</NavLink></li>
                </>
              ) : (
                <li className="nav-item dropdown">
                  <a className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" onClick={(e) => e.preventDefault()}>
                    {user.name}
                  </a>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li><NavLink to="/orders" className="dropdown-item">My Orders</NavLink></li>
                    {isAdmin && (
                      <>
                        <li><NavLink to="/admin/categories" className="dropdown-item">Manage Categories</NavLink></li>
                        <li><NavLink to="/admin/products" className="dropdown-item">Manage Products</NavLink></li>
                        <li><NavLink to="/admin/orders" className="dropdown-item">Manage Orders</NavLink></li>
                      </>
                    )}
                    <li><button className="dropdown-item" onClick={handleLogout}>Logout</button></li>
                  </ul>
                </li>
              )}
              <li className="nav-item"><NavLink to="/cart" className="nav-link">Cart ({count})</NavLink></li>
            </ul>
          </div>
        </div>
      </nav>
    </div>
  )
}

export default Header
