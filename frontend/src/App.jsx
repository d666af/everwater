import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import BottomNav from './components/BottomNav'

// Mini App pages
import Catalog from './pages/Catalog'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderHistory from './pages/OrderHistory'
import Profile from './pages/Profile'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminCouriers from './pages/admin/AdminCouriers'
import AdminSettings from './pages/admin/AdminSettings'

// Courier page
import CourierPanel from './pages/courier/CourierPanel'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        {/* Mini App */}
        <Route path="/" element={<Catalog />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<OrderHistory />} />
        <Route path="/profile" element={<Profile />} />

        {/* Admin Panel */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/couriers" element={<AdminCouriers />} />
        <Route path="/admin/settings" element={<AdminSettings />} />

        {/* Courier Panel */}
        <Route path="/courier" element={<CourierPanel />} />
      </Routes>
      <BottomNav />
    </>
  )
}
