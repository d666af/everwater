import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useAdminRoleStore } from '../store/adminRole'

const tg = window.Telegram?.WebApp
const isTelegramWebApp = () => !!tg?.initDataUnsafe?.user

const ROLE_HOME = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
  warehouse: '/warehouse',
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, tgAuthPending } = useAuthStore()
  const { activeRole } = useAdminRoleStore()

  // While Telegram auto-auth is in progress, show a neutral loader
  if (tgAuthPending) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f5' }}>
        <div style={{ textAlign: 'center', color: '#8DC63F' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💧</div>
          <div style={{ fontWeight: 600 }}>Загрузка...</div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Admin can act as any role via the session role picker.
  // All other roles are strictly locked — no cross-flow access.
  const effectiveRole = user.role === 'admin'
    ? (activeRole || 'admin')
    : user.role

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to={ROLE_HOME[effectiveRole] || '/login'} replace />
  }

  return children
}
