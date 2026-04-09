// ─── Mock data for dev mode (when backend is not running) ────────────────────

const EVER_PHOTOS = [
  'https://branding.uz/wp-content/uploads/2022/11/ever-0.png',
  'https://branding.uz/wp-content/uploads/2022/11/ever-1.png',
  'https://branding.uz/wp-content/uploads/2022/11/ever-2.png',
  'https://branding.uz/wp-content/uploads/2022/11/ever-3.png',
  'https://branding.uz/wp-content/uploads/2022/11/ever-4.png',
  'https://branding.uz/wp-content/uploads/2022/11/ever-5.png',
  'https://branding.uz/wp-content/uploads/2022/11/ph_juravlev-29.png',
]

export const MOCK_PRODUCTS = [
  {
    id: 1, name: 'Вода 0.5 литровая', volume: 0.5, price: 2000,
    description: '',
    photo_url: EVER_PHOTOS[0],
    is_active: true, sort_order: 1, type: 'still',
  },
  {
    id: 2, name: 'Вода 1 литровая', volume: 1, price: 3500,
    description: '',
    photo_url: EVER_PHOTOS[1],
    is_active: true, sort_order: 2, type: 'still',
  },
  {
    id: 3, name: 'Вода 1.5 литровая', volume: 1.5, price: 4500,
    description: '',
    photo_url: EVER_PHOTOS[2],
    is_active: true, sort_order: 3, type: 'still',
  },
  {
    id: 4, name: 'Вода 5 литровая', volume: 5, price: 8000,
    description: '',
    photo_url: EVER_PHOTOS[3],
    is_active: true, sort_order: 4, type: 'still',
  },
  {
    id: 5, name: 'Вода 10 литровая', volume: 10, price: 14000,
    description: '',
    photo_url: EVER_PHOTOS[4],
    is_active: true, sort_order: 5, type: 'still',
  },
  {
    id: 6, name: 'Вода 20 литровая', volume: 20, price: 25000,
    description: '',
    photo_url: EVER_PHOTOS[5],
    is_active: true, sort_order: 6, type: 'still',
  },
  {
    id: 7, name: 'Вода 0.5 литровая газированная', volume: 0.5, price: 3000,
    description: '',
    photo_url: EVER_PHOTOS[6],
    is_active: true, sort_order: 7, type: 'carbonated',
  },
  {
    id: 8, name: 'Вода 1 литровая газированная', volume: 1, price: 5000,
    description: '',
    photo_url: EVER_PHOTOS[0],
    is_active: true, sort_order: 8, type: 'carbonated',
  },
  {
    id: 9, name: 'Вода 1.5 литровая газированная', volume: 1.5, price: 6000,
    description: '',
    photo_url: EVER_PHOTOS[1],
    is_active: true, sort_order: 9, type: 'carbonated',
  },
  {
    id: 10, name: 'Вода 5 литровая газированная', volume: 5, price: 10000,
    description: '',
    photo_url: EVER_PHOTOS[2],
    is_active: true, sort_order: 10, type: 'carbonated',
  },
]

export const MOCK_ORDERS = [
  {
    id: 1001, status: 'delivered', address: 'Юнусабад, 19-квартал, д. 12',
    delivery_date: 'Сегодня', delivery_period: 'До обеда (9:00–13:00)',
    total: 50000, recipient_phone: '+998 90 123-45-67',
    client_name: 'Алишер Каримов', client_telegram_id: '987654321',
    payment_method: 'balance', payment_confirmed: true,
    courier_id: 1, courier_name: 'Жавлон К.', courier_phone: '+998 91 222-33-44',
    items: [{ id: 1, product_name: 'Вода 20л', quantity: 2, price: 25000 }],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0, bottles_owed: 2,
    latitude: 41.3547, longitude: 69.2848,
    created_at: '2026-04-06T09:00:00',
  },
  {
    id: 1002, status: 'in_delivery', address: 'Мирзо-Улугбек, ул. Навои, 42',
    delivery_date: 'Сегодня', delivery_period: 'До обеда (9:00–13:00)',
    total: 39000, recipient_phone: '+998 93 456-78-90',
    client_name: 'Мария Петрова', client_telegram_id: '123456789',
    payment_method: 'card', payment_confirmed: true,
    payment_details: { card_last4: '9012', paid_at: '2026-04-06T10:15:00', amount: 39000 },
    courier_id: 2, courier_name: 'Санжар М.', courier_phone: '+998 94 555-66-77',
    latitude: 41.299496, longitude: 69.240073,
    items: [
      { id: 2, product_name: 'Вода 20л', quantity: 1, price: 25000 },
      { id: 3, product_name: 'Вода 5л', quantity: 1, price: 8000 },
    ],
    bottle_discount: 4000, bonus_used: 0, return_bottles_count: 2, bottles_owed: 3,
    extra_info: 'Кв. 47, 3 этаж, домофон 47#',
    created_at: '2026-04-06T08:30:00',
  },
  {
    id: 1003, status: 'awaiting_confirmation', address: 'Чиланзар, 7-квартал, д. 5',
    delivery_date: 'Завтра', delivery_period: 'До обеда (9:00–13:00)',
    total: 75000, recipient_phone: '+998 97 111-22-33',
    client_name: 'Бобур Рашидов', client_telegram_id: '555111222',
    payment_method: 'card', payment_confirmed: false,
    payment_details: { card_last4: '9012', paid_at: '2026-04-06T11:02:00', amount: 75000 },
    items: [{ id: 4, product_name: 'Вода 20л', quantity: 3, price: 25000 }],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 3, bottles_owed: 5,
    extra_info: 'Офис на 2-м этаже, спросить Бобура',
    latitude: 41.2817, longitude: 69.2131,
    created_at: '2026-04-06T11:00:00',
  },
  {
    id: 1004, status: 'assigned_to_courier', address: 'Яшнабад, 4-квартал, д. 18',
    delivery_date: 'Сегодня', delivery_period: 'После обеда (13:00–18:00)',
    total: 33000, recipient_phone: '+998 91 777-88-99',
    client_name: 'Санжар Тоиров', client_telegram_id: '444888333',
    payment_method: 'balance', payment_confirmed: true,
    courier_id: 1, courier_name: 'Жавлон К.', courier_phone: '+998 91 222-33-44',
    latitude: 41.312345, longitude: 69.278901,
    items: [
      { id: 1, product_name: 'Вода 20л', quantity: 1, price: 25000 },
      { id: 2, product_name: 'Вода газированная 5л', quantity: 1, price: 8000 },
    ],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 1, bottles_owed: 1,
    created_at: '2026-04-06T07:45:00',
  },
  {
    id: 1005, status: 'confirmed', address: 'Сергели, ул. Янги Сергели, 15',
    delivery_date: 'Сегодня', delivery_period: 'После обеда (13:00–18:00)',
    total: 25000, recipient_phone: '+998 95 333-44-55',
    client_name: 'Дилшод Умаров', client_telegram_id: '666777888',
    payment_method: 'balance', payment_confirmed: true,
    items: [{ id: 5, product_name: 'Вода 20л', quantity: 1, price: 25000 }],
    bottle_discount: 0, bonus_used: 500, return_bottles_count: 0, bottles_owed: 0,
    latitude: 41.2253, longitude: 69.2284,
    created_at: '2026-04-06T10:20:00',
  },
  // Topup awaiting confirmation
  {
    id: 2001, type: 'topup', status: 'awaiting_confirmation',
    client_name: 'Мария Петрова', client_telegram_id: '123456789',
    recipient_phone: '+998 93 456-78-90',
    total: 50000,
    payment_method: 'card', payment_confirmed: false,
    payment_details: { card_last4: '9012', paid_at: '2026-04-06T10:45:00', amount: 50000 },
    created_at: '2026-04-06T10:45:00',
  },
  // Subscription delivery for today
  {
    id: 3001, type: 'subscription', status: 'confirmed',
    address: 'Юнусабад, 19-квартал, д. 12',
    delivery_date: 'Сегодня', delivery_period: 'До обеда (9:00–13:00)',
    total: 50000, recipient_phone: '+998 90 123-45-67',
    client_name: 'Алишер Каримов', client_telegram_id: '987654321',
    payment_method: 'balance', payment_confirmed: true,
    items: [{ id: 1, product_name: 'Вода 20л', quantity: 2, price: 25000 }],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0, bottles_owed: 2,
    latitude: 41.3547, longitude: 69.2848,
    created_at: '2026-04-06T06:00:00',
  },
  // Cash order — skips payment, goes to assign courier
  {
    id: 1006, status: 'confirmed', address: 'Алмазар, ул. Фурката, д. 7',
    delivery_date: 'Сегодня', delivery_period: 'После обеда (13:00–18:00)',
    total: 42000, recipient_phone: '+998 91 444-55-66',
    client_name: 'Фарход Азимов', client_telegram_id: '777888999',
    payment_method: 'cash', payment_confirmed: true,
    items: [
      { id: 1, product_name: 'Вода 20л', quantity: 1, price: 25000 },
      { id: 2, product_name: 'Вода 10л', quantity: 1, price: 14000 },
      { id: 3, product_name: 'Вода 1.5л газ.', quantity: 1, price: 3000 },
    ],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0, bottles_owed: 0,
    latitude: 41.3180, longitude: 69.2390,
    created_at: '2026-04-08T08:15:00',
  },
  // Cash order delivered — courier has cash debt
  {
    id: 1007, status: 'delivered', address: 'Чиланзар, 14-квартал, д. 3',
    delivery_date: 'Сегодня', delivery_period: 'До обеда (9:00–13:00)',
    total: 25000, recipient_phone: '+998 93 555-66-77',
    client_name: 'Нодир Хасанов', client_telegram_id: '333444555',
    payment_method: 'cash', payment_confirmed: true, cash_collected: true,
    courier_id: 1, courier_name: 'Жавлон К.', courier_phone: '+998 91 222-33-44',
    items: [{ id: 1, product_name: 'Вода 20л', quantity: 1, price: 25000 }],
    bottle_discount: 0, bonus_used: 0, return_bottles_count: 0, bottles_owed: 1,
    latitude: 41.2850, longitude: 69.2050,
    created_at: '2026-04-08T07:00:00',
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
  bottle_return_buttons_visible: true,
  bottle_return_mode: 'max',
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

// ─── Extended client data for manager views ──────────────────────────────────
export const MOCK_CLIENT_DETAILS = {
  1: {
    bottles_owed: 3,
    bottles_history: [
      { date: '2026-03-28', action: 'received', count: 2, order_id: 1001 },
      { date: '2026-03-25', action: 'returned', count: 1, order_id: null },
      { date: '2026-03-20', action: 'received', count: 3, order_id: 998 },
      { date: '2026-03-18', action: 'returned', count: 1, order_id: null },
    ],
    transactions: [
      { id: 1, type: 'payment', amount: -50000, date: '2026-03-28T14:30:00', order_id: 1001, desc: 'Оплата заказа #1001' },
      { id: 2, type: 'topup', amount: 100000, date: '2026-03-25T10:00:00', desc: 'Пополнение баланса' },
      { id: 3, type: 'cashback', amount: 2500, date: '2026-03-23T16:00:00', order_id: 998, desc: 'Кэшбэк 5% за заказ #998' },
      { id: 4, type: 'payment', amount: -75000, date: '2026-03-20T12:15:00', order_id: 998, desc: 'Оплата заказа #998' },
      { id: 5, type: 'bonus_used', amount: -500, date: '2026-03-18T09:00:00', order_id: 995, desc: 'Списание бонусов' },
    ],
    subscriptions: [
      { id: 1, status: 'active', plan: 'Вода 20л × 2', period: '2 недели', day: 'Понедельник', time: '09:00–12:00', start: '2026-03-01', end: '2026-04-01', price: 50000, address: 'Юнусабад, 19-квартал, д. 12' },
    ],
    addresses: [
      { id: 1, address: 'Юнусабад, 19-квартал, д. 12', lat: 41.3547, lng: 69.2848, label: 'Дом' },
      { id: 2, address: 'Мирзо-Улугбек, ул. Навои, 42, оф. 301', lat: 41.2995, lng: 69.2401, label: 'Офис' },
    ],
  },
  2: {
    bottles_owed: 1,
    bottles_history: [
      { date: '2026-03-26', action: 'received', count: 1, order_id: 1002 },
    ],
    transactions: [
      { id: 1, type: 'payment', amount: -39000, date: '2026-03-26T11:00:00', order_id: 1002, desc: 'Оплата заказа #1002' },
      { id: 2, type: 'topup', amount: 50000, date: '2026-03-20T14:00:00', desc: 'Пополнение баланса' },
    ],
    subscriptions: [],
    addresses: [
      { id: 1, address: 'Мирзо-Улугбек, ул. Навои, 42', lat: 41.2995, lng: 69.2401, label: 'Дом' },
    ],
  },
  3: {
    bottles_owed: 0,
    bottles_history: [],
    transactions: [],
    subscriptions: [],
    addresses: [],
  },
}

export const MOCK_COURIER_DETAILS = {
  1: {
    total_deliveries: 142, today_deliveries: 5, earnings_total: 2840000, earnings_today: 100000,
    rating: 4.9, avg_delivery_time: 28,
    recent_deliveries: [
      { order_id: 1001, address: 'Юнусабад, 19-квартал, д. 12', time: '2026-03-28T14:00:00', status: 'delivered' },
      { order_id: 999, address: 'Чиланзар, 7-квартал, д. 5', time: '2026-03-28T11:30:00', status: 'delivered' },
      { order_id: 997, address: 'Яшнабад, 4-квартал, д. 18', time: '2026-03-27T15:00:00', status: 'delivered' },
    ],
    zones: ['Юнусабад', 'Мирабад', 'Шайхонтохур'],
  },
  2: {
    total_deliveries: 98, today_deliveries: 3, earnings_total: 1960000, earnings_today: 60000,
    rating: 4.7, avg_delivery_time: 35,
    recent_deliveries: [
      { order_id: 1002, address: 'Мирзо-Улугбек, ул. Навои, 42', time: '2026-03-28T12:00:00', status: 'in_delivery' },
    ],
    zones: ['Мирзо-Улугбек', 'Яшнабад'],
  },
  3: {
    total_deliveries: 35, today_deliveries: 0, earnings_total: 700000, earnings_today: 0,
    rating: 4.2, avg_delivery_time: 42,
    recent_deliveries: [],
    zones: ['Чиланзар'],
  },
}

// ─── Cash debt tracking ─────────────────────────────────────────────────────
// clearance_status: 'none' | 'pending' | 'approved' | 'rejected'
export const MOCK_CASH_DEBTS = [
  { id: 1, courier_id: 1, order_id: 1006, amount: 50000, clearance_status: 'none', client_name: 'Алишер Каримов', created_at: '2026-04-07T14:00:00' },
  { id: 2, courier_id: 1, order_id: 1007, amount: 25000, clearance_status: 'pending', client_name: 'Нодир Хасанов', created_at: '2026-04-08T11:00:00' },
]

// ─── Cooler management ──────────────────────────────────────────────────────
export const MOCK_COOLERS = {
  1: [
    { id: 1, model: 'AQUA-100', serial_number: 'AQ-2024-001', installed_date: '2026-03-01',
      plan: { type: 'weekly', days: ['Пн', 'Чт'], qty_per_delivery: 2, total_monthly: 16 } },
  ],
}

// ─── Warehouse inventory ────────────────────────────────────────────────────
export const MOCK_WAREHOUSE = {
  stock: [
    { product_id: 6, product_name: 'Вода 20л', quantity: 120 },
    { product_id: 5, product_name: 'Вода 10л', quantity: 85 },
    { product_id: 4, product_name: 'Вода 5л', quantity: 200 },
    { product_id: 3, product_name: 'Вода 1.5л', quantity: 480 },
    { product_id: 2, product_name: 'Вода 1л', quantity: 360 },
    { product_id: 1, product_name: 'Вода 0.5л', quantity: 600 },
  ],
  history: [
    { id: 1, type: 'production', product_name: 'Вода 20л', quantity: 50, date: '2026-04-08T06:00:00', note: 'Утренняя партия' },
    { id: 2, type: 'issued', product_name: 'Вода 20л', quantity: 15, date: '2026-04-08T08:00:00', courier_name: 'Жавлон К.', courier_id: 1 },
    { id: 3, type: 'issued', product_name: 'Вода 10л', quantity: 10, date: '2026-04-08T08:00:00', courier_name: 'Санжар Д.', courier_id: 2 },
    { id: 4, type: 'production', product_name: 'Вода 10л', quantity: 30, date: '2026-04-07T06:00:00', note: 'Дневная партия' },
    { id: 5, type: 'returned', product_name: 'Вода 20л', quantity: 3, date: '2026-04-07T18:00:00', courier_name: 'Жавлон К.', courier_id: 1 },
  ],
  courier_water: {
    1: { 'Вода 20л': 5, 'Вода 10л': 3 },
    2: { 'Вода 10л': 3, 'Вода 5л': 4 },
  },
}

// Demo users for login (phone → role)
export const DEMO_USERS = {
  '+998 90 000-00-01': { id: 1, name: 'Алишер Каримов',  phone: '+998 90 000-00-01', role: 'client',  bonus_points: 3500, balance: 50000, order_count: 7 },
  '+998 90 000-00-02': { id: 2, name: 'Администратор',   phone: '+998 90 000-00-02', role: 'admin',   bonus_points: 0,    balance: 0 },
  '+998 90 000-00-03': { id: 3, name: 'Менеджер',        phone: '+998 90 000-00-03', role: 'manager', bonus_points: 0,    balance: 0 },
  '+998 90 000-00-04': { id: 4, name: 'Жавлон Курьер',   phone: '+998 90 000-00-04', role: 'courier', bonus_points: 0,    balance: 0 },
  '+998 90 000-00-05': { id: 5, name: 'Завсклад',        phone: '+998 90 000-00-05', role: 'warehouse', bonus_points: 0,  balance: 0 },
}
