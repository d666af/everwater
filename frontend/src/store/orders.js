import { create } from 'zustand'
import { MOCK_ORDERS } from '../api/mock'

export const useOrdersStore = create((set, get) => ({
  orders: [...MOCK_ORDERS],

  addOrder: (order) => set({ orders: [order, ...get().orders] }),

  updateStatus: (id, status) =>
    set({ orders: get().orders.map(o => o.id === id ? { ...o, status } : o) }),
}))
