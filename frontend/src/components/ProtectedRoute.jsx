import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const tg = window.Telegram?.WebApp

// In Telegram WebApp context, auto-treat as client
const isTelegramWebApp = () => !!tg?.initDataUnsafe?.user

const ROLE_HOME = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuthStore()

  // Telegram WebApp auto-auth: always treat as client
  if (!user && isTelegramWebApp() && allowedRoles?.includes('client')) {
    return children
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />
  }

  return children
}
