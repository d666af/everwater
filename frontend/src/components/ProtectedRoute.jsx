import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { useAdminRoleStore } from '../store/adminRole'

const ROLE_HOME = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
  warehouse: '/warehouse',
}

const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f5' }}>
    <div style={{ textAlign: 'center', color: '#8DC63F' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>💧</div>
      <div style={{ fontWeight: 600 }}>Загрузка...</div>
    </div>
  </div>
)

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, tgAuthPending, logout, setTgAuthDone } = useAuthStore()
  const { activeRole, clearRole, setActiveRole, skipAutoActivate } = useAdminRoleStore()
  const [timedOut, setTimedOut] = useState(false)
  const location = useLocation()

  // Clear stale activeRole when it's no longer in the user's current roles
  useEffect(() => {
    if (activeRole && user?.roles && !user.roles.includes(activeRole)) {
      clearRole()
    }
  }, [activeRole, user?.roles]) // eslint-disable-line

  // Safety timeout: if pending for >6s, clear auth and redirect to login
  useEffect(() => {
    if (!tgAuthPending) return
    const t = setTimeout(() => {
      logout()
      setTgAuthDone()
      setTimedOut(true)
    }, 6000)
    return () => clearTimeout(t)
  }, [tgAuthPending]) // eslint-disable-line

  // Auto-activate a role when navigating directly to a role-specific URL.
  // Skipped at root '/' for multi-role users (picker shows instead).
  // Skipped when user explicitly requested the picker via clearRole().
  useEffect(() => {
    if (!allowedRoles || !user?.roles || tgAuthPending) return
    if (skipAutoActivate) return
    if (location.pathname === '/' && user.roles.length > 1) return
    const validActive = activeRole && user.roles.includes(activeRole) ? activeRole : null
    if (validActive && allowedRoles.includes(validActive)) return
    const matchingRole = allowedRoles.find(r => user.roles.includes(r))
    if (matchingRole) {
      setActiveRole(matchingRole)
    }
  }, [user?.roles?.join?.(','), activeRole, tgAuthPending, location.pathname, skipAutoActivate]) // eslint-disable-line

  if (timedOut) return <Navigate to="/login" replace />

  if (tgAuthPending) return <Loader />

  if (!user) return <Navigate to="/login" replace />

  const validActiveRole = (activeRole && user.roles?.includes(activeRole)) ? activeRole : null
  const multiRole = user.roles?.length > 1

  // Multi-role user without a selected role: show picker (AdminRolePicker is
  // a fixed overlay rendered by the layout; return a neutral screen behind it).
  if (multiRole && !validActiveRole) {
    const isClientRoute = location.pathname === '/' || skipAutoActivate
    if (isClientRoute) {
      return <div style={{ minHeight: '100vh', background: '#f5f5f5' }} />
    }
    // Role-specific route: auto-activate is about to fire — show loader.
    const hasAccess = !allowedRoles || allowedRoles.some(r => user.roles.includes(r))
    if (!hasAccess) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />
    return <Loader />
  }

  const effectiveRole = (multiRole && validActiveRole) ? validActiveRole : user.role

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to={ROLE_HOME[effectiveRole] || '/login'} replace />
  }

  return children
}
