import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth'
import { getRolesByPhone } from '../api'

const tg = window.Telegram?.WebApp

export function useRoleRefresh() {
  const { user, login, setTgAuthDone } = useAuthStore()
  const ran = useRef(false)

  useEffect(() => {
    // Only for non-Telegram users (Telegram users handled by useTelegramAuth)
    if (tg?.initDataUnsafe?.user) return
    if (ran.current) return
    ran.current = true

    if (!user?.phone) {
      setTgAuthDone()  // No refresh needed, clear pending immediately
      return
    }

    getRolesByPhone(user.phone)
      .then((data) => {
        if (!data?.roles) { setTgAuthDone(); return }
        login({ ...user, roles: data.roles, role: data.role })
      })
      .catch(() => setTgAuthDone())  // Clear pending even on error
  }, []) // eslint-disable-line
}
