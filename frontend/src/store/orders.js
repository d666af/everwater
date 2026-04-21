import { create } from 'zustand'

export const useOrdersStore = create((set, get) => ({
  orders: [],
  loaded: false,

  setOrders: (orders) => set({ orders, loaded: true }),
  addOrder: (order) => set({ orders: [order, ...get().orders] }),
  updateStatus: (id, status) =>
    set({ orders: get().orders.map(o => o.id === id ? { ...o, status } : o) }),
}))
