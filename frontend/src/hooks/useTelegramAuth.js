import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { getUserByTelegram } from '../api'

const tg = window.Telegram?.WebApp

const ROLE_HOME = {
  client: '/', admin: '/admin', manager: '/manager', courier: '/courier', warehouse: '/warehouse',
}

export function useTelegramAuth() {
  const { user, login, logout, setTgAuthDone } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const tgUser = tg?.initDataUnsafe?.user
    if (!tgUser) return  // not in Telegram WebApp

    const isFirstLogin = !user

    getUserByTelegram(tgUser.id)
      .then((userData) => {
        if (!userData?.id) {
          // Backend returned empty/incomplete data — treat as not registered
          logout()
          navigate('/login', { replace: true })
          return
        }
        login(userData)
        if (isFirstLogin || location.pathname === '/login') {
          navigate(ROLE_HOME[userData.role] || '/', { replace: true })
        }
      })
      .catch(() => {
        // 404 = user not in DB (new user or DB was reset with stale localStorage)
        // Clear stale session so ProtectedRoute redirects to /login
        logout()
        setTgAuthDone()
      })
  }, []) // eslint-disable-line
}
