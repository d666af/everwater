import { create } from 'zustand'
import { getUserAddresses, saveUserAddresses } from '../api/index.js'

const LS_ADDRESSES = 'everwater_saved_addresses'
const LS_BOTTLES = 'everwater_bottles_owed'
const LS_SURVEY = 'everwater_survey'
const LS_SUBS = 'everwater_subscriptions'

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

export const useUserStore = create((set, get) => ({
  id: null,
  telegram_id: null,
  balance: 0,
  bonus_points: 0,
  order_count: 0,
  initialized: false,

  // Bottle tracking
  bottles_owed: loadLS(LS_BOTTLES, 0),

  // Saved addresses
  saved_addresses: loadLS(LS_ADDRESSES, []),

  // Subscriptions
  subscriptions: loadLS(LS_SUBS, []),

  // Survey
  survey_done: !!loadLS(LS_SURVEY, null),
  external_bottles: loadLS(LS_SURVEY, {}).count || 0,

  init: (userData) => {
    if (!userData) return
    const update = {
      id: userData.id || null,
      telegram_id: userData.telegram_id || null,
      balance: userData.balance || 0,
      bonus_points: userData.bonus_points || 0,
      order_count: userData.order_count || 0,
      initialized: true,
    }
    // If backend returned saved_addresses, use them (merge with localStorage by preferring DB)
    if (Array.isArray(userData.saved_addresses) && userData.saved_addresses.length > 0) {
      update.saved_addresses = userData.saved_addresses
      localStorage.setItem(LS_ADDRESSES, JSON.stringify(userData.saved_addresses))
    } else if (userData.id) {
      // Load from DB asynchronously; no need to block init
      getUserAddresses(userData.id).then(addrs => {
        if (Array.isArray(addrs) && addrs.length > 0) {
          localStorage.setItem(LS_ADDRESSES, JSON.stringify(addrs))
          set({ saved_addresses: addrs })
        }
      }).catch(() => {})
    }
    set(update)
  },

  addBalance: (amount) => set({ balance: get().balance + amount }),
  deductBalance: (amount) => set({ balance: Math.max(0, get().balance - amount) }),
  deductBonus: (amount) => set({ bonus_points: Math.max(0, get().bonus_points - amount) }),
  addBonuses: (amount) => set({ bonus_points: get().bonus_points + amount }),
  incrementOrders: () => set({ order_count: get().order_count + 1 }),

  // Bottles owed
  addBottlesOwed: (count) => {
    const v = get().bottles_owed + count
    localStorage.setItem(LS_BOTTLES, JSON.stringify(v))
    set({ bottles_owed: v })
  },
  returnBottles: (count) => {
    const v = Math.max(0, get().bottles_owed - count)
    localStorage.setItem(LS_BOTTLES, JSON.stringify(v))
    set({ bottles_owed: v })
  },
  setBottlesOwed: (count) => {
    const v = Math.max(0, count)
    localStorage.setItem(LS_BOTTLES, JSON.stringify(v))
    set({ bottles_owed: v })
  },

  // Saved addresses
  addSavedAddress: (addr) => {
    const list = [...get().saved_addresses, { ...addr, id: Date.now() }].slice(-10)
    localStorage.setItem(LS_ADDRESSES, JSON.stringify(list))
    set({ saved_addresses: list })
    const userId = get().id
    if (userId) saveUserAddresses(userId, list).catch(() => {})
  },
  removeSavedAddress: (id) => {
    const list = get().saved_addresses.filter(a => a.id !== id)
    localStorage.setItem(LS_ADDRESSES, JSON.stringify(list))
    set({ saved_addresses: list })
    const userId = get().id
    if (userId) saveUserAddresses(userId, list).catch(() => {})
  },

  // Subscriptions
  addSubscription: (sub) => {
    const list = [...get().subscriptions, { ...sub, id: Date.now(), status: 'active', created: new Date().toISOString() }]
    localStorage.setItem(LS_SUBS, JSON.stringify(list))
    set({ subscriptions: list })
  },

  // Survey
  completeSurvey: (externalBottles) => {
    const data = { count: externalBottles, done: true }
    localStorage.setItem(LS_SURVEY, JSON.stringify(data))
    // Add external bottles to owed count
    const newOwed = get().bottles_owed + externalBottles
    localStorage.setItem(LS_BOTTLES, JSON.stringify(newOwed))
    set({ survey_done: true, external_bottles: externalBottles, bottles_owed: newOwed })
  },
}))
