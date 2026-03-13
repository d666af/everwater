import { create } from 'zustand'

// Shared user profile data (balance + bonuses) — synced between Profile and Checkout
// Populated from authStore login data and updatable independently

export const useUserStore = create((set, get) => ({
  balance: 0,
  bonus_points: 0,
  order_count: 0,
  initialized: false,

  init: (userData) => {
    if (!userData) return
    set({
      balance: userData.balance || 0,
      bonus_points: userData.bonus_points || 0,
      order_count: userData.order_count || 0,
      initialized: true,
    })
  },

  addBalance: (amount) => set({ balance: get().balance + amount }),
  deductBalance: (amount) => set({ balance: Math.max(0, get().balance - amount) }),
  deductBonus: (amount) => set({ bonus_points: Math.max(0, get().bonus_points - amount) }),
  addBonuses: (amount) => set({ bonus_points: get().bonus_points + amount }),
  incrementOrders: () => set({ order_count: get().order_count + 1 }),
}))
