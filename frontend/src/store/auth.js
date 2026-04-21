import { create } from 'zustand'
import { create as createStore } from 'zustand'

// ─── Auth Store ───────────────────────────────────────────────────────────────
// Persisted to localStorage

const STORAGE_KEY = 'everwater_auth'

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const saveToStorage = (data) => {
  if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  else localStorage.removeItem(STORAGE_KEY)
}

const tg = window.Telegram?.WebApp
const inTgWebApp = () => !!tg?.initDataUnsafe?.user

export const useAuthStore = create((set, get) => {
  const initial = loadFromStorage()
  return {
    user: initial,
    token: initial?.token || null,
    // Pending only when in Telegram WebApp and no user cached yet
    tgAuthPending: inTgWebApp() && !initial,

    login: (userData) => {
      const data = { ...userData }
      saveToStorage(data)
      set({ user: data, token: data.token, tgAuthPending: false })
    },

    logout: () => {
      saveToStorage(null)
      set({ user: null, token: null, tgAuthPending: false })
    },

    setTgAuthDone: () => set({ tgAuthPending: false }),

    isAuthenticated: () => !!get().user,
    role: () => get().user?.role || null,
  }
})
