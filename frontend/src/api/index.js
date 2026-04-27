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
export const loginByPhone = async (phone, password = null) => {
  const normalized = phone.replace(/\D/g, '')
  return safeCall(
    async () => {
      const body = { phone }
      if (password !== null) body.password = password
      const res = await http.post('/auth/login', body)
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

export const getRolesByPhone = async (phone) =>
  safeCall(
    async () => {
      const res = await http.get('/auth/roles', { params: { phone } })
      return res.data
    },
    () => null
  )

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
    () => mockOrdersStore.filter(o => !o.user_id || o.user_id === userId)
  )

export const getOrders = (params = {}) =>
  safeCall(
    async () => {
      const [orders, topups, subs] = await Promise.all([
        http.get('/orders/', { params }).then(r => r.data),
        http.get('/admin/topup_requests?status=all').then(r => r.data).catch(() => []),
        http.get('/admin/subscriptions?status=all').then(r => r.data).catch(() => []),
      ])
      return [...orders, ...topups, ...subs]
    },
    () => {
      let list = [...MOCK_ORDERS]
      if (params.status) list = list.filter(o => o.status === params.status)
      return list
    }
  )

export const requestTopup = (userId, amount, telegramId = null) =>
  safeCall(
    () => http.post(`/admin/users/${userId}/topup_request`, { amount, telegram_id: telegramId }).then(r => r.data),
    () => ({ ok: true, id: Date.now() })
  )

export const confirmTopupRequest = (reqId) =>
  safeCall(
    () => http.post(`/admin/topup_requests/${reqId}/confirm`).then(r => r.data),
    () => ({ ok: true })
  )

export const rejectTopupRequest = (reqId) =>
  safeCall(
    () => http.post(`/admin/topup_requests/${reqId}/reject`).then(r => r.data),
    () => ({ ok: true })
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
    () => {
      const order = mockOrdersStore.find(o => o.id === orderId)
      if (order) {
        order.courier_id = Number(courierId)
        const courier = MOCK_COURIERS.find(c => c.id === Number(courierId))
        if (courier) {
          order.courier_name = courier.name
          order.courier_phone = courier.phone
        }
        if (order.status === 'confirmed' || order.status === 'awaiting_confirmation') {
          order.status = 'assigned_to_courier'
        }
      }
      return { ok: true }
    }
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

// ─── Client Support Chat ──────────────────────────────────────────────────────
export const clientSendSupport = (telegramId, userName, text) =>
  safeCall(
    () => http.post('/client/support/send', { telegram_id: telegramId, user_name: userName, text }).then(r => r.data),
    () => ({ ok: true, id: Date.now() })
  )

export const clientGetSupportMessages = (telegramId) =>
  safeCall(
    () => http.get('/client/support/messages', { params: { telegram_id: telegramId } }).then(r => r.data),
    () => []
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

// ─── Bottle debt / survey ────────────────────────────────────────────────────
export const getBottlesOwed = (userId) =>
  safeCall(
    () => http.get(`/client/${userId}/bottles_owed`).then(r => r.data),
    () => ({ count: 0, survey_done: false })
  )

export const answerBottleSurvey = (userId, count) =>
  safeCall(
    () => http.put(`/client/${userId}/bottle_survey`, { count }).then(r => r.data),
    () => ({ ok: true, count, survey_done: true })
  )

export const createSubscription = (userId, data) =>
  safeCall(
    () => http.post(`/client/${userId}/subscriptions`, data).then(r => r.data),
    () => ({ id: Date.now(), status: 'active', payment_confirmed: data.payment_method !== 'card', ...data })
  )

export const confirmSubscription = (subId) =>
  safeCall(
    () => http.post(`/admin/subscriptions/${subId}/confirm`).then(r => r.data),
    () => ({ ok: true })
  )

export const rejectSubscription = (subId) =>
  safeCall(
    () => http.post(`/admin/subscriptions/${subId}/reject`).then(r => r.data),
    () => ({ ok: true })
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
    () => ({
      stock: MOCK_WAREHOUSE.stock.filter(s => isWarehouseProduct(s.product_name)),
      history: MOCK_WAREHOUSE.history.filter(h => isWarehouseProduct(h.product_name)),
      courier_water: Object.fromEntries(
        Object.entries(MOCK_WAREHOUSE.courier_water).map(([cid, inv]) => [
          cid,
          Object.fromEntries(Object.entries(inv).filter(([name]) => isWarehouseProduct(name))),
        ])
      ),
    })
  )

export const addProduction = (productId, quantity, note) =>
  safeCall(
    () => http.post('/warehouse/production', { product_id: productId, quantity, note }).then(r => r.data),
    () => {
      const item = findOrCreateStockRow(productName)
      if (item) item.quantity += quantity
      const short = shortProductName(productName)
      MOCK_WAREHOUSE.history.unshift({ id: Date.now(), type: 'production', product_name: short, quantity, date: new Date().toISOString(), note })
      return { ok: true }
    }
  )

// Helper: find/create stock row by normalized key (keeps display name consistent)
const findOrCreateStockRow = (productName) => {
  const key = normalizeProductKey(productName)
  if (!key) return null
  const short = shortProductName(productName)
  let item = MOCK_WAREHOUSE.stock.find(s => normalizeProductKey(s.product_name) === key)
  if (!item) {
    item = { product_name: short, quantity: 0 }
    MOCK_WAREHOUSE.stock.push(item)
  }
  return item
}

// Helper: normalize courier_water entries to short names (mutate in-place)
const normalizeCourierWater = (courierId) => {
  const inv = MOCK_WAREHOUSE.courier_water[courierId]
  if (!inv) return
  const next = {}
  Object.entries(inv).forEach(([name, qty]) => {
    const short = shortProductName(name)
    next[short] = (next[short] || 0) + qty
  })
  MOCK_WAREHOUSE.courier_water[courierId] = next
}

export const issueWaterToCourier = (courierId, courierName, productName, quantity) =>
  safeCall(
    () => http.post('/warehouse/issue', { courier_id: courierId, product_name: productName, quantity }).then(r => r.data),
    () => {
      const item = findOrCreateStockRow(productName)
      if (item) item.quantity = Math.max(0, item.quantity - quantity)
      const short = shortProductName(productName)
      MOCK_WAREHOUSE.history.unshift({ id: Date.now(), type: 'issued', product_name: short, quantity, date: new Date().toISOString(), courier_name: courierName, courier_id: courierId })
      if (!MOCK_WAREHOUSE.courier_water[courierId]) MOCK_WAREHOUSE.courier_water[courierId] = {}
      normalizeCourierWater(courierId)
      MOCK_WAREHOUSE.courier_water[courierId][short] = (MOCK_WAREHOUSE.courier_water[courierId][short] || 0) + quantity
      return { ok: true }
    }
  )

export const returnWaterFromCourier = (courierId, courierName, productName, quantity) =>
  safeCall(
    () => http.post('/warehouse/return', { courier_id: courierId, product_name: productName, quantity }).then(r => r.data),
    () => {
      const item = findOrCreateStockRow(productName)
      if (item) item.quantity += quantity
      const short = shortProductName(productName)
      MOCK_WAREHOUSE.history.unshift({ id: Date.now(), type: 'returned', product_name: short, quantity, date: new Date().toISOString(), courier_name: courierName, courier_id: courierId })
      if (MOCK_WAREHOUSE.courier_water[courierId]) {
        normalizeCourierWater(courierId)
        MOCK_WAREHOUSE.courier_water[courierId][short] = Math.max(0, (MOCK_WAREHOUSE.courier_water[courierId][short] || 0) - quantity)
        if (MOCK_WAREHOUSE.courier_water[courierId][short] === 0) delete MOCK_WAREHOUSE.courier_water[courierId][short]
      }
      return { ok: true }
    }
  )

export const getCourierWater = (courierId) =>
  safeCall(
    () => http.get(`/couriers/${courierId}/water`).then(r => r.data),
    () => MOCK_WAREHOUSE.courier_water[courierId] || {}
  )

// Issue all items of a specific order to a courier in one shot
export const issueOrderToCourier = (orderId, courierId, courierName) =>
  safeCall(
    () => http.post(`/warehouse/issue_order`, { order_id: orderId, courier_id: courierId }).then(r => r.data),
    async () => {
      const order = mockOrdersStore.find(o => o.id === orderId)
      if (!order) return { ok: false }
      for (const it of (order.items || [])) {
        await issueWaterToCourier(courierId, courierName, it.product_name, it.quantity)
      }
      order.water_issued = true
      return { ok: true }
    }
  )

// ─── Warehouse analytics (computed from orders + stock) ───────────────────────
const isSameDay = (d1, d2) => {
  const a = new Date(d1), b = new Date(d2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const ACTIVE_STATUSES = ['awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery']

// Normalize any water product name into a canonical key (volume + type)
// Works on catalog names ("Вода 0.5 литровая газированная") and short names ("Вода 1.5л газ.")
export const normalizeProductKey = (name) => {
  if (!name) return null
  const lower = String(name).toLowerCase()
  const isCarb = lower.includes('газ')
  const volMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:л|литр)/)
  if (!volMatch) return null
  const vol = parseFloat(volMatch[1].replace(',', '.'))
  return `${vol}-${isCarb ? 'carb' : 'still'}`
}

// Short display name: "Вода 20л" or "Газ. вода 1.5л"
export const shortProductName = (nameOrVol, isCarb) => {
  if (typeof nameOrVol === 'string') {
    const key = normalizeProductKey(nameOrVol)
    if (!key) return nameOrVol
    const [vol, type] = key.split('-')
    return type === 'carb' ? `Газ. вода ${vol}л` : `Вода ${vol}л`
  }
  return isCarb ? `Газ. вода ${nameOrVol}л` : `Вода ${nameOrVol}л`
}

// Product keys that should never appear in the warehouse flow
// (marketing decision — sparkling 5L isn't produced/stocked by the warehouse).
export const WAREHOUSE_EXCLUDED_KEYS = ['5-carb']
export const isWarehouseProduct = (nameOrKey) => {
  const key = nameOrKey?.includes?.('-') ? nameOrKey : normalizeProductKey(nameOrKey)
  return !!key && !WAREHOUSE_EXCLUDED_KEYS.includes(key)
}

// Return active catalog products relevant to the warehouse flow — with
// normalized keys and short names. Excludes warehouse-blacklisted products.
export const getCatalogProducts = () => {
  return MOCK_PRODUCTS
    .filter(p => p.is_active)
    .map(p => ({
      id: p.id,
      name: p.name,
      short_name: shortProductName(p.name),
      key: normalizeProductKey(p.name),
      volume: p.volume,
      type: p.type,
      price: p.price,
    }))
    .filter(p => p.key && !WAREHOUSE_EXCLUDED_KEYS.includes(p.key))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'still' ? -1 : 1
      return b.volume - a.volume
    })
}

// Date helpers
const DAYS_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
const shiftDate = (d, days) => { const r = new Date(d); r.setDate(r.getDate() + days); return r }

// Build a period range { start, end } from period + custom date + optional time range
const buildPeriodRange = (period, customDate, timeFrom, timeTo) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (period === 'today') return { start: new Date(today), end: endOfDay(today) }
  if (period === 'tomorrow') { const d = shiftDate(today, 1); return { start: d, end: endOfDay(d) } }
  if (period === 'yesterday') { const d = shiftDate(today, -1); return { start: d, end: endOfDay(d) } }
  if (period === 'week') return { start: shiftDate(today, -6), end: endOfDay(today) }
  if (period === 'month') return { start: shiftDate(today, -29), end: endOfDay(today) }
  if (period === 'custom' && customDate) {
    const d = new Date(customDate); d.setHours(0, 0, 0, 0)
    const s = new Date(d), e = new Date(d)
    if (timeFrom) { const [h, m] = timeFrom.split(':').map(Number); s.setHours(h || 0, m || 0, 0, 0) }
    if (timeTo)   { const [h, m] = timeTo.split(':').map(Number);   e.setHours(h || 23, m || 59, 59, 999) }
    else          { e.setHours(23, 59, 59, 999) }
    return { start: s, end: e }
  }
  // 'all'
  return { start: new Date(0), end: new Date('9999-12-31') }
}

const endOfDay = (d) => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r }

const inRange = (date, range) => {
  const t = new Date(date).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

// Match order's delivery to a period range (uses created_at and delivery_date tokens)
const orderMatchesPeriod = (order, period, range) => {
  if (order.type === 'topup') return false
  // Special-case human-readable tokens used in mock data
  if (period === 'today' && order.delivery_date === 'Сегодня') return true
  if (period === 'tomorrow' && order.delivery_date === 'Завтра') return true
  // Otherwise fall back to created_at
  return order.created_at ? inRange(order.created_at, range) : false
}

// Dashboard aggregate: stock vs demand vs activity — period-aware
// Iterates CATALOG products so the list is stable across periods.
export const getWarehouseOverview = (period = 'today', customDate = null, timeFrom = null, timeTo = null) =>
  safeCall(
    () => http.get('/warehouse/overview', { params: { period, date: customDate, time_from: timeFrom, time_to: timeTo } }).then(r => r.data),
    () => {
      const range = buildPeriodRange(period, customDate, timeFrom, timeTo)
      const catalog = getCatalogProducts()
      const history = MOCK_WAREHOUSE.history

      // Seed per-product map from catalog
      const perProduct = {}
      catalog.forEach(c => {
        perProduct[c.key] = {
          key: c.key,
          product_id: c.id,
          product_name: c.short_name,
          catalog_name: c.name,
          volume: c.volume,
          type: c.type,
          stock: 0,
          on_couriers: 0,
          needed_period: 0,
          delivered_period: 0,
          produced_period: 0,
          issued_period: 0,
          returned_period: 0,
        }
      })

      // Physical stock → match by key
      MOCK_WAREHOUSE.stock.forEach(s => {
        const key = normalizeProductKey(s.product_name)
        if (key && perProduct[key]) perProduct[key].stock += s.quantity
      })

      // Couriers' on-hand snapshot
      Object.values(MOCK_WAREHOUSE.courier_water || {}).forEach(inv => {
        Object.entries(inv).forEach(([name, qty]) => {
          const key = normalizeProductKey(name)
          if (key && perProduct[key]) perProduct[key].on_couriers += qty
        })
      })

      // Orders → needed/delivered in period
      let neededOrders = 0, deliveredPeriodOrders = 0, bottlesReturnedPeriod = 0, bottlesOwedTotal = 0
      mockOrdersStore.forEach(o => {
        if (o.type === 'topup') return
        bottlesOwedTotal += o.bottles_owed || 0
        if (!orderMatchesPeriod(o, period, range)) return
        const isActive = ACTIVE_STATUSES.includes(o.status)
        const isDelivered = o.status === 'delivered'
        if (isActive) neededOrders++
        if (isDelivered) { deliveredPeriodOrders++; bottlesReturnedPeriod += o.return_bottles_count || 0 }
        ;(o.items || []).forEach(it => {
          const key = normalizeProductKey(it.product_name)
          if (!key || !perProduct[key]) return
          if (isActive) perProduct[key].needed_period += it.quantity
          if (isDelivered) perProduct[key].delivered_period += it.quantity
        })
      })

      // Production/issue/return history in period
      history.forEach(h => {
        if (!inRange(h.date, range)) return
        const key = normalizeProductKey(h.product_name)
        if (!key || !perProduct[key]) return
        if (h.type === 'production') perProduct[key].produced_period += h.quantity
        if (h.type === 'issued' || h.type === 'issue') perProduct[key].issued_period += h.quantity
        if (h.type === 'returned' || h.type === 'return') perProduct[key].returned_period += h.quantity
      })

      const products = Object.values(perProduct).map(p => ({
        ...p,
        total: p.stock + p.on_couriers,
        shortfall: Math.max(0, p.needed_period - (p.stock + p.on_couriers)),
      }))

      const shortfallItems = products.filter(p => p.shortfall > 0).map(p => ({ product_name: p.product_name, qty: p.shortfall }))

      const totals = {
        stock: products.reduce((s, p) => s + p.stock, 0),
        on_couriers: products.reduce((s, p) => s + p.on_couriers, 0),
        total: products.reduce((s, p) => s + p.total, 0),
        needed_period: products.reduce((s, p) => s + p.needed_period, 0),
        delivered_period: products.reduce((s, p) => s + p.delivered_period, 0),
        produced_period: products.reduce((s, p) => s + p.produced_period, 0),
        issued_period: products.reduce((s, p) => s + p.issued_period, 0),
        returned_period: products.reduce((s, p) => s + p.returned_period, 0),
        shortfall: products.reduce((s, p) => s + p.shortfall, 0),
        needed_orders: neededOrders,
        delivered_orders: deliveredPeriodOrders,
        bottles_returned_period: bottlesReturnedPeriod,
        bottles_owed_total: bottlesOwedTotal,
      }

      return { products, totals, shortfall_items: shortfallItems, period, custom_date: customDate, time_from: timeFrom, time_to: timeTo }
    }
  )

// Subscriptions filtered by period
export const getSubscriptionsByPeriod = (period = 'today', customDate = null) =>
  safeCall(
    () => http.get('/warehouse/subscriptions', { params: { period, date: customDate } }).then(r => r.data),
    () => {
      const today = new Date()
      const targets = []
      if (period === 'today') targets.push(today)
      else if (period === 'tomorrow') targets.push(shiftDate(today, 1))
      else if (period === 'yesterday') targets.push(shiftDate(today, -1))
      else if (period === 'week') { for (let i = 0; i < 7; i++) targets.push(shiftDate(today, i)) }
      else if (period === 'custom' && customDate) targets.push(new Date(customDate))
      else for (let i = 0; i < 30; i++) targets.push(shiftDate(today, i))

      const targetDayNames = targets.map(d => DAYS_RU[d.getDay()])

      const result = []
      const demand = {}
      Object.entries(MOCK_CLIENT_DETAILS).forEach(([userId, details]) => {
        ;(details.subscriptions || []).filter(s => s.status === 'active').forEach(s => {
          if (!targetDayNames.includes(s.day)) return
          const match = s.plan?.match(/^(.+?)\s*×\s*(\d+)$/)
          const productName = match ? match[1].trim() : s.plan
          const qty = match ? Number(match[2]) : 1
          // For 'week' or 'all', multiply by number of occurrences
          const occurrences = targetDayNames.filter(d => d === s.day).length
          result.push({
            ...s,
            user_id: Number(userId),
            product_name: productName,
            qty,
            occurrences,
            total_qty: qty * occurrences,
          })
          demand[productName] = (demand[productName] || 0) + qty * occurrences
        })
      })

      return { subscriptions: result, demand }
    }
  )

// Per-courier warehouse-relevant stats
// Includes assigned active orders with items, 20L bottle return tracking, per-product delivered/on-hand/to-pickup
export const getWarehouseCourierStats = () =>
  safeCall(
    () => http.get('/warehouse/couriers').then(r => r.data),
    () => {
      const today = new Date()
      const couriers = MOCK_COURIERS.filter(c => c.is_active)
      // History/inventory filtered to warehouse-relevant products only
      const history = MOCK_WAREHOUSE.history.filter(h => isWarehouseProduct(h.product_name))

      return couriers.map(c => {
        // On-hand inventory (normalize to short names, drop excluded products)
        const rawWater = MOCK_WAREHOUSE.courier_water[c.id] || {}
        const water = {}
        Object.entries(rawWater).forEach(([name, qty]) => {
          if (!isWarehouseProduct(name)) return
          const short = shortProductName(name)
          water[short] = (water[short] || 0) + qty
        })
        const onHand = Object.values(water).reduce((s, v) => s + v, 0)

        const courierHist = history.filter(h => h.courier_id === c.id)
        const issuedToday = courierHist
          .filter(h => (h.type === 'issued' || h.type === 'issue') && isSameDay(h.date, today))
          .reduce((s, h) => s + h.quantity, 0)
        const returnedToday = courierHist
          .filter(h => (h.type === 'returned' || h.type === 'return') && isSameDay(h.date, today))
          .reduce((s, h) => s + h.quantity, 0)

        const courierOrders = mockOrdersStore.filter(o =>
          o.courier_id === c.id || o.courier_id === Number(c.id) || o.courier_id === c.telegram_id
        )
        // Active orders: assigned but not yet delivered — these need water issued.
        // Drop items that are blacklisted for warehouse (e.g. sparkling 5L).
        const activeOrders = courierOrders
          .filter(o => ACTIVE_STATUSES.includes(o.status) && o.status !== 'awaiting_confirmation')
          .map(o => ({
            id: o.id,
            status: o.status,
            address: o.address,
            client_name: o.client_name,
            delivery_date: o.delivery_date,
            delivery_period: o.delivery_period,
            total: o.total,
            water_issued: !!o.water_issued,
            return_bottles_count: o.return_bottles_count || 0,
            items: (o.items || [])
              .filter(it => isWarehouseProduct(it.product_name))
              .map(it => ({
                ...it,
                short_name: shortProductName(it.product_name),
                key: normalizeProductKey(it.product_name),
              })),
          }))

        const deliveredToday = courierOrders.filter(o => o.status === 'delivered' && isSameDay(o.created_at || new Date(), today))

        // To pickup from warehouse: items in active orders (aggregated)
        const toPickup = {}
        activeOrders.forEach(o => o.items.forEach(it => {
          toPickup[it.short_name] = (toPickup[it.short_name] || 0) + it.quantity
        }))

        // Delivered today — per product (skip excluded)
        const deliveredProducts = {}
        deliveredToday.forEach(o => (o.items || []).forEach(it => {
          if (!isWarehouseProduct(it.product_name)) return
          const short = shortProductName(it.product_name)
          deliveredProducts[short] = (deliveredProducts[short] || 0) + it.quantity
        }))

        // 20L bottle tracking:
        //   must return = sum of return_bottles_count across all courier's active + delivered-today orders
        //   already returned = sum of return_bottles_count in delivered orders (where cash_collected or actual delivery)
        const bottlesMustReturn = [...activeOrders, ...deliveredToday].reduce((s, o) => s + (o.return_bottles_count || 0), 0)
        const bottlesReturnedToday = deliveredToday.reduce((s, o) => s + (o.return_bottles_count || 0), 0)

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          telegram_id: c.telegram_id,
          water,                          // { short_name: qty }
          on_hand: onHand,
          issued_today: issuedToday,
          returned_today: returnedToday,
          active_orders: activeOrders,    // array of orders with items
          active_orders_count: activeOrders.length,
          to_pickup: toPickup,            // { short_name: qty } across active orders
          delivered_today: deliveredToday.length,
          delivered_products: deliveredProducts,
          bottles_must_return: bottlesMustReturn,
          bottles_returned_today: bottlesReturnedToday,
        }
      })
    }
  )

// Filtered warehouse history — uses same period/time range semantics as overview
export const getWarehouseHistory = (filters = {}) =>
  safeCall(
    () => http.get('/warehouse/history', { params: filters }).then(r => r.data),
    () => {
      const { period = 'all', type, product, courier_id, customDate, timeFrom, timeTo } = filters
      let list = MOCK_WAREHOUSE.history
        .filter(h => isWarehouseProduct(h.product_name))
        .map(h => ({
          ...h,
          product_short: shortProductName(h.product_name),
          product_key: normalizeProductKey(h.product_name),
        }))

      if (type && type !== 'all') {
        list = list.filter(h => {
          if (type === 'production') return h.type === 'production'
          if (type === 'issue') return h.type === 'issued' || h.type === 'issue'
          if (type === 'return') return h.type === 'returned' || h.type === 'return'
          return true
        })
      }
      if (product && product !== 'all') {
        const wantKey = normalizeProductKey(product)
        list = list.filter(h => h.product_key === wantKey)
      }
      if (courier_id) list = list.filter(h => h.courier_id === courier_id)

      const range = buildPeriodRange(period, customDate, timeFrom, timeTo)
      list = list.filter(h => inRange(h.date, range))

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

      // Recommendation: what to produce more of (skip warehouse-excluded products)
      const recommendations = []
      MOCK_WAREHOUSE.stock
        .filter(s => isWarehouseProduct(s.product_name))
        .forEach(s => {
          const needed = (upcoming[s.product_name] || 0) + (planByProduct[s.product_name] || 0)
          if (needed > s.quantity) {
            recommendations.push({
              product_name: shortProductName(s.product_name),
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

// ─── Warehouse stock adjustment ────────────────────────────────────────────────
export const adjustStock = (productName, delta, type, note) =>
  safeCall(
    () => http.post('/warehouse/stock/adjust', { product_name: productName, delta, type, note }).then(r => r.data),
    () => {
      const item = MOCK_WAREHOUSE.stock.find(s => shortProductName(s.product_name) === productName || s.product_name === productName)
      if (item) item.quantity = Math.max(0, item.quantity + delta)
      MOCK_WAREHOUSE.history.unshift({
        id: Date.now(), type: 'adjustment', product_name: productName, product_short: productName,
        quantity: Math.abs(delta), note: note || '',
        date: new Date().toISOString(), courier_name: null,
      })
      return { ok: true }
    }
  )
