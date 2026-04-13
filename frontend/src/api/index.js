import axios from 'axios'
import {
  MOCK_PRODUCTS, MOCK_ORDERS, MOCK_STATS, MOCK_COURIERS,
  MOCK_SETTINGS, DEMO_USERS, MOCK_NOTIFICATIONS, MOCK_SUPPORT_CHATS,
  MOCK_CLIENT_DETAILS, MOCK_COURIER_DETAILS,
  MOCK_CASH_DEBTS, MOCK_COOLERS, MOCK_WAREHOUSE,
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

export const markDelivered = (orderId, cashCollected) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/delivered`, { cash_collected: cashCollected }).then(r => r.data),
    () => {
      const order = mockOrdersStore.find(o => o.id === orderId)
      if (order) {
        order.status = 'delivered'
        if (order.payment_method === 'cash') order.cash_collected = !!cashCollected
      }
      return { ok: true }
    }
  )

export const courierInDelivery = markInDelivery
export const courierDelivered = markDelivered

export const courierAccept = (orderId) =>
  safeCall(
    () => http.patch(`/orders/${orderId}/courier_accept`).then(r => r.data),
    () => ({ ok: true })
  )

// ─── Reviews ─────────────────────────────────────────────────────────────────
let mockReviews = []

export const createReview = (data) =>
  safeCall(
    () => http.post('/orders/reviews/', data).then(r => r.data),
    () => {
      const review = { id: Date.now(), ...data, created_at: new Date().toISOString() }
      mockReviews.unshift(review)
      // Attach to order
      const order = mockOrdersStore.find(o => o.id === data.order_id)
      if (order) { order.review_id = review.id; order.review_rating = data.rating }
      return review
    }
  )

export const getCourierReviews = (courierId) =>
  safeCall(
    () => http.get(`/couriers/${courierId}/reviews`).then(r => r.data),
    () => mockReviews.filter(r => r.courier_id === courierId || r.courier_id === Number(courierId))
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

// ─── Client details (bottles, transactions, subscriptions, addresses) ────────
export const getClientDetails = (userId) =>
  safeCall(
    () => http.get(`/admin/users/${userId}/details`).then(r => r.data),
    () => MOCK_CLIENT_DETAILS[userId] || { bottles_owed: 0, bottles_history: [], transactions: [], subscriptions: [], addresses: [] }
  )

export const getCourierDetails = (courierId) =>
  safeCall(
    () => http.get(`/admin/couriers/${courierId}/details`).then(r => r.data),
    () => MOCK_COURIER_DETAILS[courierId] || { total_deliveries: 0, today_deliveries: 0, earnings_total: 0, earnings_today: 0, rating: 0, avg_delivery_time: 0, recent_deliveries: [], zones: [] }
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
    () => {
      // Base mock stats
      const base = { delivery_count: 47, today_count: 3, earnings: 9400, rating: 4.8, review_count: 12, recent: MOCK_ORDERS.slice(0, 3) }
      // If any reviews were submitted for this courier, incorporate them
      const courierReviews = mockReviews.filter(r => !r.courier_id || r.courier_id === telegramId || r.courier_id === Number(telegramId))
      if (courierReviews.length > 0) {
        const sum = courierReviews.reduce((s, r) => s + (r.rating || 0), 0)
        const totalRating = base.rating * base.review_count + sum
        const totalCount = base.review_count + courierReviews.length
        base.rating = Number((totalRating / totalCount).toFixed(2))
        base.review_count = totalCount
      }
      return base
    }
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

// ─── Cash debt tracking ─────────────────────────────────────────────────────
let mockCashDebts = [...MOCK_CASH_DEBTS]

export const getCashDebts = (courierId) =>
  safeCall(
    () => http.get(`/couriers/${courierId}/cash_debts`).then(r => r.data),
    () => mockCashDebts.filter(d => d.courier_id === courierId && d.clearance_status !== 'approved')
  )

export const getAllCashDebts = () =>
  safeCall(
    () => http.get('/admin/cash_debts').then(r => r.data),
    () => mockCashDebts
  )

export const requestDebtClearance = (debtId) =>
  safeCall(
    () => http.post(`/couriers/cash_debts/${debtId}/request_clearance`).then(r => r.data),
    () => {
      mockCashDebts = mockCashDebts.map(d => d.id === debtId ? { ...d, clearance_status: 'pending' } : d)
      return { ok: true }
    }
  )

export const approveDebtClearance = (debtId) =>
  safeCall(
    () => http.patch(`/admin/cash_debts/${debtId}/approve`).then(r => r.data),
    () => {
      mockCashDebts = mockCashDebts.map(d => d.id === debtId ? { ...d, clearance_status: 'approved' } : d)
      return { ok: true }
    }
  )

export const rejectDebtClearance = (debtId) =>
  safeCall(
    () => http.patch(`/admin/cash_debts/${debtId}/reject`).then(r => r.data),
    () => {
      mockCashDebts = mockCashDebts.map(d => d.id === debtId ? { ...d, clearance_status: 'rejected' } : d)
      return { ok: true }
    }
  )

// ─── Client lookup by phone ───────────────────────────────────────────────
export const lookupClientByPhone = (phone) =>
  safeCall(
    () => http.get(`/users/lookup?phone=${encodeURIComponent(phone)}`).then(r => r.data),
    () => {
      const normalized = phone.replace(/\D/g, '')
      const found = Object.values(DEMO_USERS).find(u => {
        return u.phone.replace(/\D/g, '') === normalized && u.role === 'client'
      })
      if (!found) return null
      const details = MOCK_CLIENT_DETAILS[found.id]
      return {
        id: found.id,
        name: found.name,
        phone: found.phone,
        bottles_owed: details?.bottles_owed || 0,
        addresses: details?.addresses || [],
      }
    }
  )

// ─── Courier create order ───────────────────────────────────────────────────
export const courierCreateOrder = (data) =>
  safeCall(
    () => http.post('/couriers/orders', data).then(r => r.data),
    () => {
      const newOrder = {
        id: Date.now(),
        status: 'assigned_to_courier',
        client_name: data.client_name,
        recipient_phone: data.recipient_phone,
        address: data.address,
        total: data.total,
        payment_method: 'cash',
        payment_confirmed: true,
        courier_id: data.courier_id,
        created_at: new Date().toISOString(),
        items: data.items || [],
        user_id: data.user_id || null,
      }
      mockOrdersStore = [newOrder, ...mockOrdersStore]
      return newOrder
    }
  )

// ─── Cooler management ──────────────────────────────────────────────────────
export const getClientCoolers = (userId) =>
  safeCall(
    () => http.get(`/admin/users/${userId}/coolers`).then(r => r.data),
    () => MOCK_COOLERS[userId] || []
  )

export const addClientCooler = (userId, data) =>
  safeCall(
    () => http.post(`/admin/users/${userId}/coolers`, data).then(r => r.data),
    () => {
      const cooler = { id: Date.now(), ...data, status: 'active' }
      if (!MOCK_COOLERS[userId]) MOCK_COOLERS[userId] = []
      MOCK_COOLERS[userId].push(cooler)
      return cooler
    }
  )

export const removeClientCooler = (userId, coolerId) =>
  safeCall(
    () => http.delete(`/admin/users/${userId}/coolers/${coolerId}`).then(r => r.data),
    () => {
      if (MOCK_COOLERS[userId]) MOCK_COOLERS[userId] = MOCK_COOLERS[userId].filter(c => c.id !== coolerId)
      return { ok: true }
    }
  )

// ─── Warehouse ──────────────────────────────────────────────────────────────
export const getWarehouseStock = () =>
  safeCall(
    () => http.get('/warehouse/stock').then(r => r.data),
    () => ({ stock: MOCK_WAREHOUSE.stock, history: MOCK_WAREHOUSE.history, courier_water: MOCK_WAREHOUSE.courier_water })
  )

export const addProduction = (productName, quantity, note) =>
  safeCall(
    () => http.post('/warehouse/production', { product_name: productName, quantity, note }).then(r => r.data),
    () => {
      const item = MOCK_WAREHOUSE.stock.find(s => s.product_name === productName)
      if (item) item.quantity += quantity
      MOCK_WAREHOUSE.history.unshift({ id: Date.now(), type: 'production', product_name: productName, quantity, date: new Date().toISOString(), note })
      return { ok: true }
    }
  )

export const issueWaterToCourier = (courierId, courierName, productName, quantity) =>
  safeCall(
    () => http.post('/warehouse/issue', { courier_id: courierId, product_name: productName, quantity }).then(r => r.data),
    () => {
      const item = MOCK_WAREHOUSE.stock.find(s => s.product_name === productName)
      if (item) item.quantity = Math.max(0, item.quantity - quantity)
      MOCK_WAREHOUSE.history.unshift({ id: Date.now(), type: 'issued', product_name: productName, quantity, date: new Date().toISOString(), courier_name: courierName, courier_id: courierId })
      if (!MOCK_WAREHOUSE.courier_water[courierId]) MOCK_WAREHOUSE.courier_water[courierId] = {}
      MOCK_WAREHOUSE.courier_water[courierId][productName] = (MOCK_WAREHOUSE.courier_water[courierId][productName] || 0) + quantity
      return { ok: true }
    }
  )

export const returnWaterFromCourier = (courierId, courierName, productName, quantity) =>
  safeCall(
    () => http.post('/warehouse/return', { courier_id: courierId, product_name: productName, quantity }).then(r => r.data),
    () => {
      const item = MOCK_WAREHOUSE.stock.find(s => s.product_name === productName)
      if (item) item.quantity += quantity
      MOCK_WAREHOUSE.history.unshift({ id: Date.now(), type: 'returned', product_name: productName, quantity, date: new Date().toISOString(), courier_name: courierName, courier_id: courierId })
      if (MOCK_WAREHOUSE.courier_water[courierId]) {
        MOCK_WAREHOUSE.courier_water[courierId][productName] = Math.max(0, (MOCK_WAREHOUSE.courier_water[courierId][productName] || 0) - quantity)
        if (MOCK_WAREHOUSE.courier_water[courierId][productName] === 0) delete MOCK_WAREHOUSE.courier_water[courierId][productName]
      }
      return { ok: true }
    }
  )

export const getCourierWater = (courierId) =>
  safeCall(
    () => http.get(`/couriers/${courierId}/water`).then(r => r.data),
    () => MOCK_WAREHOUSE.courier_water[courierId] || {}
  )

// ─── Warehouse analytics (computed from orders + stock) ───────────────────────
const isSameDay = (d1, d2) => {
  const a = new Date(d1), b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const ACTIVE_STATUSES = ['awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery']

// Dashboard aggregate: stock vs demand vs production/issue/return activity
export const getWarehouseOverview = () =>
  safeCall(
    () => http.get('/warehouse/overview').then(r => r.data),
    () => {
      const today = new Date()
      const stock = MOCK_WAREHOUSE.stock.map(s => ({ ...s }))
      const history = MOCK_WAREHOUSE.history

      // Per-product: reserved (active orders), delivered_today, on_couriers, needed_today
      const perProduct = {}
      stock.forEach(s => {
        perProduct[s.product_name] = {
          product_name: s.product_name,
          stock: s.quantity,
          reserved: 0,
          needed_today: 0,
          delivered_today: 0,
          on_couriers: 0,
          produced_today: 0,
          issued_today: 0,
          returned_today: 0,
        }
      })

      const ensureProduct = (name) => {
        if (!perProduct[name]) {
          perProduct[name] = {
            product_name: name, stock: 0, reserved: 0, needed_today: 0,
            delivered_today: 0, on_couriers: 0, produced_today: 0, issued_today: 0, returned_today: 0,
          }
        }
        return perProduct[name]
      }

      // Walk orders
      let activeCount = 0, awaitingCount = 0, deliveredTodayCount = 0
      let bottlesReturnedToday = 0, bottlesOwedTotal = 0
      mockOrdersStore.forEach(o => {
        if (o.type === 'topup') return
        const isActive = ACTIVE_STATUSES.includes(o.status)
        const isDeliveredToday = o.status === 'delivered' && isSameDay(o.created_at || o.delivery_date, today)
        const isToday = o.delivery_date === 'Сегодня'

        if (isActive) activeCount++
        if (o.status === 'awaiting_confirmation') awaitingCount++
        if (isDeliveredToday) {
          deliveredTodayCount++
          bottlesReturnedToday += o.return_bottles_count || 0
        }
        bottlesOwedTotal += o.bottles_owed || 0

        ;(o.items || []).forEach(it => {
          const p = ensureProduct(it.product_name)
          if (isActive) {
            p.reserved += it.quantity
            if (isToday) p.needed_today += it.quantity
          }
          if (isDeliveredToday) p.delivered_today += it.quantity
        })
      })

      // On-courier totals from courier_water
      Object.values(MOCK_WAREHOUSE.courier_water || {}).forEach(inv => {
        Object.entries(inv).forEach(([name, qty]) => {
          ensureProduct(name).on_couriers += qty
        })
      })

      // Today production/issue/return per product
      history.forEach(h => {
        if (!isSameDay(h.date, today)) return
        const p = ensureProduct(h.product_name)
        if (h.type === 'production') p.produced_today += h.quantity
        if (h.type === 'issued' || h.type === 'issue') p.issued_today += h.quantity
        if (h.type === 'returned' || h.type === 'return') p.returned_today += h.quantity
      })

      // Compute shortfall for each product (stock + on_couriers vs reserved)
      const products = Object.values(perProduct).map(p => ({
        ...p,
        available: p.stock + p.on_couriers,
        shortfall: Math.max(0, p.reserved - (p.stock + p.on_couriers)),
      }))

      // Totals
      const totals = {
        stock: products.reduce((s, p) => s + p.stock, 0),
        reserved: products.reduce((s, p) => s + p.reserved, 0),
        needed_today: products.reduce((s, p) => s + p.needed_today, 0),
        delivered_today: products.reduce((s, p) => s + p.delivered_today, 0),
        on_couriers: products.reduce((s, p) => s + p.on_couriers, 0),
        produced_today: products.reduce((s, p) => s + p.produced_today, 0),
        issued_today: products.reduce((s, p) => s + p.issued_today, 0),
        returned_today: products.reduce((s, p) => s + p.returned_today, 0),
        shortfall: products.reduce((s, p) => s + p.shortfall, 0),
        active_orders: activeCount,
        awaiting_orders: awaitingCount,
        delivered_today_orders: deliveredTodayCount,
        bottles_returned_today: bottlesReturnedToday,
        bottles_owed_total: bottlesOwedTotal,
      }

      return { products, totals, history }
    }
  )

// Per-courier warehouse-relevant stats
export const getWarehouseCourierStats = () =>
  safeCall(
    () => http.get('/warehouse/couriers').then(r => r.data),
    () => {
      const today = new Date()
      const couriers = MOCK_COURIERS.filter(c => c.is_active)
      const history = MOCK_WAREHOUSE.history

      return couriers.map(c => {
        const water = MOCK_WAREHOUSE.courier_water[c.id] || {}
        const onHand = Object.values(water).reduce((s, v) => s + v, 0)

        const courierHist = history.filter(h => h.courier_id === c.id)
        const issuedToday = courierHist
          .filter(h => (h.type === 'issued' || h.type === 'issue') && isSameDay(h.date, today))
          .reduce((s, h) => s + h.quantity, 0)
        const returnedToday = courierHist
          .filter(h => (h.type === 'returned' || h.type === 'return') && isSameDay(h.date, today))
          .reduce((s, h) => s + h.quantity, 0)

        // Orders assigned / delivered today
        const courierOrders = mockOrdersStore.filter(o =>
          o.courier_id === c.id || o.courier_id === Number(c.id) || o.courier_id === c.telegram_id
        )
        const activeOrders = courierOrders.filter(o => ACTIVE_STATUSES.includes(o.status))
        const deliveredToday = courierOrders.filter(o => o.status === 'delivered' && isSameDay(o.created_at || new Date(), today))
        const bottlesReturnedToday = deliveredToday.reduce((s, o) => s + (o.return_bottles_count || 0), 0)

        // Per-product deliveries today
        const deliveredProducts = {}
        deliveredToday.forEach(o => (o.items || []).forEach(it => {
          deliveredProducts[it.product_name] = (deliveredProducts[it.product_name] || 0) + it.quantity
        }))

        // Cash debt
        const debts = mockCashDebts.filter(d => d.courier_id === c.id && d.clearance_status !== 'approved')
        const debtAmount = debts.reduce((s, d) => s + (d.amount || 0), 0)

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          telegram_id: c.telegram_id,
          water,
          on_hand: onHand,
          issued_today: issuedToday,
          returned_today: returnedToday,
          active_orders: activeOrders.length,
          delivered_today: deliveredToday.length,
          delivered_products: deliveredProducts,
          bottles_returned_today: bottlesReturnedToday,
          cash_debt: debtAmount,
        }
      })
    }
  )

// Filtered warehouse history
export const getWarehouseHistory = (filters = {}) =>
  safeCall(
    () => http.get('/warehouse/history', { params: filters }).then(r => r.data),
    () => {
      const { period, type, product, courier_id, from, to } = filters
      let list = [...MOCK_WAREHOUSE.history]

      if (type && type !== 'all') {
        list = list.filter(h => {
          if (type === 'production') return h.type === 'production'
          if (type === 'issue') return h.type === 'issued' || h.type === 'issue'
          if (type === 'return') return h.type === 'returned' || h.type === 'return'
          return true
        })
      }
      if (product && product !== 'all') list = list.filter(h => h.product_name === product)
      if (courier_id) list = list.filter(h => h.courier_id === courier_id)

      const now = new Date()
      if (period === 'today') {
        list = list.filter(h => isSameDay(h.date, now))
      } else if (period === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1)
        list = list.filter(h => isSameDay(h.date, y))
      } else if (period === 'week') {
        const w = new Date(now); w.setDate(w.getDate() - 7)
        list = list.filter(h => new Date(h.date) >= w)
      } else if (period === 'custom' && from) {
        const fromD = new Date(from)
        list = list.filter(h => new Date(h.date) >= fromD)
        if (to) {
          const toD = new Date(to); toD.setHours(23, 59, 59)
          list = list.filter(h => new Date(h.date) <= toD)
        }
      }

      return list.sort((a, b) => new Date(b.date) - new Date(a.date))
    }
  )

// Production planning based on subscriptions + active orders
export const getProductionPlan = () =>
  safeCall(
    () => http.get('/warehouse/production_plan').then(r => r.data),
    () => {
      const planByProduct = {}
      const activeSubs = []

      // Walk all client subscriptions
      Object.entries(MOCK_CLIENT_DETAILS).forEach(([userId, details]) => {
        ;(details.subscriptions || []).filter(s => s.status === 'active').forEach(s => {
          activeSubs.push({ ...s, user_id: Number(userId) })
          // Parse "Вода 20л × 2" format
          const match = s.plan?.match(/^(.+?)\s*×\s*(\d+)$/)
          if (match) {
            const [, name, qty] = match
            const productName = name.trim()
            planByProduct[productName] = (planByProduct[productName] || 0) + Number(qty)
          }
        })
      })

      // Upcoming demand from active orders (not delivered yet)
      const upcoming = {}
      mockOrdersStore.forEach(o => {
        if (o.type === 'topup') return
        if (!ACTIVE_STATUSES.includes(o.status)) return
        ;(o.items || []).forEach(it => {
          upcoming[it.product_name] = (upcoming[it.product_name] || 0) + it.quantity
        })
      })

      // Recommendation: what to produce more of
      const recommendations = []
      MOCK_WAREHOUSE.stock.forEach(s => {
        const needed = (upcoming[s.product_name] || 0) + (planByProduct[s.product_name] || 0)
        if (needed > s.quantity) {
          recommendations.push({
            product_name: s.product_name,
            current: s.quantity,
            needed,
            produce: needed - s.quantity,
            priority: needed - s.quantity > 20 ? 'high' : 'medium',
          })
        }
      })

      return {
        subscriptions: activeSubs,
        subscription_demand: planByProduct,
        upcoming_demand: upcoming,
        recommendations: recommendations.sort((a, b) => b.produce - a.produce),
      }
    }
  )
