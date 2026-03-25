import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { createOrder, getUserByTelegram, paymentConfirmed, getSettings } from '../api'
import MapPicker from '../components/MapPicker'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'
import { useOrdersStore } from '../store/orders'

const tg = window.Telegram?.WebApp
const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const PAYMENT_METHODS = [
  { key: 'balance', label: 'Баланс', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="16" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  )},
  { key: 'card', label: 'Перевод на карту', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  )},
  { key: 'cash', label: 'Наличные курьеру', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  )},
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
    phone: '', address: '', extraInfo: '',
    lat: null, lng: null, geoLoading: false,
    returnCount: 0, bonusUsed: 0,
    paymentMethod: 'balance',
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

  // Check if cart has 20L items — only then show bottle return
  const has20L = items.some(i => i.product.volume >= 18.9)

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

  // Balance calculation depends on payment method
  const isBalancePayment = form.paymentMethod === 'balance'
  const afterBonus = Math.max(0, afterBottle - Number(form.bonusUsed))
  const balanceUsed = isBalancePayment ? Math.min(availableBalance, afterBonus) : 0
  const finalTotal = Math.max(0, afterBonus - balanceUsed)
  const cardRemainder = isBalancePayment && finalTotal > 0 ? finalTotal : 0

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
    setLoading(true); setError('')
    try {
      const order = await createOrder({
        user_id: user?.id,
        recipient_phone: form.phone || user?.phone,
        address: form.address,
        extra_info: form.extraInfo || null,
        delivery_time: null,
        latitude: form.lat, longitude: form.lng,
        return_bottles_count: Number(form.returnCount),
        return_bottles_volume: has20L ? 20 : 0,
        bottle_discount: bottleDiscount,
        bonus_used: Number(form.bonusUsed),
        balance_used: balanceUsed,
        payment_method: cardRemainder > 0 ? 'balance_card' : form.paymentMethod,
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity, price: i.product.price })),
      })
      setCreatedOrder(order)

      if (form.paymentMethod === 'cash') {
        await paymentConfirmed(order.id)
        finishOrder(order)
      } else if (form.paymentMethod === 'balance' && cardRemainder === 0) {
        await paymentConfirmed(order.id)
        finishOrder(order)
      }
      // card or balance+card → show card payment screen
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
      total: finalTotal, address: form.address,
      recipient_phone: form.phone || user?.phone, status: 'awaiting_confirmation',
    }
    addOrder(fullOrder)
    if (Number(form.bonusUsed)) userStore.deductBonus(Number(form.bonusUsed))
    if (balanceUsed > 0) userStore.deductBalance(balanceUsed)
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
  const needCardPayment = createdOrder && (form.paymentMethod === 'card' || cardRemainder > 0)
  const amountToPay = cardRemainder > 0 ? cardRemainder : finalTotal

  if (needCardPayment) return (
    <div style={s.page}>
      {cardRemainder > 0 && (
        <div style={s.section}>
          <div style={s.balanceNote}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 14, color: '#3c3c43' }}>
              С баланса списано <b style={{ color: C }}>{balanceUsed.toLocaleString()} сум</b>
            </span>
          </div>
        </div>
      )}
      <div style={s.section}>
        <div style={s.sLabel}>Оплата заказа</div>
        <div style={s.payCard}>
          <div style={s.payCardLabel}>Переведите на карту</div>
          <div style={s.payCardNum}>{settings.payment_card || '0000 0000 0000 0000'}</div>
          <div style={s.payCardHolder}>{settings.payment_holder || '—'}</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Сумма</div>
          <div style={s.payAmtBig}>{amountToPay.toLocaleString()} <span style={s.payAmtCur}>сум</span></div>
          <button style={{ ...s.cpyBtn, ...(copied ? s.cpyBtnDone : {}) }} onClick={copyCard}>
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

      {error && <div style={{ padding: '0 16px' }}><div style={s.errorBox}>{error}</div></div>}
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

      {/* Back button */}
      <div style={{ padding: '8px 16px 0' }}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
      </div>

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
                <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              Точка на карте выбрана
            </div>
          )}
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

      {/* Bottle return — only for 20L orders */}
      {has20L && (
        <div style={s.section}>
          <div style={s.sLabel}>Возврат бутылок (20 л)</div>
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
      )}

      {/* Bonus */}
      {bonusMax > 0 && (
        <div style={s.section}>
          <div style={s.sLabel}>Бонусы</div>
          <div style={s.card}>
            <div style={s.discountRow}>
              <div>
                <div style={s.discountName}>Бонусные баллы</div>
                <div style={s.discountAvail}>Доступно: {availableBonus.toLocaleString()} сум</div>
              </div>
              <button
                style={Number(form.bonusUsed) > 0 ? { ...s.useBtn, ...s.useBtnActive } : s.useBtn}
                onClick={() => set('bonusUsed', Number(form.bonusUsed) > 0 ? 0 : bonusMax)}
              >
                {Number(form.bonusUsed) > 0 ? `−${Number(form.bonusUsed).toLocaleString()}` : 'Списать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment method */}
      <div style={s.section}>
        <div style={s.sLabel}>Способ оплаты</div>
        <div style={s.card}>
          {PAYMENT_METHODS.map(m => {
            const isBalance = m.key === 'balance'
            const isSelected = form.paymentMethod === m.key
            return (
              <button
                key={m.key}
                style={isSelected ? { ...s.payMethod, ...s.payMethodActive } : s.payMethod}
                onClick={() => set('paymentMethod', m.key)}
              >
                <div style={{ color: isSelected ? C : '#8e8e93' }}>{m.icon}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ ...s.payMethodLabel, color: isSelected ? '#1a1a1a' : '#3c3c43' }}>
                    {isBalance ? `Баланс (${availableBalance.toLocaleString()} сум)` : m.label}
                  </span>
                  {isBalance && isSelected && availableBalance > 0 && availableBalance < afterBonus && (
                    <div style={{ fontSize: 12, color: '#e67e22', marginTop: 3, fontWeight: 500 }}>
                      Остаток {(afterBonus - availableBalance).toLocaleString()} сум — переводом на карту
                    </div>
                  )}
                  {isBalance && availableBalance === 0 && (
                    <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 3 }}>
                      Пополните баланс в профиле
                    </div>
                  )}
                </div>
                {isSelected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Total + submit */}
      <div style={s.totalSection}>
        <div style={s.totalRow}>
          <span style={s.totalLabel}>К оплате</span>
          <span style={s.totalAmt}>{finalTotal.toLocaleString()} сум</span>
        </div>
        {isBalancePayment && balanceUsed > 0 && (
          <div style={{ padding: '0 4px', fontSize: 13, color: '#8e8e93' }}>
            С баланса: {balanceUsed.toLocaleString()} сум
            {cardRemainder > 0 && <span> · Картой: {cardRemainder.toLocaleString()} сум</span>}
          </div>
        )}
        {error && <div style={s.errorBox}>{error}</div>}
        <button style={s.primaryBtn} onClick={submitOrder} disabled={loading}>
          {loading ? <span style={s.spinner} /> : 'Оформить заказ'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { background: '#e4e4e8', minHeight: '100dvh', paddingBottom: 16 },

  backBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', padding: '8px 0',
    fontSize: 15, fontWeight: 600, color: '#1a1a1a', cursor: 'pointer',
  },

  section: { padding: '0 16px', marginBottom: 12 },
  sLabel: {
    fontSize: 13, fontWeight: 700, color: '#8e8e93',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, paddingLeft: 2,
  },
  card: {
    background: '#fff', borderRadius: 18, padding: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },

  // Order summary
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  orderName: { fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  orderQty: { color: '#8e8e93', fontWeight: 400 },
  orderPrice: { fontSize: 14, fontWeight: 700, color: '#1a1a1a' },
  orderTotalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTop: '1px solid #f0f0f2', marginTop: 4,
    fontSize: 14, color: '#8e8e93', fontWeight: 600,
  },
  orderTotal: { fontSize: 18, fontWeight: 800, color: '#1a1a1a' },

  // Inputs
  input: {
    border: '1.5px solid #e5e5ea', borderRadius: 14, padding: '13px 14px',
    fontSize: 15, background: '#f8f8fa', color: '#1a1a1a',
    outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
  },

  // Location
  locRow: { display: 'flex', gap: 8 },
  locBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 8px', borderRadius: 14,
    border: '1.5px solid #e5e5ea', background: '#f8f8fa',
    fontSize: 13, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
  },
  locBtnPrimary: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 8px', borderRadius: 14,
    border: `1.5px solid ${C}`, background: `${C}08`,
    fontSize: 13, fontWeight: 700, color: C, cursor: 'pointer',
  },
  locConfirmed: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, fontWeight: 600, color: C,
  },

  // Bottles
  bottleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  bottleText: { fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  stepper: {
    display: 'flex', alignItems: 'center',
    background: '#f0f0f2', borderRadius: 12, overflow: 'hidden',
  },
  stepperBtn: {
    background: GRAD, border: 'none', width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff', fontSize: 18, fontWeight: 700,
  },
  stepperVal: {
    fontWeight: 700, fontSize: 16, minWidth: 32, textAlign: 'center', color: '#1a1a1a',
  },
  discountLine: {
    fontSize: 13, fontWeight: 600, color: C,
    background: `${C}08`, borderRadius: 10, padding: '8px 10px',
  },

  // Discounts
  discountRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  discountName: { fontSize: 14, fontWeight: 600, color: '#1a1a1a' },
  discountAvail: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  useBtn: {
    padding: '8px 14px', borderRadius: 12,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 700, color: '#3c3c43', cursor: 'pointer',
  },
  useBtnActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },

  // Payment methods
  payMethod: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14,
    border: '1.5px solid transparent', background: '#f8f8fa',
    cursor: 'pointer', width: '100%',
  },
  payMethodActive: {
    border: `1.5px solid ${C}30`, background: `${C}06`,
  },
  payMethodLabel: { fontSize: 15, fontWeight: 600 },

  // Balance note on card payment screen
  balanceNote: {
    background: `${C}10`, borderRadius: 14, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 8,
  },

  // Total
  totalSection: {
    padding: '8px 16px 8px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 4px',
  },
  totalLabel: { fontSize: 15, fontWeight: 600, color: '#8e8e93' },
  totalAmt: { fontSize: 26, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.5 },
  primaryBtn: {
    background: GRAD, color: '#fff', border: 'none', borderRadius: 14,
    height: 52, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#8e8e93',
    padding: '12px 0', fontSize: 14, cursor: 'pointer', textAlign: 'center',
    width: '100%',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14,
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
    background: '#1a1a1a', borderRadius: 18, padding: '18px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  payCardNum: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3, fontFamily: 'monospace' },
  payCardHolder: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 },
  payAmtBig: { fontSize: 28, fontWeight: 800, color: C, letterSpacing: -0.5 },
  payAmtCur: { fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.35)' },
  cpyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  cpyBtnDone: {
    background: `${C}25`, borderColor: `${C}50`, color: C,
  },
  helpSteps: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: '#fff', borderRadius: 18, padding: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  helpStep: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  helpNum: {
    width: 26, height: 26, borderRadius: '50%', background: GRAD, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },

  // Success
  successPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '85dvh', padding: '0 24px', gap: 14,
    textAlign: 'center', background: '#e4e4e8',
  },
  successIcon: {
    width: 80, height: 80, borderRadius: '50%', background: GRAD,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  successTitle: { fontSize: 24, fontWeight: 800, color: '#1a1a1a', margin: 0 },
  successDesc: { fontSize: 14, color: '#8e8e93', margin: 0 },
}
