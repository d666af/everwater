import { Navigate } from 'react-router-dom'
import { useEffect } from 'react'
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
  const { activeRole, clearRole } = useAdminRoleStore()

  // Clear stale activeRole when it's no longer in the user's current roles
  useEffect(() => {
    if (activeRole && user?.roles && !user.roles.includes(activeRole)) {
      clearRole()
    }
  }, [activeRole, user?.roles]) // eslint-disable-line

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

  // Only trust activeRole if it's actually in the user's current roles
  const validActiveRole = (activeRole && user.roles?.includes(activeRole)) ? activeRole : null
  const effectiveRole = (user.roles?.length > 1 && validActiveRole)
    ? validActiveRole
    : user.role

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to={ROLE_HOME[effectiveRole] || '/login'} replace />
  }

  return children
}
