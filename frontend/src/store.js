import { create } from 'zustand'

export const useCartStore = create((set, get) => ({
  items: [],   // { product, quantity }

  addToCart: (product) => {
    const items = get().items
    const existing = items.find(i => i.product.id === product.id)
    if (existing) {
      set({ items: items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) })
    } else {
      set({ items: [...items, { product, quantity: 1 }] })
    }
  },

  removeFromCart: (productId) =>
    set({ items: get().items.filter(i => i.product.id !== productId) }),

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter(i => i.product.id !== productId) })
    } else {
      set({ items: get().items.map(i => i.product.id === productId ? { ...i, quantity } : i) })
    }
  },

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
}))
