import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useAdminRoleStore } from '../store/adminRole'
import { getUserByTelegram } from '../api'

const tg = window.Telegram?.WebApp

const ROLE_HOME = {
  client: '/', admin: '/admin', manager: '/manager', courier: '/courier', warehouse: '/warehouse',
}

/**
 * On every app load, if running inside Telegram WebApp:
 *  1. Read telegram_id from initDataUnsafe
 *  2. Fetch user from backend
 *  3. Auto-login and navigate to their role's page
 *
 * This means every user always lands on their correct flow — no manual login needed.
 */
export function useTelegramAuth() {
  const { user, login } = useAuthStore()
  const { activeRole } = useAdminRoleStore()
  const navigate = useNavigate()
  const location = useLocation()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const tgUser = tg?.initDataUnsafe?.user
    if (!tgUser) return  // Not in Telegram WebApp context

    const tgId = tgUser.id

    // If already logged in as the correct user, just verify we're on the right route
    if (user) {
      const correctHome = user.role === 'admin'
        ? (activeRole ? ROLE_HOME[activeRole] : '/admin')
        : ROLE_HOME[user.role] || '/'
      // Only redirect if we're on login page
      if (location.pathname === '/login') {
        navigate(correctHome, { replace: true })
      }
      return
    }

    // Auto-login via Telegram ID
    getUserByTelegram(tgId)
      .then((userData) => {
        if (userData?.id) {
          login(userData)
          const home = ROLE_HOME[userData.role] || '/'
          navigate(home, { replace: true })
        }
      })
      .catch(() => {
        // User not found in DB — redirect to login (they'll register via bot)
      })
  }, []) // eslint-disable-line
}
