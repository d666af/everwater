import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { getUserByTelegram } from '../api'

const tg = window.Telegram?.WebApp

const ROLE_HOME = {
  client: '/', admin: '/admin', manager: '/manager', courier: '/courier', warehouse: '/warehouse',
}

/**
 * On every app load inside Telegram WebApp, always fetches fresh user data
 * from the backend to pick up role changes. If there's a cached user we
 * show it immediately (no loader flash), then update roles in the background.
 * ProtectedRoute handles redirecting away from invalid routes automatically.
 */
export function useTelegramAuth() {
  const { user, login } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const tgUser = tg?.initDataUnsafe?.user
    if (!tgUser) return

    const isFirstLogin = !user

    // Always fetch — this refreshes roles even when already cached in localStorage
    getUserByTelegram(tgUser.id)
      .then((userData) => {
        if (!userData?.id) return
        login(userData)

        // Only navigate on first login or when explicitly on the login page.
        // If already browsing, ProtectedRoute redirects away from invalid routes.
        if (isFirstLogin || location.pathname === '/login') {
          navigate(ROLE_HOME[userData.role] || '/', { replace: true })
        }
      })
      .catch(() => {
        // Network error — if no cached user, nothing we can do
      })
  }, []) // eslint-disable-line
}
