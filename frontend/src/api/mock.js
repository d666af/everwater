// ─── Mock data for dev mode (when backend is not running) ────────────────────

export const MOCK_PRODUCTS = [
  {
    id: 1, name: 'Вода питьевая 5л', volume: 5, price: 8000,
    description: 'Природная горная вода, идеально чистая',
    photo_url: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&q=80',
    is_active: true, sort_order: 1,
  },
  {
    id: 2, name: 'Вода питьевая 10л', volume: 10, price: 14000,
    description: 'Природная горная вода, большой объём',
    photo_url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80',
    is_active: true, sort_order: 2,
  },
  {
    id: 3, name: 'Вода питьевая 18.9л', volume: 18.9, price: 25000,
    description: 'Стандартный кулерный бутыль, самый выгодный',
    photo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=80',
    is_active: true, sort_order: 3,
  },
  {
    id: 4, name: 'Вода газированная 5л', volume: 5, price: 10000,
    description: 'Газированная природная вода',
    photo_url: 'https://images.unsplash.com/photo-1606168094336-48f205e4e291?w=400&q=80',
    is_active: true, sort_order: 4,
  },
]

export const MOCK_ORDERS = [
  {
    id: 1001, status: 'delivered', address: 'Юнусабад, 19-квартал, д. 12',
    delivery_time: 'Сегодня 12:00–15:00', total: 50000, recipient_phone: '+998 90 123-45-67',
    courier_name: 'Жавлон К.', courier_phone: '+998 91 222-33-44',
    items: [{ id: 1, product_name: 'Вода 18.9л', quantity: 2, price: 25000 }],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0,
  },
  {
    id: 1002, status: 'in_delivery', address: 'Мирзо-Улугбек, ул. Навои, 42',
    delivery_time: 'Сегодня 15:00–18:00', total: 39000, recipient_phone: '+998 93 456-78-90',
    courier_name: 'Санжар М.', courier_phone: '+998 94 555-66-77',
    latitude: 41.299496, longitude: 69.240073,
    items: [
      { id: 2, product_name: 'Вода 18.9л', quantity: 1, price: 25000 },
      { id: 3, product_name: 'Вода 5л', quantity: 1, price: 8000 },
    ],
    bottle_discount: 4000, bonus_used: 0, return_bottles_count: 2,
  },
  {
    id: 1003, status: 'awaiting_confirmation', address: 'Чиланзар, 7-квартал, д. 5',
    delivery_time: 'Завтра 9:00–12:00', total: 75000, recipient_phone: '+998 97 111-22-33',
    items: [{ id: 4, product_name: 'Вода 18.9л', quantity: 3, price: 25000 }],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0,
  },
]

export const MOCK_STATS = {
  day:   { order_count: 12,  revenue: 840000,   avg_check: 70000, repeat_customers: 4,  bottles_returned: 8,   cancelled: 1,  by_status: { new: 2, awaiting_confirmation: 3, confirmed: 1, in_delivery: 2, delivered: 4,   rejected: 1  } },
  week:  { order_count: 78,  revenue: 5460000,  avg_check: 70000, repeat_customers: 22, bottles_returned: 45,  cancelled: 5,  by_status: { new: 5, awaiting_confirmation: 8, confirmed: 3, in_delivery: 6, delivered: 51,  rejected: 5  } },
  month: { order_count: 312, revenue: 21840000, avg_check: 70000, repeat_customers: 87, bottles_returned: 180, cancelled: 18, by_status: { new: 8, awaiting_confirmation: 12, confirmed: 5, in_delivery: 10, delivered: 259, rejected: 18 } },
}

export const MOCK_COURIERS = [
  { id: 1, name: 'Жавлон Курьеров',  phone: '+998 90 111-11-11', telegram_id: '111111', is_active: true,  delivery_count: 142, earnings: 2840000 },
  { id: 2, name: 'Санжар Доставкин', phone: '+998 93 222-22-22', telegram_id: '222222', is_active: true,  delivery_count: 98,  earnings: 1960000 },
  { id: 3, name: 'Бобур Быстров',    phone: '+998 97 333-33-33', telegram_id: '333333', is_active: false, delivery_count: 35,  earnings: 700000  },
]

export const MOCK_SETTINGS = {
  payment_card: '8600 1234 5678 9012',
  payment_holder: 'ИП Исмоилов Алишер',
  bottle_discount_type: 'fixed',
  bottle_discount_value: 2000,
  cashback_percent: 5,
}

export const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'payment', title: 'Оплата заказа #1003', body: 'Клиент Алишер подтвердил оплату заказа на 75 000 сум', time: new Date(Date.now() - 3 * 60000), read: false, order_id: 1003, user_name: 'Алишер Каримов' },
  { id: 2, type: 'topup', title: 'Запрос пополнения баланса', body: 'Мария Петрова запросила пополнение на 50 000 сум', time: new Date(Date.now() - 12 * 60000), read: false, amount: 50000, user_name: 'Мария Петрова', user_id: 2 },
  { id: 3, type: 'payment', title: 'Оплата заказа #1005', body: 'Клиент Бобур подтвердил оплату заказа на 39 000 сум', time: new Date(Date.now() - 25 * 60000), read: false, order_id: 1005, user_name: 'Бобур Рашидов' },
  { id: 4, type: 'courier', title: 'Заказ #1002 доставлен', body: 'Курьер Жавлон завершил доставку заказа #1002', time: new Date(Date.now() - 40 * 60000), read: true, order_id: 1002 },
  { id: 5, type: 'new_order', title: 'Новый заказ #1006', body: 'Поступил новый заказ на 25 000 сум', time: new Date(Date.now() - 65 * 60000), read: true, order_id: 1006, user_name: 'Санжар Тоиров' },
  { id: 6, type: 'topup', title: 'Запрос пополнения баланса', body: 'Алишер Каримов запросил пополнение на 100 000 сум', time: new Date(Date.now() - 2 * 3600000), read: true, amount: 100000, user_name: 'Алишер Каримов', user_id: 1 },
]

export const MOCK_SUPPORT_CHATS = [
  {
    id: 1, user_id: 1, user_name: 'Алишер Каримов', user_phone: '+998 90 000-00-01',
    last_message: 'Где мой заказ #1003?', last_time: new Date(Date.now() - 5 * 60000), unread: 2,
    messages: [
      { id: 1, from: 'user', text: 'Привет! Где мой заказ #1003?', time: new Date(Date.now() - 8 * 60000) },
      { id: 2, from: 'user', text: 'Уже прошло 2 часа', time: new Date(Date.now() - 5 * 60000) },
    ],
  },
  {
    id: 2, user_id: 2, user_name: 'Мария Петрова', user_phone: '+998 90 000-00-05',
    last_message: 'Хочу отменить заказ', last_time: new Date(Date.now() - 18 * 60000), unread: 1,
    messages: [
      { id: 1, from: 'user', text: 'Добрый день! Хочу отменить заказ #1005', time: new Date(Date.now() - 20 * 60000) },
      { id: 2, from: 'support', text: 'Добрый день, Мария! Уточните пожалуйста причину отмены?', time: new Date(Date.now() - 18 * 60000) },
    ],
  },
  {
    id: 3, user_id: 3, user_name: 'Бобур Рашидов', user_phone: '+998 90 000-00-06',
    last_message: 'Спасибо, всё отлично!', last_time: new Date(Date.now() - 2 * 3600000), unread: 0,
    messages: [
      { id: 1, from: 'user', text: 'Курьер привёз не ту воду', time: new Date(Date.now() - 3 * 3600000) },
      { id: 2, from: 'support', text: 'Приносим извинения! Мы направим курьера с заменой в течение часа', time: new Date(Date.now() - 2.5 * 3600000) },
      { id: 3, from: 'user', text: 'Спасибо, всё отлично!', time: new Date(Date.now() - 2 * 3600000) },
    ],
  },
]

// Demo users for login (phone → role)
export const DEMO_USERS = {
  '+998 90 000-00-01': { id: 1, name: 'Алишер Каримов',  phone: '+998 90 000-00-01', role: 'client',  bonus_points: 3500, balance: 50000, order_count: 7 },
  '+998 90 000-00-02': { id: 2, name: 'Администратор',   phone: '+998 90 000-00-02', role: 'admin',   bonus_points: 0,    balance: 0 },
  '+998 90 000-00-03': { id: 3, name: 'Менеджер',        phone: '+998 90 000-00-03', role: 'manager', bonus_points: 0,    balance: 0 },
  '+998 90 000-00-04': { id: 4, name: 'Жавлон Курьер',   phone: '+998 90 000-00-04', role: 'courier', bonus_points: 0,    balance: 0 },
}
