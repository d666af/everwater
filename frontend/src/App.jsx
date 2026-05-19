import { Routes, Route, Navigate } from 'react-router-dom'
import { useTelegramAuth } from './hooks/useTelegramAuth'
import { useRoleRefresh } from './hooks/useRoleRefresh'
import { useSubscriptionsEnabled } from './hooks/useSubscriptionsEnabled'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRolePicker from './components/AdminRolePicker'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import CartWidget from './components/CartWidget'
import WelcomeSurvey from './components/WelcomeSurvey'
import AutoReviewPopup from './components/AutoReviewPopup'

// Auth
import Login from './pages/Login'

// Mini App (client)
import Catalog from './pages/Catalog'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderHistory from './pages/OrderHistory'
import Profile from './pages/Profile'
import Subscription from './pages/Subscription'
import Support from './pages/Support'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminClients from './pages/admin/AdminClients'
import AdminProducts from './pages/admin/AdminProducts'
import AdminCouriers from './pages/admin/AdminCouriers'
import AdminSettings from './pages/admin/AdminSettings'
import AdminManagers from './pages/admin/AdminManagers'
import AdminStats from './pages/admin/AdminStats'
import AdminSupport from './pages/admin/AdminSupport'
import AdminWarehouse from './pages/admin/AdminWarehouse'
import AdminWarehouseCouriers from './pages/admin/AdminWarehouseCouriers'
import AdminWarehouseHistory from './pages/admin/AdminWarehouseHistory'
import AdminSubscriptions from './pages/admin/AdminSubscriptions'
import AdminReviews from './pages/admin/AdminReviews'
import AdminCRM from './pages/admin/AdminCRM'

// Manager
import ManagerOrders from './pages/manager/ManagerOrders'
import ManagerClients from './pages/manager/ManagerClients'
import ManagerCouriers from './pages/manager/ManagerCouriers'
import ManagerStats from './pages/manager/ManagerStats'
import ManagerSupport from './pages/manager/ManagerSupport'
import ManagerSubscriptions from './pages/manager/ManagerSubscriptions'

// Courier
import CourierOrders from './pages/courier/CourierOrders'
import CourierStats from './pages/courier/CourierStats'
import CourierMapPage from './pages/courier/CourierMapPage'

// Agent
import AgentCheckout from './pages/agent/AgentCheckout'
import AgentOrders from './pages/agent/AgentOrders'

// Warehouse
import WarehouseStock from './pages/warehouse/WarehouseStock'
import WarehouseCouriers from './pages/warehouse/WarehouseCouriers'
import WarehouseHistory from './pages/warehouse/WarehouseHistory'
import WarehouseProfile from './pages/warehouse/WarehouseProfile'
import WarehouseSubscriptions from './pages/warehouse/WarehouseSubscriptions'

function SubscriptionsGuard({ children, redirectTo }) {
  const enabled = useSubscriptionsEnabled()
  if (enabled === false) return <Navigate to={redirectTo} replace />
  return children
}

export default function App() {
  useTelegramAuth()  // Auto-login from Telegram WebApp context on every load
  useRoleRefresh()   // Silently refresh roles for non-Telegram website users
  return (
    <>
      <AdminRolePicker />
      <Header />
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
        <Route path="/subscription" element={
          <ProtectedRoute allowedRoles={['client']}>
            <SubscriptionsGuard redirectTo="/"><Subscription /></SubscriptionsGuard>
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
        <Route path="/admin/clients" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminClients />
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
        <Route path="/admin/warehouse" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminWarehouse />
          </ProtectedRoute>
        } />
        <Route path="/admin/warehouse/couriers" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminWarehouseCouriers />
          </ProtectedRoute>
        } />
        <Route path="/admin/warehouse/history" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminWarehouseHistory />
          </ProtectedRoute>
        } />
        <Route path="/admin/stats" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminStats />
          </ProtectedRoute>
        } />
        <Route path="/admin/support" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminSupport />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminSettings />
          </ProtectedRoute>
        } />
        <Route path="/admin/managers" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminManagers />
          </ProtectedRoute>
        } />
        <Route path="/admin/subscriptions" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <SubscriptionsGuard redirectTo="/admin"><AdminSubscriptions /></SubscriptionsGuard>
          </ProtectedRoute>
        } />
        <Route path="/admin/reviews" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminReviews />
          </ProtectedRoute>
        } />
        <Route path="/admin/crm" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminCRM />
          </ProtectedRoute>
        } />

        {/* Manager */}
        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerOrders />
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
        <Route path="/manager/subscriptions" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <SubscriptionsGuard redirectTo="/manager"><ManagerSubscriptions /></SubscriptionsGuard>
          </ProtectedRoute>
        } />

        {/* Courier */}
        <Route path="/courier" element={
          <ProtectedRoute allowedRoles={['courier']}>
            <CourierOrders />
          </ProtectedRoute>
        } />
        <Route path="/courier/stats" element={
          <ProtectedRoute allowedRoles={['courier']}>
            <CourierStats />
          </ProtectedRoute>
        } />
        <Route path="/courier/map" element={
          <ProtectedRoute allowedRoles={['courier']}>
            <CourierMapPage />
          </ProtectedRoute>
        } />
        {/* Warehouse */}
        <Route path="/warehouse" element={
          <ProtectedRoute allowedRoles={['warehouse']}>
            <WarehouseStock />
          </ProtectedRoute>
        } />
        <Route path="/warehouse/couriers" element={
          <ProtectedRoute allowedRoles={['warehouse']}>
            <WarehouseCouriers />
          </ProtectedRoute>
        } />
        <Route path="/warehouse/history" element={
          <ProtectedRoute allowedRoles={['warehouse']}>
            <WarehouseHistory />
          </ProtectedRoute>
        } />
        <Route path="/warehouse/subscriptions" element={
          <ProtectedRoute allowedRoles={['warehouse']}>
            <SubscriptionsGuard redirectTo="/warehouse"><WarehouseSubscriptions /></SubscriptionsGuard>
          </ProtectedRoute>
        } />
        <Route path="/warehouse/profile" element={
          <ProtectedRoute allowedRoles={['warehouse']}>
            <WarehouseProfile />
          </ProtectedRoute>
        } />

        {/* Agent */}
        <Route path="/agent/checkout" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentCheckout />
          </ProtectedRoute>
        } />
        <Route path="/agent/orders" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <AgentOrders />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <CartWidget />
      <BottomNav />
      <WelcomeSurvey />
      <AutoReviewPopup />
    </>
  )
}
