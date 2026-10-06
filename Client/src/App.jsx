import {Routes,Route} from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Policy from './pages/Policy'
import Pagenotfound from './pages/Pagenotfound'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import Category from './pages/Category'
import ProductDetails from './pages/ProductDetails'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import MyOrders from './pages/MyOrders'
import { CheckoutSuccess, CheckoutCancel } from './pages/CheckoutResult'
import AdminCategories from './pages/Admin/AdminCategories'
import AdminProducts from './pages/Admin/AdminProducts'
import AdminOrders from './pages/Admin/AdminOrders'
import { PrivateRoute, AdminRoute } from './components/Routes/Guards'

export default function App() {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='/about' element={<About/>}/>
        <Route path='/contact' element={<Contact/>}/>
        <Route path='/policy' element={<Policy/>}/>
        <Route path='/register' element={<Register/>}/>
        <Route path='/login' element={<Login/>}/>
        <Route path='/category' element={<Category/>}/>
        <Route path='/product/:slug' element={<ProductDetails/>}/>
        <Route path='/cart' element={<Cart/>}/>
        <Route element={<PrivateRoute/>}>
          <Route path='/checkout' element={<Checkout/>}/>
          <Route path='/orders' element={<MyOrders/>}/>
          <Route path='/checkout/success' element={<CheckoutSuccess/>}/>
          <Route path='/checkout/cancel' element={<CheckoutCancel/>}/>
        </Route>
        <Route element={<AdminRoute/>}>
          <Route path='/admin/categories' element={<AdminCategories/>}/>
          <Route path='/admin/products' element={<AdminProducts/>}/>
          <Route path='/admin/orders' element={<AdminOrders/>}/>
        </Route>
        <Route path='*' element={<Pagenotfound/>}/>
      </Routes>
    </div>
  )
}
