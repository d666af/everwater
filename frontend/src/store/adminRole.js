import { create } from 'zustand'

const SESSION_KEY = 'ew_admin_active_role'

// Session-based: resets when browser tab closes
export const useAdminRoleStore = create((set) => ({
  activeRole: sessionStorage.getItem(SESSION_KEY) || null,
  // Set to true when user explicitly requests the picker (via role switch).
  // Prevents ProtectedRoute from immediately re-activating a role after clearRole().
  skipAutoActivate: false,

  setActiveRole: (role) => {
    sessionStorage.setItem(SESSION_KEY, role)
    set({ activeRole: role, skipAutoActivate: false })
  },

  clearRole: () => {
    sessionStorage.removeItem(SESSION_KEY)
    set({ activeRole: null, skipAutoActivate: true })
  },
}))
