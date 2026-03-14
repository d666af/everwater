import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import CartToast from './components/CartToast'

// Auth
import Login from './pages/Login'

// Mini App (client)
import Catalog from './pages/Catalog'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderHistory from './pages/OrderHistory'
import Profile from './pages/Profile'
import Support from './pages/Support'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminCouriers from './pages/admin/AdminCouriers'
import AdminSettings from './pages/admin/AdminSettings'

// Manager
import ManagerOrders from './pages/manager/ManagerOrders'
import ManagerClients from './pages/manager/ManagerClients'
import ManagerCouriers from './pages/manager/ManagerCouriers'
import ManagerStats from './pages/manager/ManagerStats'
import ManagerNotifications from './pages/manager/ManagerNotifications'
import ManagerSupport from './pages/manager/ManagerSupport'

// Courier
import CourierPanel from './pages/courier/CourierPanel'

export default function App() {
  return (
    <>
      <Header />
      <CartToast />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Client (default: if Telegram WebApp — skip login) */}
        <Route path="/" element={
          <ProtectedRoute allowedRoles={['client']}>
            <Catalog />
          </ProtectedRoute>
        } />
        <Route path="/cart" element={
          <ProtectedRoute allowedRoles={['client']}>
            <Cart />
          </ProtectedRoute>
        } />
        <Route path="/checkout" element={
          <ProtectedRoute allowedRoles={['client']}>
            <Checkout />
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute allowedRoles={['client']}>
            <OrderHistory />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute allowedRoles={['client']}>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/support" element={
          <ProtectedRoute allowedRoles={['client']}>
            <Support />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/orders" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminOrders />
          </ProtectedRoute>
        } />
        <Route path="/admin/products" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminProducts />
          </ProtectedRoute>
        } />
        <Route path="/admin/couriers" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminCouriers />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminSettings />
          </ProtectedRoute>
        } />

        {/* Manager */}
        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerOrders />
          </ProtectedRoute>
        } />
        <Route path="/manager/notifications" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerNotifications />
          </ProtectedRoute>
        } />
        <Route path="/manager/support" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerSupport />
          </ProtectedRoute>
        } />
        <Route path="/manager/clients" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerClients />
          </ProtectedRoute>
        } />
        <Route path="/manager/couriers" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerCouriers />
          </ProtectedRoute>
        } />
        <Route path="/manager/stats" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerStats />
          </ProtectedRoute>
        } />

        {/* Courier */}
        <Route path="/courier" element={
          <ProtectedRoute allowedRoles={['courier']}>
            <CourierPanel />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}
