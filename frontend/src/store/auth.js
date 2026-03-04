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

export const useAuthStore = create((set, get) => {
  const initial = loadFromStorage()
  return {
    user: initial,       // { id, name, phone, role: 'client'|'admin'|'manager'|'courier' }
    token: initial?.token || null,

    login: (userData) => {
      const data = { ...userData }
      saveToStorage(data)
      set({ user: data, token: data.token })
    },

    logout: () => {
      saveToStorage(null)
      set({ user: null, token: null })
    },

    isAuthenticated: () => !!get().user,
    role: () => get().user?.role || null,
  }
})
