import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { useAdminRoleStore } from '../store/adminRole'

const tg = window.Telegram?.WebApp

const ROLE_HOME = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
  warehouse: '/warehouse',
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, tgAuthPending, logout, setTgAuthDone } = useAuthStore()
  const { activeRole, clearRole } = useAdminRoleStore()
  const [timedOut, setTimedOut] = useState(false)

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

  if (timedOut) return <Navigate to="/login" replace />

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
