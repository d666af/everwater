// ─── Mock data for dev mode (when backend is not running) ────────────────────

export const MOCK_PRODUCTS = [
  { id: 1, name: 'Вода питьевая 5л', volume: 5, price: 150, description: 'Природная горная вода', photo_url: '', is_active: true, sort_order: 1 },
  { id: 2, name: 'Вода питьевая 10л', volume: 10, price: 250, description: 'Природная горная вода', photo_url: '', is_active: true, sort_order: 2 },
  { id: 3, name: 'Вода питьевая 18.9л', volume: 18.9, price: 350, description: 'Стандартный кулерный бутыль', photo_url: '', is_active: true, sort_order: 3 },
  { id: 4, name: 'Вода газированная 5л', volume: 5, price: 180, description: 'Газированная природная вода', photo_url: '', is_active: true, sort_order: 4 },
]

export const MOCK_ORDERS = [
  {
    id: 1001, status: 'delivered', address: 'ул. Примерная, 1, кв. 5',
    delivery_time: 'Сегодня 12:00–15:00', total: 700, recipient_phone: '+7 999 000-00-01',
    courier_name: 'Иван К.', courier_phone: '+7 999 111-22-33',
    items: [
      { id: 1, product_name: 'Вода 18.9л', quantity: 2, price: 350 },
    ],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0,
  },
  {
    id: 1002, status: 'in_delivery', address: 'пр. Ленина, 42, кв. 17',
    delivery_time: 'Сегодня 15:00–18:00', total: 500, recipient_phone: '+7 999 000-00-02',
    courier_name: 'Петр М.', courier_phone: '+7 999 444-55-66',
    latitude: 55.751244, longitude: 37.618423,
    items: [
      { id: 2, product_name: 'Вода 18.9л', quantity: 1, price: 350 },
      { id: 3, product_name: 'Вода 5л', quantity: 1, price: 150 },
    ],
    bottle_discount: 50, bonus_used: 0, return_bottles_count: 1,
  },
  {
    id: 1003, status: 'awaiting_confirmation', address: 'ул. Садовая, 7',
    delivery_time: 'Завтра 9:00–12:00', total: 1050, recipient_phone: '+7 999 000-00-03',
    items: [
      { id: 4, product_name: 'Вода 18.9л', quantity: 3, price: 350 },
    ],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0,
  },
]

export const MOCK_STATS = {
  day: { order_count: 12, revenue: 8400, avg_check: 700, repeat_customers: 4, bottles_returned: 8, cancelled: 1, by_status: { new: 2, awaiting_confirmation: 3, confirmed: 1, in_delivery: 2, delivered: 4, rejected: 1 } },
  week: { order_count: 78, revenue: 54600, avg_check: 700, repeat_customers: 22, bottles_returned: 45, cancelled: 5, by_status: { new: 5, awaiting_confirmation: 8, confirmed: 3, in_delivery: 6, delivered: 51, rejected: 5 } },
  month: { order_count: 312, revenue: 218400, avg_check: 700, repeat_customers: 87, bottles_returned: 180, cancelled: 18, by_status: { new: 8, awaiting_confirmation: 12, confirmed: 5, in_delivery: 10, delivered: 259, rejected: 18 } },
}

export const MOCK_COURIERS = [
  { id: 1, name: 'Иван Курьеров', phone: '+7 999 111-11-11', telegram_id: '111111', is_active: true, delivery_count: 142, earnings: 28400 },
  { id: 2, name: 'Петр Доставкин', phone: '+7 999 222-22-22', telegram_id: '222222', is_active: true, delivery_count: 98, earnings: 19600 },
  { id: 3, name: 'Сергей Быстров', phone: '+7 999 333-33-33', telegram_id: '333333', is_active: false, delivery_count: 35, earnings: 7000 },
]

export const MOCK_SETTINGS = {
  payment_card: '4276 1234 5678 9012',
  payment_holder: 'ИП Иванов Иван',
  bottle_discount_type: 'fixed',
  bottle_discount_value: 50,
  cashback_percent: 5,
}

// Demo users for login (phone → role)
export const DEMO_USERS = {
  '+7 000 000-00-01': { id: 1, name: 'Иван Иванов', phone: '+7 000 000-00-01', role: 'client', bonus_points: 350, balance: 0 },
  '+7 000 000-00-02': { id: 2, name: 'Администратор', phone: '+7 000 000-00-02', role: 'admin', bonus_points: 0, balance: 0 },
  '+7 000 000-00-03': { id: 3, name: 'Менеджер', phone: '+7 000 000-00-03', role: 'manager', bonus_points: 0, balance: 0 },
  '+7 000 000-00-04': { id: 4, name: 'Курьер Иван', phone: '+7 000 000-00-04', role: 'courier', bonus_points: 0, balance: 0 },
}
