import { create } from 'zustand'

const SESSION_KEY = 'ew_admin_active_role'

// Session-based: resets when browser tab closes
export const useAdminRoleStore = create((set) => ({
  activeRole: sessionStorage.getItem(SESSION_KEY) || null,

  setActiveRole: (role) => {
    sessionStorage.setItem(SESSION_KEY, role)
    set({ activeRole: role })
  },

  clearRole: () => {
    sessionStorage.removeItem(SESSION_KEY)
    set({ activeRole: null })
  },
}))
