import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const http = axios.create({ baseURL: BASE })

// ─── Products ───────────────────────────────────────────────────────────────
export const getProducts = (includeInactive = false) =>
  http.get('/products/', { params: includeInactive ? { include_inactive: true } : {} }).then(r => r.data)

export const createProduct = (data) => http.post('/products/', data).then(r => r.data)
export const updateProduct = (id, data) => http.patch(`/products/${id}`, data).then(r => r.data)
export const deleteProduct = (id) => http.delete(`/products/${id}`).then(r => r.data)

// ─── Orders ─────────────────────────────────────────────────────────────────
export const createOrder = (data) => http.post('/orders/', data).then(r => r.data)
export const getOrder = (orderId) => http.get(`/orders/${orderId}`).then(r => r.data)
export const getUserOrders = (userId) => http.get(`/orders/user/${userId}`).then(r => r.data)
export const getOrders = (params = {}) => http.get('/orders/', { params }).then(r => r.data)
export const paymentConfirmed = (orderId) => http.patch(`/orders/${orderId}/payment_confirmed`).then(r => r.data)
export const confirmOrder = (orderId) => http.patch(`/orders/${orderId}/confirm`).then(r => r.data)
export const rejectOrder = (orderId, reason) =>
  http.patch(`/orders/${orderId}/reject`, { reason }).then(r => r.data)
export const assignCourier = (orderId, courierId) =>
  http.patch(`/orders/${orderId}/assign_courier`, { courier_id: courierId }).then(r => r.data)
export const markInDelivery = (orderId) => http.patch(`/orders/${orderId}/in_delivery`).then(r => r.data)
export const markDelivered = (orderId) => http.patch(`/orders/${orderId}/delivered`).then(r => r.data)

// ─── Reviews ────────────────────────────────────────────────────────────────
export const createReview = (data) => http.post('/orders/reviews/', data).then(r => r.data)

// ─── Users ──────────────────────────────────────────────────────────────────
export const getUserByTelegram = (tgId) =>
  http.get(`/users/by_telegram/${tgId}`).then(r => r.data)

export const createOrGetUser = (data) => http.post('/users/', data).then(r => r.data)
export const updateUser = (tgId, data) => http.patch(`/users/${tgId}`, data).then(r => r.data)

// ─── Admin ───────────────────────────────────────────────────────────────────
export const getAdminStats = (period = 'day') =>
  http.get('/admin/stats', { params: { period } }).then(r => r.data)

export const getAdminCouriers = () => http.get('/admin/couriers').then(r => r.data)
export const createCourier = (data) => http.post('/admin/couriers', data).then(r => r.data)
export const deleteCourier = (id) => http.delete(`/admin/couriers/${id}`).then(r => r.data)

export const getAdminUsers = () => http.get('/admin/users').then(r => r.data)

// ─── Settings ────────────────────────────────────────────────────────────────
export const getSettings = () => http.get('/admin/settings').then(r => r.data)
export const updateSettings = (data) => http.patch('/admin/settings', data).then(r => r.data)

// ─── Courier ──────────────────────────────────────────────────────────────────
export const getCourierOrders = (telegramId) =>
  http.get(`/couriers/${telegramId}/orders`).then(r => r.data)

export const getCourierStats = (telegramId) =>
  http.get(`/couriers/${telegramId}/stats`).then(r => r.data)

export const courierAccept = (orderId) =>
  http.patch(`/orders/${orderId}/courier_accept`).then(r => r.data)

export const courierInDelivery = (orderId) => markInDelivery(orderId)
export const courierDelivered = (orderId) => markDelivered(orderId)
