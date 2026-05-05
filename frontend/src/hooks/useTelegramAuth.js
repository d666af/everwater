import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { authByInitData, getUserByTelegram } from '../api'

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

    const handleUserData = (userData) => {
      if (!userData?.id) {
        logout()
        setTgAuthDone()
        return
      }
      if (!userData.is_registered) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      login(userData)
      if (isFirstLogin || location.pathname === '/login') {
        navigate(ROLE_HOME[userData.role] || '/', { replace: true })
      }
    }

    const handleError = (err) => {
      // 403 = registered in DB but bot registration incomplete → show "finish in bot"
      // Any other error (5xx, network) → don't block, just mark auth done so app loads
      const status = err?.response?.status
      if (status === 403) {
        logout()
        navigate('/login', { replace: true })
      } else {
        // Server error or network issue: don't force re-registration screen,
        // just clear pending so ProtectedRoute redirects normally
        logout()
        setTgAuthDone()
      }
    }

    const initData = tg?.initData
    if (initData) {
      authByInitData(initData).then(handleUserData).catch(handleError)
    } else {
      // Dev/test environment without real initData — fall back to ID-based lookup
      getUserByTelegram(tgUser.id).then(handleUserData).catch(handleError)
    }
  }, []) // eslint-disable-line
}
