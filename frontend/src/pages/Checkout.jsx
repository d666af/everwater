import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { createOrder, getUserByTelegram, paymentConfirmed, getSettings } from '../api'
import MapPicker from '../components/MapPicker'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'
import { useOrdersStore } from '../store/orders'

const tg = window.Telegram?.WebApp

const TIME_SLOTS = [
  { label: 'Сегодня 9–12', value: 'Сегодня 9:00–12:00' },
  { label: 'Сегодня 12–15', value: 'Сегодня 12:00–15:00' },
  { label: 'Сегодня 15–18', value: 'Сегодня 15:00–18:00' },
  { label: 'Сегодня 18–21', value: 'Сегодня 18:00–21:00' },
  { label: 'Завтра 9–12', value: 'Завтра 9:00–12:00' },
  { label: 'Завтра 12–15', value: 'Завтра 12:00–15:00' },
  { label: 'Завтра 15–18', value: 'Завтра 15:00–18:00' },
  { label: 'Завтра 18–21', value: 'Завтра 18:00–21:00' },
]

const PAYMENT_METHODS = [
  { key: 'card', label: 'Перевод на карту', icon: '💳' },
  { key: 'cash', label: 'Наличные курьеру', icon: '💵' },
  { key: 'payme', label: 'Payme', icon: '📱' },
]

export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const navigate = useNavigate()
  const { user: authUser } = useAuthStore()
  const userStore = useUserStore()
  const { addOrder } = useOrdersStore()

  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({
    payment_card: '', payment_holder: '',
    bottle_discount_type: 'fixed', bottle_discount_value: 2000,
  })
  const [form, setForm] = useState({
    phone: '', address: '', extraInfo: '', deliveryTime: '',
    lat: null, lng: null, geoLoading: false,
    returnCount: 0, bonusUsed: 0, balanceUsed: 0,
    paymentMethod: 'card',
  })
  const [showMap, setShowMap] = useState(false)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(u => { setUser(u); setForm(f => ({ ...f, phone: u.phone || '' })) })
        .catch(console.error)
    } else if (authUser) {
      setUser(authUser)
      setForm(f => ({ ...f, phone: authUser.phone || '' }))
      if (!userStore.initialized) userStore.init(authUser)
    }
    getSettings().then(setSettings).catch(console.error)
  }, [authUser]) // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Calculations
  const subtotal = total()
  const bottleDiscount = (() => {
    const c = Number(form.returnCount)
    if (!c) return 0
    if (settings.bottle_discount_type === 'percent')
      return Math.round(subtotal * (settings.bottle_discount_value / 100))
    return c * Number(settings.bottle_discount_value)
  })()
  const afterBottle = subtotal - bottleDiscount
  const availableBonus = userStore.initialized ? userStore.bonus_points : (user?.bonus_points || 0)
  const availableBalance = userStore.initialized ? userStore.balance : (user?.balance || 0)
  const bonusMax = Math.min(availableBonus, afterBottle)
  const balanceMax = Math.min(availableBalance, afterBottle - Number(form.bonusUsed))
  const finalTotal = Math.max(0, afterBottle - Number(form.bonusUsed) - Number(form.balanceUsed))

  const requestLocation = () => {
    if (!navigator.geolocation) { setError('Геолокация недоступна'); return }
    set('geoLoading', true); setError('')
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude, geoLoading: false })),
      () => { set('geoLoading', false); setError('Разрешите доступ к местоположению') },
      { timeout: 10000 }
    )
  }

  const submitOrder = async () => {
    if (!form.address.trim()) return setError('Укажите адрес доставки')
    if (!form.deliveryTime) return setError('Выберите время доставки')
    setLoading(true); setError('')
    try {
      const order = await createOrder({
        user_id: user?.id,
        recipient_phone: form.phone || user?.phone,
        address: form.address,
        extra_info: form.extraInfo || null,
        delivery_time: form.deliveryTime || null,
        latitude: form.lat, longitude: form.lng,
        return_bottles_count: Number(form.returnCount),
        return_bottles_volume: 0,
        bottle_discount: bottleDiscount,
        bonus_used: Number(form.bonusUsed),
        balance_used: Number(form.balanceUsed),
        payment_method: form.paymentMethod,
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity, price: i.product.price })),
      })
      setCreatedOrder(order)

      // For cash/payme — auto-confirm, for card — show card details
      if (form.paymentMethod === 'cash' || form.paymentMethod === 'payme') {
        await paymentConfirmed(order.id)
        finishOrder(order)
      }
    } catch {
      setError('Ошибка создания заказа')
    } finally {
      setLoading(false)
    }
  }

  const confirmCardPayment = async () => {
    setLoading(true); setError('')
    try {
      await paymentConfirmed(createdOrder.id)
      finishOrder(createdOrder)
    } catch {
      setError('Ошибка подтверждения')
    } finally {
      setLoading(false)
    }
  }

  const finishOrder = (order) => {
    const fullOrder = {
      ...order,
      items: items.map(i => ({
        id: i.product.id, product_name: i.product.name,
        quantity: i.quantity, price: i.product.price, volume: i.product.volume,
      })),
      total: finalTotal, address: form.address, delivery_time: form.deliveryTime,
      recipient_phone: form.phone || user?.phone, status: 'awaiting_confirmation',
    }
    addOrder(fullOrder)
    if (Number(form.bonusUsed)) userStore.deductBonus(Number(form.bonusUsed))
    if (Number(form.balanceUsed)) userStore.deductBalance(Number(form.balanceUsed))
    userStore.incrementOrders()
    clearCart()
    setSuccess(true)
  }

  const copyCard = () => {
    navigator.clipboard?.writeText(settings.payment_card || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // ── Success screen ──
  if (success) return (
    <div style={s.successPage}>
      <div style={s.successIcon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 style={s.successTitle}>Заказ принят!</h2>
      <p style={s.successDesc}>Ожидайте подтверждения от менеджера</p>
      <button style={s.primaryBtn} onClick={() => navigate('/orders')}>Мои заказы</button>
      <button style={s.linkBtn} onClick={() => navigate('/')}>Продолжить покупки</button>
    </div>
  )

  // ── Card payment confirmation screen ──
  if (createdOrder && form.paymentMethod === 'card') return (
    <div style={s.page}>
      <div style={s.section}>
        <div style={s.sLabel}>Оплата заказа #{createdOrder.id}</div>
        <div style={s.payCard}>
          <div style={s.payCardLabel}>Переведите на карту</div>
          <div style={s.payCardNum}>{settings.payment_card || '0000 0000 0000 0000'}</div>
          <div style={s.payCardHolder}>{settings.payment_holder || '—'}</div>
          <div style={s.payDivider} />
          <div style={s.payAmtLabel}>Сумма</div>
          <div style={s.payAmt}>{finalTotal.toLocaleString()} <span style={s.payAmtCur}>сум</span></div>
          <button style={{ ...s.copyBtn, ...(copied ? s.copyBtnDone : {}) }} onClick={copyCard}>
            {copied ? 'Скопировано' : 'Скопировать номер карты'}
          </button>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.helpSteps}>
          <div style={s.helpStep}><span style={s.helpNum}>1</span> Переведите сумму на карту</div>
          <div style={s.helpStep}><span style={s.helpNum}>2</span> Нажмите «Я оплатил»</div>
          <div style={s.helpStep}><span style={s.helpNum}>3</span> Менеджер подтвердит заказ</div>
        </div>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}
      <div style={{ padding: '0 16px 32px' }}>
        <button style={s.primaryBtn} onClick={confirmCardPayment} disabled={loading}>
          {loading ? <span style={s.spinner} /> : 'Я оплатил'}
        </button>
      </div>
    </div>
  )

  // ── Main checkout form ──
  return (
    <div style={s.page}>
      {showMap && (
        <MapPicker
          lat={form.lat} lng={form.lng}
          onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Order summary */}
      <div style={s.section}>
        <div style={s.sLabel}>Ваш заказ</div>
        <div style={s.card}>
          {items.map(({ product, quantity }) => (
            <div key={product.id} style={s.orderRow}>
              <span style={s.orderName}>{product.name} <span style={s.orderQty}>×{quantity}</span></span>
              <span style={s.orderPrice}>{(product.price * quantity).toLocaleString()} сум</span>
            </div>
          ))}
          <div style={s.orderTotalRow}>
            <span>Итого</span>
            <span style={s.orderTotal}>{subtotal.toLocaleString()} сум</span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      <div style={s.section}>
        <div style={s.sLabel}>Доставка</div>
        <div style={s.card}>
          <input
            style={s.input}
            placeholder="Адрес: улица, дом, квартира"
            value={form.address}
            onChange={e => set('address', e.target.value)}
          />
          <input
            style={s.input}
            placeholder="Подъезд, этаж, ориентир (необязательно)"
            value={form.extraInfo}
            onChange={e => set('extraInfo', e.target.value)}
          />

          {/* Location buttons */}
          <div style={s.locRow}>
            <button style={s.locBtn} onClick={requestLocation} disabled={form.geoLoading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {form.geoLoading ? 'Определяем...' : 'Моё место'}
            </button>
            <button style={s.locBtnPrimary} onClick={() => setShowMap(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="currentColor"/>
              </svg>
              Выбрать на карте
            </button>
          </div>
          {form.lat && (
            <div style={s.locConfirmed}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4L19 7" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Точка на карте выбрана
            </div>
          )}
        </div>
      </div>

      {/* Time */}
      <div style={s.section}>
        <div style={s.sLabel}>Время доставки</div>
        <div style={s.timeGrid}>
          {TIME_SLOTS.map(slot => (
            <button
              key={slot.value}
              style={form.deliveryTime === slot.value ? { ...s.timeBtn, ...s.timeBtnActive } : s.timeBtn}
              onClick={() => set('deliveryTime', slot.value)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone */}
      <div style={s.section}>
        <div style={s.sLabel}>Телефон для связи</div>
        <input
          style={s.input}
          type="tel"
          placeholder={user?.phone || '+998 90 123-45-67'}
          value={form.phone}
          onChange={e => set('phone', e.target.value)}
        />
      </div>

      {/* Bottle return */}
      <div style={s.section}>
        <div style={s.sLabel}>Возврат бутылок</div>
        <div style={s.card}>
          <div style={s.bottleRow}>
            <span style={s.bottleText}>Количество бутылок</span>
            <div style={s.stepper}>
              <button style={s.stepperBtn} onClick={() => set('returnCount', Math.max(0, Number(form.returnCount) - 1))}>−</button>
              <span style={s.stepperVal}>{form.returnCount}</span>
              <button style={s.stepperBtn} onClick={() => set('returnCount', Number(form.returnCount) + 1)}>+</button>
            </div>
          </div>
          {bottleDiscount > 0 && (
            <div style={s.discountLine}>Скидка за возврат: −{bottleDiscount.toLocaleString()} сум</div>
          )}
        </div>
      </div>

      {/* Bonus/balance */}
      {(bonusMax > 0 || availableBalance > 0) && (
        <div style={s.section}>
          <div style={s.sLabel}>Скидки</div>
          <div style={s.card}>
            {bonusMax > 0 && (
              <div style={s.discountRow}>
                <div>
                  <div style={s.discountName}>Бонусы</div>
                  <div style={s.discountAvail}>Доступно: {availableBonus.toLocaleString()} сум</div>
                </div>
                <button
                  style={Number(form.bonusUsed) > 0 ? { ...s.useBtn, ...s.useBtnActive } : s.useBtn}
                  onClick={() => set('bonusUsed', Number(form.bonusUsed) > 0 ? 0 : bonusMax)}
                >
                  {Number(form.bonusUsed) > 0 ? `−${Number(form.bonusUsed).toLocaleString()}` : 'Списать'}
                </button>
              </div>
            )}
            {availableBalance > 0 && (
              <div style={s.discountRow}>
                <div>
                  <div style={s.discountName}>Баланс</div>
                  <div style={s.discountAvail}>Доступно: {availableBalance.toLocaleString()} сум</div>
                </div>
                <button
                  style={Number(form.balanceUsed) > 0 ? { ...s.useBtn, ...s.useBtnActive } : s.useBtn}
                  onClick={() => set('balanceUsed', Number(form.balanceUsed) > 0 ? 0 : balanceMax)}
                >
                  {Number(form.balanceUsed) > 0 ? `−${Number(form.balanceUsed).toLocaleString()}` : 'Списать'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment method */}
      <div style={s.section}>
        <div style={s.sLabel}>Способ оплаты</div>
        <div style={s.payMethods}>
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.key}
              style={form.paymentMethod === m.key ? { ...s.payMethod, ...s.payMethodActive } : s.payMethod}
              onClick={() => set('paymentMethod', m.key)}
            >
              <span style={s.payMethodIcon}>{m.icon}</span>
              <span style={s.payMethodLabel}>{m.label}</span>
              {form.paymentMethod === m.key && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto' }}>
                  <path d="M5 12l4 4L19 7" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Total + submit */}
      <div style={s.totalSection}>
        <div style={s.totalRow}>
          <span style={s.totalLabel}>К оплате</span>
          <span style={s.totalAmt}>{finalTotal.toLocaleString()} сум</span>
        </div>
        {error && <div style={s.errorBox}>{error}</div>}
        <button style={s.primaryBtn} onClick={submitOrder} disabled={loading}>
          {loading ? <span style={s.spinner} /> : 'Оформить заказ'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { background: '#fafafa', minHeight: '100dvh', paddingBottom: 16 },

  section: { padding: '0 16px', marginBottom: 16 },
  sLabel: {
    fontSize: 13, fontWeight: 700, color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, paddingLeft: 2,
  },
  card: {
    background: '#fff', borderRadius: 14, padding: 14,
    border: '1px solid #f0f0f0',
    display: 'flex', flexDirection: 'column', gap: 10,
  },

  // Order summary
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  orderName: { fontSize: 14, color: '#333', fontWeight: 500 },
  orderQty: { color: '#999', fontWeight: 400 },
  orderPrice: { fontSize: 14, fontWeight: 700, color: '#111' },
  orderTotalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTop: '1px solid #f0f0f0', marginTop: 4,
    fontSize: 14, color: '#666', fontWeight: 600,
  },
  orderTotal: { fontSize: 18, fontWeight: 800, color: '#111' },

  // Inputs
  input: {
    border: '1.5px solid #eee', borderRadius: 12, padding: '13px 14px',
    fontSize: 15, background: '#f7f7f8', color: '#111',
    outline: 'none', width: '100%', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  },

  // Location
  locRow: { display: 'flex', gap: 8 },
  locBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 8px', borderRadius: 12,
    border: '1.5px solid #eee', background: '#f7f7f8',
    fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer',
  },
  locBtnPrimary: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 8px', borderRadius: 12,
    border: '1.5px solid #4CAF50', background: '#f0faf0',
    fontSize: 13, fontWeight: 700, color: '#2e7d32', cursor: 'pointer',
  },
  locConfirmed: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, fontWeight: 600, color: '#4CAF50',
  },

  // Time
  timeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
    padding: '0 16px',
  },
  timeBtn: {
    padding: '12px 8px', borderRadius: 12,
    border: '1.5px solid #eee', background: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555',
    textAlign: 'center', transition: 'all 0.15s',
  },
  timeBtnActive: {
    border: '1.5px solid #4CAF50', background: '#f0faf0', color: '#2e7d32',
  },

  // Bottles
  bottleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  bottleText: { fontSize: 14, color: '#444', fontWeight: 500 },
  stepper: {
    display: 'flex', alignItems: 'center',
    background: '#f2f2f3', borderRadius: 10, overflow: 'hidden',
  },
  stepperBtn: {
    background: '#4CAF50', border: 'none', width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff', fontSize: 18, fontWeight: 700,
  },
  stepperVal: {
    fontWeight: 700, fontSize: 16, minWidth: 32, textAlign: 'center', color: '#111',
  },
  discountLine: {
    fontSize: 13, fontWeight: 600, color: '#2e7d32',
    background: '#f0faf0', borderRadius: 8, padding: '8px 10px',
  },

  // Discounts
  discountRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  discountName: { fontSize: 14, fontWeight: 600, color: '#333' },
  discountAvail: { fontSize: 12, color: '#999', marginTop: 2 },
  useBtn: {
    padding: '8px 14px', borderRadius: 10,
    border: '1.5px solid #eee', background: '#f7f7f8',
    fontSize: 13, fontWeight: 700, color: '#555', cursor: 'pointer',
  },
  useBtnActive: {
    border: '1.5px solid #4CAF50', background: '#f0faf0', color: '#2e7d32',
  },

  // Payment methods
  payMethods: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '0 16px',
  },
  payMethod: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', borderRadius: 14,
    border: '1.5px solid #eee', background: '#fff',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  payMethodActive: {
    border: '1.5px solid #4CAF50', background: '#f0faf0',
  },
  payMethodIcon: { fontSize: 20 },
  payMethodLabel: { fontSize: 15, fontWeight: 600, color: '#333' },

  // Total
  totalSection: {
    padding: '16px 16px 8px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 4px',
  },
  totalLabel: { fontSize: 15, fontWeight: 600, color: '#888' },
  totalAmt: { fontSize: 26, fontWeight: 800, color: '#111', letterSpacing: -0.5 },
  primaryBtn: {
    background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 14,
    height: 52, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%',
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#888',
    padding: '12px 0', fontSize: 14, cursor: 'pointer', textAlign: 'center',
    width: '100%',
  },
  errorBox: {
    background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10,
    padding: '10px 12px', fontSize: 13, color: '#ef4444', fontWeight: 500,
  },
  spinner: {
    width: 20, height: 20, borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTop: '2.5px solid #fff',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },

  // Card payment screen
  payCard: {
    background: '#111', borderRadius: 16, padding: '18px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  payCardNum: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3, fontFamily: 'monospace' },
  payCardHolder: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 },
  payDivider: { height: 1, background: 'rgba(255,255,255,0.08)' },
  payAmtLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 },
  payAmt: { fontSize: 28, fontWeight: 800, color: '#4CAF50', letterSpacing: -0.5 },
  payAmtCur: { fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.35)' },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  copyBtnDone: {
    background: 'rgba(76,175,80,0.15)', borderColor: 'rgba(76,175,80,0.3)', color: '#4CAF50',
  },
  helpSteps: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: '#fff', borderRadius: 14, padding: 14,
    border: '1px solid #f0f0f0',
  },
  helpStep: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#555', fontWeight: 500 },
  helpNum: {
    width: 26, height: 26, borderRadius: '50%', background: '#4CAF50', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },

  // Success
  successPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '85dvh', padding: '0 24px', gap: 14,
    textAlign: 'center', background: '#fafafa',
  },
  successIcon: {
    width: 80, height: 80, borderRadius: '50%', background: '#4CAF50',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontWeight: 800, color: '#111', margin: 0 },
  successDesc: { fontSize: 14, color: '#888', margin: 0 },
}
