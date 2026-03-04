import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const http = axios.create({ baseURL: BASE })

export const getProducts = () => http.get('/products/').then(r => r.data)

export const createOrder = (data) => http.post('/orders/', data).then(r => r.data)

export const getUserByTelegram = (tgId) =>
  http.get(`/users/by_telegram/${tgId}`).then(r => r.data)

export const getUserOrders = (userId) =>
  http.get(`/orders/user/${userId}`).then(r => r.data)

export const getOrder = (orderId) =>
  http.get(`/orders/${orderId}`).then(r => r.data)

export const paymentConfirmed = (orderId) =>
  http.patch(`/orders/${orderId}/payment_confirmed`).then(r => r.data)
