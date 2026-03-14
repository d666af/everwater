import axios from 'axios'
import {
  MOCK_PRODUCTS, MOCK_ORDERS, MOCK_STATS, MOCK_COURIERS,
  MOCK_SETTINGS, DEMO_USERS, MOCK_NOTIFICATIONS, MOCK_SUPPORT_CHATS,
} from './mock'

const BASE = import.meta.env.VITE_API_URL || '/api'

const http = axios.create({
  baseURL: BASE,
  timeout: 8000,
})

// ─── Mock mode detection ─────────────────────────────────────────────────────
// Uses mock when VITE_MOCK=true or when backend is unreachable
const MOCK_MODE = import.meta.env.VITE_MOCK === 'true'

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms))

// ─── In-memory mock orders store (persists within session) ───────────────────
let mockOrdersStore = [...MOCK_ORDERS]

async function safeCall(apiFn, mockFn) {
  if (MOCK_MODE) {
    await delay()
    return mockFn()
  }
  try {
    return await apiFn()
  } catch (err) {
    // Network errors OR 503 from our vite proxy error handler → use mock
    const noBackend =
      err.code === 'ECONNABORTED' ||
      err.code === 'ERR_NETWORK' ||
      !err.response ||
      err.response?.status === 503
    if (noBackend) {
      console.warn('[API] Backend unreachable, using mock data')
      await delay()
      return mockFn()
    }
    throw err
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const loginByPhone = async (phone) => {
  const normalized = phone.replace(/\D/g, '')
  return safeCall(
    async () => {
      const res = await http.post('/auth/login', { phone })
      return res.data
    },
    () => {
      // Mock: match by last 11 digits
      const match = Object.entries(DEMO_USERS).find(([k]) =>
        k.replace(/\D/g, '').endsWith(normalized.slice(-10))
      )
      if (match) return { ...match[1], token: 'mock-token' }
      throw new Error('Пользователь не найден. Обратитесь к администратору.')
    }
  )
}

// ─── Products ────────────────────────────────────────────────────────────────
export const getProducts = (includeInactive = false) =>
  safeCall(
    () => http.get('/products/', { params: includeInactive ? { include_inactive: true } : {} }).then(r => r.data),
    () => includeInactive ? MOCK_PRODUCTS : MOCK_PRODUCTS.filter(p => p.is_active)
  )

export const createProduct = (data) =>
  safeCall(
    () => http.post('/products/', data).then(r => r.data),
    () => ({ id: Date.now(), ...data })
  )

export const updateProduct = (id, data) =>
  safeCall(
    () => http.patch(`/products/${id}`, data).then(r => r.data),
    () => ({ id, ...data })
  )

export const deleteProduct = (id) =>
  safeCall(
    () => http.delete(`/products/${id}`).then(r => r.data),
    () => ({ ok: true })
  )

// ─── Orders ──────────────────────────────────────────────────────────────────
export const createOrder = (data) =>
  safeCall(
    () => http.post('/orders/', data).then(r => r.data),
    () => {
      // Compute total from actual cart items (use product price from data if available)
      const total = Math.max(
        0,
        (data.items?.reduce((s, i) => s + i.quantity * (i.price || 25000), 0) || 0)
        - (Number(data.bonus_used) || 0)
        - (Number(data.balance_used) || 0)
      )
      const newOrder = {
        id: Date.now(),
        status: 'awaiting_confirmation',
        address: data.address,
        extra_info: data.extra_info,
        delivery_time: data.delivery_time,
        recipient_phone: data.recipient_phone,
        total,
        bonus_used: data.bonus_used || 0,
        balance_used: data.balance_used || 0,
        bottle_discount: data.bottle_discount || 0,
        return_bottles_count: data.return_bottles_count || 0,
        items: (data.items || []).map((i, idx) => ({
          id: idx + 1,
          product_id: i.product_id,
          product_name: `Товар #${i.product_id}`,
          quantity: i.quantity,
          price: i.price || 25000,
        })),
        ...data,
      }
      mockOrdersStore = [newOrder, ...mockOrdersStore]
      return newOrder
    }
  )

export const getOrder = (orderId) =>
  safeCall(
    () => http.get(`/orders/${orderId}`).then(r => r.data),
    () => MOCK_ORDERS.find(o => o.id === orderId) || MOCK_ORDERS[0]
  )

export const getUserOrders = (userId) =>
  safeCall(
    () => http.get(`/orders/user/${userId}`).then(r => r.data),
    () => mockOrdersStore
  )

export const getOrders = (params = {}) =>
  safeCall(
    () => http.get('/orders/', { params }).then(r => r.data),
    () => {
      let list = [...MOCK_ORDERS]
      if (params.status) list = list.filter(o => o.status === params.status)
      return list
    }
  )

export const paymentConfirmed = (orderId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/payment_confirmed`).then(r => r.data),
    () => ({ ok: true })
  )

export const confirmOrder = (orderId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/confirm`).then(r => r.data),
    () => ({ ok: true })
  )

export const rejectOrder = (orderId, reason) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/reject`, { reason }).then(r => r.data),
    () => ({ ok: true })
  )

export const assignCourier = (orderId, courierId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/assign_courier`, { courier_id: courierId }).then(r => r.data),
    () => ({ ok: true })
  )

export const markInDelivery = (orderId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/in_delivery`).then(r => r.data),
    () => ({ ok: true })
  )

export const markDelivered = (orderId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/delivered`).then(r => r.data),
    () => ({ ok: true })
  )

export const courierInDelivery = markInDelivery
export const courierDelivered = markDelivered

export const courierAccept = (orderId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/courier_accept`).then(r => r.data),
    () => ({ ok: true })
  )

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const createReview = (data) =>
  safeCall(
    () => http.post('/orders/reviews/', data).then(r => r.data),
    () => ({ id: Date.now(), ...data })
  )

// ─── Users ───────────────────────────────────────────────────────────────────
export const getUserByTelegram = (tgId) =>
  safeCall(
    () => http.get(`/users/by_telegram/${tgId}`).then(r => r.data),
    () => ({ id: 1, telegram_id: tgId, name: 'Demo User', phone: '+7 999 000-00-00', bonus_points: 3500, balance: 50000, order_count: 7, is_registered: true })
  )

export const createOrGetUser = (data) =>
  safeCall(
    () => http.post('/users/', data).then(r => r.data),
    () => ({ id: Date.now(), ...data })
  )

export const updateUser = (tgId, data) =>
  safeCall(
    () => http.patch(`/users/${tgId}`, data).then(r => r.data),
    () => ({ ok: true })
  )

// ─── Admin ───────────────────────────────────────────────────────────────────
export const getAdminStats = (period = 'day') =>
  safeCall(
    () => http.get('/admin/stats', { params: { period } }).then(r => r.data),
    () => MOCK_STATS[period] || MOCK_STATS.day
  )

export const getAdminCouriers = () =>
  safeCall(
    () => http.get('/admin/couriers').then(r => r.data),
    () => MOCK_COURIERS
  )

export const createCourier = (data) =>
  safeCall(
    () => http.post('/admin/couriers', data).then(r => r.data),
    () => ({ id: Date.now(), ...data, is_active: true, delivery_count: 0 })
  )

export const deleteCourier = (id) =>
  safeCall(
    () => http.delete(`/admin/couriers/${id}`).then(r => r.data),
    () => ({ ok: true })
  )

export const getAdminUsers = () =>
  safeCall(
    () => http.get('/admin/users').then(r => r.data),
    () => [
      { id: 1, name: 'Иван Иванов', phone: '+7 999 001-01-01', telegram_id: '11111', bonus_points: 350, balance: 0, is_registered: true },
      { id: 2, name: 'Мария Петрова', phone: '+7 999 002-02-02', telegram_id: '22222', bonus_points: 120, balance: 500, is_registered: true },
      { id: 3, name: '', phone: '', telegram_id: '33333', bonus_points: 0, balance: 0, is_registered: false },
    ]
  )

// ─── Settings ────────────────────────────────────────────────────────────────
export const getSettings = () =>
  safeCall(
    () => http.get('/admin/settings').then(r => r.data),
    () => ({ ...MOCK_SETTINGS })
  )

export const updateSettings = (data) =>
  safeCall(
    () => http.patch('/admin/settings', data).then(r => r.data),
    () => ({ ok: true, ...data })
  )

// ─── Courier ─────────────────────────────────────────────────────────────────
export const getCourierOrders = (telegramId) =>
  safeCall(
    () => http.get(`/couriers/${telegramId}/orders`).then(r => r.data),
    () => MOCK_ORDERS.filter(o => ['assigned_to_courier', 'in_delivery', 'delivered'].includes(o.status))
  )

export const getCourierStats = (telegramId) =>
  safeCall(
    () => http.get(`/couriers/${telegramId}/stats`).then(r => r.data),
    () => ({ delivery_count: 47, today_count: 3, earnings: 9400, rating: 4.8, recent: MOCK_ORDERS.slice(0, 3) })
  )

// ─── Notifications ────────────────────────────────────────────────────────────
let mockNotifications = [...MOCK_NOTIFICATIONS]

export const getNotifications = () =>
  safeCall(
    () => http.get('/admin/notifications').then(r => r.data),
    () => [...mockNotifications]
  )

export const markNotificationRead = (id) =>
  safeCall(
    () => http.patch(`/admin/notifications/${id}/read`).then(r => r.data),
    () => {
      mockNotifications = mockNotifications.map(n => n.id === id ? { ...n, read: true } : n)
      return { ok: true }
    }
  )

export const markAllNotificationsRead = () =>
  safeCall(
    () => http.patch('/admin/notifications/read_all').then(r => r.data),
    () => {
      mockNotifications = mockNotifications.map(n => ({ ...n, read: true }))
      return { ok: true }
    }
  )

// ─── Support / Chat ───────────────────────────────────────────────────────────
let mockChats = MOCK_SUPPORT_CHATS.map(c => ({ ...c, messages: [...c.messages] }))

export const getSupportChats = () =>
  safeCall(
    () => http.get('/admin/support/chats').then(r => r.data),
    () => mockChats.map(c => ({ ...c, messages: [...c.messages] }))
  )

export const getSupportMessages = (chatId) =>
  safeCall(
    () => http.get(`/admin/support/chats/${chatId}/messages`).then(r => r.data),
    () => {
      const chat = mockChats.find(c => c.id === chatId)
      return chat ? [...chat.messages] : []
    }
  )

export const sendSupportMessage = (chatId, text) =>
  safeCall(
    () => http.post(`/admin/support/chats/${chatId}/messages`, { text }).then(r => r.data),
    () => {
      const msg = { id: Date.now(), from: 'support', text, time: new Date() }
      mockChats = mockChats.map(c =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, msg], last_message: text, last_time: new Date(), unread: 0 }
          : c
      )
      return msg
    }
  )

export const markChatRead = (chatId) =>
  safeCall(
    () => http.patch(`/admin/support/chats/${chatId}/read`).then(r => r.data),
    () => {
      mockChats = mockChats.map(c => c.id === chatId ? { ...c, unread: 0 } : c)
      return { ok: true }
    }
  )

// ─── Manager management ───────────────────────────────────────────────────────
const MOCK_MANAGERS = []
export const getAdminManagers = () =>
  safeCall(() => http.get('/admin/managers').then(r => r.data), () => MOCK_MANAGERS)

export const createManager = (data) =>
  safeCall(() => http.post('/admin/managers', data).then(r => r.data), () => ({ id: Date.now(), ...data, is_active: true }))

export const deleteManager = (id) =>
  safeCall(() => http.delete(`/admin/managers/${id}`).then(r => r.data), () => ({ ok: true }))

export const broadcastMessage = (message, target = 'all') =>
  safeCall(() => http.post('/admin/broadcast', { message, target }).then(r => r.data), () => ({ ok: true }))

// ─── Balance top-up confirmation ──────────────────────────────────────────────
export const confirmTopup = (userId, amount) =>
  safeCall(
    () => http.post(`/admin/users/${userId}/topup`, { amount }).then(r => r.data),
    () => ({ ok: true, new_balance: 100000 })
  )
