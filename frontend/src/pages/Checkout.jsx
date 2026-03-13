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
  { label: 'Сег. 9–12', value: 'Сегодня 9:00–12:00' },
  { label: 'Сег. 12–15', value: 'Сегодня 12:00–15:00' },
  { label: 'Сег. 15–18', value: 'Сегодня 15:00–18:00' },
  { label: 'Сег. 18–21', value: 'Сегодня 18:00–21:00' },
  { label: 'Завт. 9–12', value: 'Завтра 9:00–12:00' },
  { label: 'Завт. 12–15', value: 'Завтра 12:00–15:00' },
  { label: 'Завт. 15–18', value: 'Завтра 15:00–18:00' },
  { label: 'Завт. 18–21', value: 'Завтра 18:00–21:00' },
]

const STEPS = [
  { label: 'Доставка' },
  { label: 'Скидки' },
  { label: 'Оплата' },
]

const P = '#8DC63F'
const PD = '#6CA32F'

// ─── SVG Icons ───────────────────────────────────────────────────────────────
function IcoLocation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/>
    </svg>
  )
}
function IcoPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/>
    </svg>
  )
}
function IcoClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
function IcoBottle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 2h6M8 6h8l1 14H7L8 6zM10 6V4M14 6V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 12c0 1.1.9 2 2 2s2-.9 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcoStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
    </svg>
  )
}
function IcoWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.7"/>
      <circle cx="17" cy="15" r="1.5" fill="currentColor"/>
    </svg>
  )
}
function IcoCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.7"/>
      <rect x="5" y="14" width="4" height="2" rx="1" fill="currentColor"/>
    </svg>
  )
}
function IcoCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IcoChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IcoCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  )
}
function IcoCross() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="#888" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function IcoMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7M9 20l6-3M9 20V7m6 13l4.447 2.224A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7M15 20V7M9 7l6-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcoTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function IcoSpin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', display: 'block' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
      <path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
function IcoSpinGreen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', display: 'block' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(141,198,63,0.2)" strokeWidth="2.5"/>
      <path d="M12 3a9 9 0 0 1 9 9" stroke={P} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div style={s.stepBar}>
      {STEPS.map((st, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={st.label} style={s.stepItem}>
            <div style={{
              ...s.stepCircle,
              ...(done ? s.stepDone : active ? s.stepActive : s.stepPending)
            }}>
              {done ? <IcoCheck /> : <span style={{ fontSize: 12, fontWeight: 800 }}>{n}</span>}
            </div>
            <span style={{
              fontSize: 11, fontWeight: active ? 700 : 500,
              color: active ? P : done ? PD : '#C0C0C0',
              marginTop: 5, whiteSpace: 'nowrap',
              letterSpacing: 0.1,
            }}>{st.label}</span>
            {i < STEPS.length - 1 && (
              <div style={{ ...s.stepConnector, ...(done ? { background: PD } : {}) }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ ...s.card, ...style }}>{children}</div>
}

// ─── Input component with label ───────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div style={s.field}>
      {label && (
        <div style={s.fieldLabel}>
          {label}
          {required && <span style={{ color: '#FF3B30', marginLeft: 2 }}>*</span>}
        </div>
      )}
      {hint && <div style={s.fieldHint}>{hint}</div>}
      {children}
    </div>
  )
}

function TextInput({ ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      style={{
        ...s.input,
        ...(focused ? s.inputFocused : {}),
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  )
}

// ─── Section header row ───────────────────────────────────────────────────────
function SectionHead({ icon, title, subtitle, color }) {
  return (
    <div style={s.sectionHead}>
      <div style={{ ...s.sectionIcon, color: color || PD, background: color ? `${color}18` : `${P}18` }}>
        {icon}
      </div>
      <div>
        <div style={s.sectionTitle}>{title}</div>
        {subtitle && <div style={s.sectionSub}>{subtitle}</div>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const navigate = useNavigate()
  const { user: authUser } = useAuthStore()
  const userStore = useUserStore()
  const { addOrder } = useOrdersStore()

  const [step, setStep] = useState(1)
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({
    payment_card: '',
    payment_holder: '',
    bottle_discount_type: 'fixed',
    bottle_discount_value: 2000,
  })
  const [form, setForm] = useState({
    useOwnPhone: true,
    phone: '',
    address: '',
    extraInfo: '',
    deliveryTime: '',
    lat: null, lng: null,
    geoLoading: false,
    returnCount: 0,
    returnVolume: '',
    bonusUsed: 0,
    balanceUsed: 0,
  })
  const [showMap, setShowMap] = useState(false)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentDone, setPaymentDone] = useState(false)
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

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }))

  const bottleDiscountAmount = (() => {
    const count = Number(form.returnCount)
    if (!count) return 0
    if (settings.bottle_discount_type === 'percent') {
      return Math.round(total() * (settings.bottle_discount_value / 100))
    }
    return count * Number(settings.bottle_discount_value)
  })()

  const subtotal = total()
  const afterBottle = subtotal - bottleDiscountAmount
  const availableBonus = userStore.initialized ? userStore.bonus_points : (user?.bonus_points || 0)
  const availableBalance = userStore.initialized ? userStore.balance : (user?.balance || 0)
  const bonusMax = Math.min(availableBonus, afterBottle)
  const balanceMax = Math.min(availableBalance, afterBottle - Number(form.bonusUsed))
  const finalTotal = Math.max(0, afterBottle - Number(form.bonusUsed) - Number(form.balanceUsed))

  const getUserLocation = () => {
    if (!navigator.geolocation) { setError('Геолокация недоступна'); return }
    set('geoLoading', true); setError('')
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude, geoLoading: false })),
      () => { set('geoLoading', false); setError('Разрешите доступ к местоположению') },
      { timeout: 10000 }
    )
  }

  const goStep2 = () => {
    if (!form.address.trim()) return setError('Введите адрес доставки')
    if (!form.lat || !form.lng) return setError('Отметьте точку на карте — курьер использует её для навигации')
    if (!form.deliveryTime) return setError('Выберите удобное время доставки')
    if (!form.useOwnPhone && !form.phone.trim()) return setError('Введите номер телефона')
    setError(''); setStep(2)
  }

  const submitOrder = async () => {
    setLoading(true); setError('')
    try {
      const order = await createOrder({
        user_id: user?.id,
        recipient_phone: form.useOwnPhone ? user?.phone : form.phone,
        address: form.address,
        extra_info: form.extraInfo || null,
        delivery_time: form.deliveryTime || null,
        latitude: form.lat, longitude: form.lng,
        return_bottles_count: Number(form.returnCount),
        return_bottles_volume: Number(form.returnVolume) || 0,
        bottle_discount: bottleDiscountAmount,
        bonus_used: Number(form.bonusUsed),
        balance_used: Number(form.balanceUsed),
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity, price: i.product.price })),
      })
      setCreatedOrder(order); setStep(3)
    } catch {
      setError('Ошибка создания заказа. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async () => {
    setLoading(true); setError('')
    try {
      await paymentConfirmed(createdOrder.id)
      // Add to orders list and update user store
      const fullOrder = {
        ...createdOrder,
        items: items.map(i => ({
          id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
          volume: i.product.volume,
        })),
        return_bottles_count: Number(form.returnCount),
        return_bottles_volume: Number(form.returnVolume) || 0,
        bottle_discount: bottleDiscountAmount,
        bonus_used: Number(form.bonusUsed),
        balance_used: Number(form.balanceUsed),
        total: finalTotal,
        address: form.address,
        delivery_time: form.deliveryTime,
        recipient_phone: form.useOwnPhone ? user?.phone : form.phone,
        status: 'awaiting_confirmation',
      }
      addOrder(fullOrder)
      if (Number(form.bonusUsed)) userStore.deductBonus(Number(form.bonusUsed))
      if (Number(form.balanceUsed)) userStore.deductBalance(Number(form.balanceUsed))
      userStore.incrementOrders()
      setPaymentDone(true); clearCart()
    } catch {
      setError('Ошибка подтверждения оплаты')
    } finally {
      setLoading(false)
    }
  }

  const copyCard = () => {
    navigator.clipboard?.writeText(settings.payment_card || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // ─── Success ───────────────────────────────────────────────────────────────
  if (paymentDone) return (
    <div style={s.successPage}>
      <div style={s.successRing}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 style={s.successTitle}>Заказ принят!</h2>
      <p style={s.successDesc}>Ожидайте подтверждения. Мы пришлём уведомление.</p>
      <button style={s.primaryBtn} onClick={() => navigate('/orders')}>
        Отследить заказ
        <IcoChevronRight />
      </button>
      <button style={s.ghostBtn} onClick={() => navigate('/')}>Продолжить покупки</button>
    </div>
  )

  return (
    <div style={s.page}>
      {showMap && (
        <MapPicker
          lat={form.lat} lng={form.lng}
          onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
          onClose={() => setShowMap(false)}
        />
      )}

      <StepBar step={step} />

      {/* ═══════════════ STEP 1: Delivery ═══════════════ */}
      {step === 1 && (
        <div style={s.content}>
          {/* Cart summary */}
          <Card>
            <div style={s.miniSummaryTitle}>Ваш заказ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(({ product, quantity }) => (
                <div key={product.id} style={s.cartRow}>
                  <div style={s.cartRowLeft}>
                    <div style={s.qtyBadge}>{quantity}</div>
                    <span style={s.cartName}>{product.name}</span>
                  </div>
                  <span style={s.cartPrice}>{(product.price * quantity).toLocaleString()} ₸</span>
                </div>
              ))}
            </div>
            <div style={s.cartTotalRow}>
              <span style={{ fontSize: 14, color: '#666', fontWeight: 600 }}>Итого</span>
              <span style={s.cartTotalAmt}>{subtotal.toLocaleString()} ₸</span>
            </div>
          </Card>

          {/* Phone */}
          <Card>
            <SectionHead icon={<IcoPhone />} title="Телефон для связи" />
            <div style={s.phoneToggle}>
              <button
                style={{ ...s.phoneOption, ...(form.useOwnPhone ? s.phoneOptionActive : {}) }}
                onClick={() => set('useOwnPhone', true)}
              >
                <div style={s.phoneOptionLabel}>Мой номер</div>
                <div style={s.phoneOptionVal}>{user?.phone || '—'}</div>
              </button>
              <button
                style={{ ...s.phoneOption, ...(!form.useOwnPhone ? s.phoneOptionActive : {}) }}
                onClick={() => set('useOwnPhone', false)}
              >
                <div style={s.phoneOptionLabel}>Другой номер</div>
                <div style={s.phoneOptionVal}>Ввести вручную</div>
              </button>
            </div>
            {!form.useOwnPhone && (
              <TextInput
                type="tel" placeholder="+998 90 123-45-67"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                style={{ marginTop: 4 }}
              />
            )}
          </Card>

          {/* Address */}
          <Card>
            <SectionHead icon={<IcoLocation />} title="Адрес доставки" />
            <Field required>
              <TextInput
                placeholder="Улица, дом, квартира"
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </Field>
            <Field>
              <TextInput
                placeholder="Подъезд, этаж, ориентир"
                value={form.extraInfo}
                onChange={e => set('extraInfo', e.target.value)}
              />
            </Field>
          </Card>

          {/* Map */}
          <Card>
            <SectionHead icon={<IcoMap />} title="Точка на карте" subtitle="Курьер использует метку для навигации" />
            {form.lat && (
              <div style={s.geoSuccess}>
                <div style={s.geoSuccessLeft}>
                  <div style={s.geoDot} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: PD }}>Точка выбрана</div>
                    <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
                      {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                    </div>
                  </div>
                </div>
                <button style={s.geoResetBtn} onClick={() => setForm(f => ({ ...f, lat: null, lng: null }))}>
                  <IcoCross />
                </button>
              </div>
            )}
            <div style={s.geoRow}>
              <button style={s.geoAutoBtn} onClick={getUserLocation} disabled={form.geoLoading}>
                {form.geoLoading ? <IcoSpinGreen /> : <IcoTarget />}
                {form.geoLoading ? 'Определяем...' : 'Авто'}
              </button>
              <button style={s.geoMapBtn} onClick={() => setShowMap(true)}>
                <IcoMap />
                Выбрать на карте
              </button>
            </div>
          </Card>

          {/* Time slots */}
          <Card>
            <SectionHead icon={<IcoClock />} title="Время доставки" />
            <div style={s.timeGrid}>
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot.value}
                  style={{ ...s.timeChip, ...(form.deliveryTime === slot.value ? s.timeChipActive : {}) }}
                  onClick={() => set('deliveryTime', slot.value)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            <TextInput
              placeholder="Или введите своё время..."
              value={form.deliveryTime.includes('Сег') || form.deliveryTime.includes('Завт') ? '' : form.deliveryTime}
              onChange={e => set('deliveryTime', e.target.value)}
              style={{ marginTop: 8 }}
            />
          </Card>

          {error && <div style={s.errorBox}>{error}</div>}
          <button style={s.primaryBtn} onClick={goStep2}>
            Далее — Скидки
            <IcoChevronRight />
          </button>
        </div>
      )}

      {/* ═══════════════ STEP 2: Discounts ═══════════════ */}
      {step === 2 && (
        <div style={s.content}>
          {/* Bottle return */}
          <Card>
            <SectionHead icon={<IcoBottle />} title="Возврат бутылок" subtitle="Скидка за каждую возвращённую бутылку" color="#2B8A3E" />
            <div style={s.bottleRow}>
              <div style={s.bottleCol}>
                <div style={s.bottleLabel}>Количество</div>
                <div style={s.counter}>
                  <button style={s.cBtn} onClick={() => set('returnCount', Math.max(0, Number(form.returnCount) - 1))}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <span style={s.counterVal}>{form.returnCount}</span>
                  <button style={s.cBtn} onClick={() => set('returnCount', Number(form.returnCount) + 1)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div style={s.bottleCol}>
                <div style={s.bottleLabel}>Объём (л)</div>
                <TextInput
                  type="number" min="0" step="0.5" placeholder="18.9"
                  value={form.returnVolume}
                  onChange={e => set('returnVolume', e.target.value)}
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>
            {bottleDiscountAmount > 0 && (
              <div style={{ ...s.discountBanner, borderColor: '#C3E6CB', background: '#F0FFF4' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#2B8A3E"/>
                </svg>
                <div>
                  <div style={{ fontSize: 12, color: '#2B8A3E', fontWeight: 600 }}>Скидка за возврат</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#2B8A3E', letterSpacing: -0.5 }}>
                    −{bottleDiscountAmount.toLocaleString()} ₸
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Bonus points */}
          {bonusMax > 0 && (
            <Card>
              <SectionHead icon={<IcoStar />} title="Бонусные баллы" subtitle={`Доступно: ${availableBonus.toLocaleString()} ₸`} color="#E67700" />
              <div style={s.bonusRow}>
                <button style={s.bonusMaxBtn} onClick={() => set('bonusUsed', bonusMax)}>
                  Списать все
                </button>
                <TextInput
                  type="number" min="0" max={bonusMax}
                  placeholder="0"
                  value={form.bonusUsed || ''}
                  onChange={e => set('bonusUsed', Math.min(bonusMax, Math.max(0, +e.target.value)))}
                  style={{ flex: 1, textAlign: 'right' }}
                />
              </div>
              {Number(form.bonusUsed) > 0 && (
                <div style={{ ...s.discountBanner, borderColor: '#FFD8A8', background: '#FFF4E6' }}>
                  <IcoStar />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E67700' }}>
                    −{Number(form.bonusUsed).toLocaleString()} ₸ бонусами
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Balance */}
          {availableBalance > 0 && (
            <Card>
              <SectionHead icon={<IcoWallet />} title="Баланс счёта" subtitle={`Доступно: ${availableBalance.toLocaleString()} ₸`} color="#1971C2" />
              <div style={s.bonusRow}>
                <button style={{ ...s.bonusMaxBtn, borderColor: '#1971C2', color: '#1971C2' }}
                  onClick={() => set('balanceUsed', balanceMax)}>
                  Списать всё
                </button>
                <TextInput
                  type="number" min="0" max={balanceMax}
                  placeholder="0"
                  value={form.balanceUsed || ''}
                  onChange={e => set('balanceUsed', Math.min(balanceMax, Math.max(0, +e.target.value)))}
                  style={{ flex: 1, textAlign: 'right' }}
                />
              </div>
              {Number(form.balanceUsed) > 0 && (
                <div style={{ ...s.discountBanner, borderColor: '#A5D8FF', background: '#E7F5FF' }}>
                  <IcoWallet />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1971C2' }}>
                    −{Number(form.balanceUsed).toLocaleString()} ₸ с баланса
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Order summary dark card */}
          <Card style={s.summaryDark}>
            <div style={s.sumHeader}>Итог заказа</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(({ product, quantity }) => (
                <div key={product.id} style={s.sumItemRow}>
                  <span style={{ fontSize: 13, color: '#999' }}>{product.name} × {quantity}</span>
                  <span style={{ fontSize: 13, color: '#CCC', fontWeight: 600 }}>{(product.price * quantity).toLocaleString()} ₸</span>
                </div>
              ))}
            </div>
            <div style={s.sumDivider} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={s.sumRow}>
                <span>Товары</span>
                <span>{subtotal.toLocaleString()} ₸</span>
              </div>
              {bottleDiscountAmount > 0 && (
                <div style={{ ...s.sumRow, color: '#52B788' }}>
                  <span>Скидка за бутылки</span>
                  <span>−{bottleDiscountAmount.toLocaleString()}</span>
                </div>
              )}
              {Number(form.bonusUsed) > 0 && (
                <div style={{ ...s.sumRow, color: '#FFA94D' }}>
                  <span>Бонусы</span>
                  <span>−{Number(form.bonusUsed).toLocaleString()}</span>
                </div>
              )}
              {Number(form.balanceUsed) > 0 && (
                <div style={{ ...s.sumRow, color: '#74C0FC' }}>
                  <span>Баланс</span>
                  <span>−{Number(form.balanceUsed).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div style={s.sumDivider} />
            <div style={s.sumFinalRow}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#999' }}>К оплате</span>
              <span style={{ fontSize: 28, fontWeight: 900, color: P, letterSpacing: -1 }}>
                {finalTotal.toLocaleString()} <span style={{ fontSize: 16, fontWeight: 400, color: '#666' }}>сум</span>
              </span>
            </div>
          </Card>

          {/* Recap */}
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <IcoLocation />, text: form.address },
                form.extraInfo && { icon: <IcoLocation />, text: form.extraInfo },
                { icon: <IcoClock />, text: form.deliveryTime },
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={s.recapRow}>
                  <div style={s.recapIcon}>{row.icon}</div>
                  <span style={s.recapText}>{row.text}</span>
                </div>
              ))}
            </div>
          </Card>

          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.btnRow}>
            <button style={s.backBtn} onClick={() => setStep(1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Назад
            </button>
            <button style={{ ...s.primaryBtn, flex: 2 }} onClick={submitOrder} disabled={loading}>
              {loading ? <IcoSpin /> : <>К оплате · {finalTotal.toLocaleString()} ₸</>}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 3: Payment ═══════════════ */}
      {step === 3 && createdOrder && (
        <div style={s.content}>
          <div style={s.orderCreatedBadge}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 7" stroke={PD} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Заказ #{createdOrder.id} создан
          </div>

          {/* Payment card */}
          <div style={s.payCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex' }}><IcoCard /></div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3 }}>
                Перевод на карту
              </span>
            </div>
            <div style={s.payCardNum}>
              {settings.payment_card || '0000 0000 0000 0000'}
            </div>
            <div style={s.payCardHolder}>
              {settings.payment_holder || '—'}
            </div>
            <div style={s.payDivider} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Сумма к переводу
            </div>
            <div style={s.payAmt}>
              {finalTotal.toLocaleString()}
              <span style={{ fontSize: 18, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>сум</span>
            </div>
            <button
              style={{ ...s.copyBtn, ...(copied ? s.copyBtnDone : {}) }}
              onClick={copyCard}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  Скопировано
                </>
              ) : (
                <>
                  <IcoCopy />
                  Скопировать номер карты
                </>
              )}
            </button>
          </div>

          {/* Steps */}
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { n: 1, icon: <IcoCard />, text: 'Переведите ₸му на карту выше' },
                { n: 2, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>, text: 'Нажмите «Я оплатил» ниже' },
                { n: 3, icon: <IcoPhone />, text: 'Администратор подтвердит заказ' },
              ].map(st => (
                <div key={st.n} style={s.payStep}>
                  <div style={s.payStepNum}>{st.n}</div>
                  <div style={{ color: '#666', display: 'flex', flexShrink: 0 }}>{st.icon}</div>
                  <span style={s.payStepText}>{st.text}</span>
                </div>
              ))}
            </div>
          </Card>

          {error && <div style={s.errorBox}>{error}</div>}
          <button style={s.payConfirmBtn} onClick={confirmPayment} disabled={loading}>
            {loading ? <IcoSpin /> : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Я оплатил
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  page: { background: '#F2F2F7', minHeight: '100vh', paddingBottom: 40 },
  content: { display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' },

  // Step bar
  stepBar: {
    display: 'flex', padding: '16px 24px 12px',
    background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)',
    alignItems: 'flex-start',
    position: 'sticky', top: 0, zIndex: 50,
    boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
  },
  stepItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flex: 1, position: 'relative',
  },
  stepCircle: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1, position: 'relative', transition: 'all 0.25s',
  },
  stepPending: { background: '#EFEFEF', color: '#B0B0B0' },
  stepActive: { background: P, color: '#fff', boxShadow: `0 4px 14px ${P}55` },
  stepDone: { background: PD, color: '#fff' },
  stepConnector: {
    position: 'absolute', top: 16, left: '50%', width: '100%', height: 2,
    background: '#E5E5EA', zIndex: 0, transition: 'background 0.3s',
  },

  // Card
  card: {
    background: '#fff', borderRadius: 18, padding: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },

  // Section header
  sectionHead: { display: 'flex', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1A1A1A' },
  sectionSub: { fontSize: 12, color: '#8E8E93', marginTop: 1 },

  // Field
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: '#444' },
  fieldHint: { fontSize: 12, color: '#8E8E93' },
  input: {
    border: '1.5px solid #E5E5EA',
    borderRadius: 12, padding: '13px 14px',
    fontSize: 15, background: '#FAFAFA', color: '#1A1A1A',
    outline: 'none', width: '100%', fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    WebkitAppearance: 'none',
  },
  inputFocused: {
    borderColor: P,
    boxShadow: `0 0 0 3px ${P}30`,
    background: '#fff',
  },

  // Cart mini summary
  miniSummaryTitle: { fontSize: 11, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.8 },
  cartRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cartRowLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBadge: {
    width: 22, height: 22, borderRadius: '50%',
    background: P, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 800,
  },
  cartName: { fontSize: 13, color: '#333', fontWeight: 500 },
  cartPrice: { fontSize: 13, fontWeight: 700, color: '#1A1A1A' },
  cartTotalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTop: '1px solid #F2F2F2', marginTop: 2,
  },
  cartTotalAmt: { fontSize: 18, fontWeight: 900, color: P },

  // Phone toggle
  phoneToggle: { display: 'flex', gap: 8 },
  phoneOption: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 2,
    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
    border: '2px solid #EBEBEB', background: '#FAFAFA',
    transition: 'all 0.2s', textAlign: 'left',
  },
  phoneOptionActive: { border: `2px solid ${P}`, background: '#F4FCE3' },
  phoneOptionLabel: { fontSize: 12, fontWeight: 700, color: '#1A1A1A' },
  phoneOptionVal: { fontSize: 12, color: '#888' },

  // Geo
  geoSuccess: {
    background: '#F4FCE3', borderRadius: 12, padding: '10px 14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    border: `1px solid ${P}40`,
  },
  geoSuccessLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  geoDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: P, boxShadow: `0 0 0 4px ${P}30`, flexShrink: 0,
  },
  geoResetBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center',
  },
  geoRow: { display: 'flex', gap: 8 },
  geoAutoBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px', borderRadius: 12,
    border: '1.5px solid #E5E5EA', background: '#FAFAFA',
    fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  geoMapBtn: {
    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px', borderRadius: 12,
    border: `1.5px solid ${P}`, background: '#F4FCE3',
    fontSize: 14, fontWeight: 700, color: PD, cursor: 'pointer',
    transition: 'all 0.2s',
  },

  // Time grid
  timeGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 },
  timeChip: {
    padding: '10px 4px', borderRadius: 10,
    border: '1.5px solid #E5E5EA', background: '#FAFAFA',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#555',
    transition: 'all 0.2s', lineHeight: 1.2, textAlign: 'center',
  },
  timeChipActive: { border: `1.5px solid ${P}`, background: '#F4FCE3', color: PD, fontWeight: 700 },

  // Bottle return
  bottleRow: { display: 'flex', gap: 14 },
  bottleCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  bottleLabel: { fontSize: 12, fontWeight: 600, color: '#888' },
  counter: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '4px 0' },
  cBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: P, border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 2px 10px ${P}40`, transition: 'transform 0.15s, opacity 0.15s',
  },
  counterVal: { fontWeight: 900, fontSize: 22, minWidth: 28, textAlign: 'center', color: '#1A1A1A' },
  discountBanner: {
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    border: '1px solid',
  },

  // Bonus / balance
  bonusRow: { display: 'flex', gap: 8, alignItems: 'center' },
  bonusMaxBtn: {
    background: '#F4FCE3', border: `1.5px solid ${P}`,
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, fontWeight: 700, color: PD, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.15s',
  },

  // Summary dark
  summaryDark: {
    background: '#111827', gap: 10,
  },
  sumHeader: { fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  sumItemRow: { display: 'flex', justifyContent: 'space-between' },
  sumDivider: { height: 1, background: 'rgba(255,255,255,0.08)' },
  sumRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#777' },
  sumFinalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  // Recap
  recapRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  recapIcon: { color: '#8E8E93', flexShrink: 0, display: 'flex', marginTop: 1 },
  recapText: { fontSize: 13, color: '#555', lineHeight: 1.5 },

  // Buttons
  primaryBtn: {
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '16px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: `0 4px 20px ${P}50`,
    transition: 'transform 0.15s, opacity 0.15s',
    letterSpacing: -0.2,
  },
  ghostBtn: {
    background: 'none', border: 'none', color: '#8E8E93',
    padding: '12px 0', fontSize: 14, cursor: 'pointer', textAlign: 'center',
  },
  backBtn: {
    flex: 1, background: '#EFEFEF', border: 'none', borderRadius: 14, padding: '16px 0',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#555',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'all 0.15s',
  },
  btnRow: { display: 'flex', gap: 10 },
  errorBox: {
    background: '#FFF3F3', border: '1px solid #FFD0D0', borderRadius: 12,
    padding: '12px 14px', fontSize: 13, color: '#E03131', fontWeight: 500,
    lineHeight: 1.5,
  },

  // Payment step 3
  orderCreatedBadge: {
    background: '#F4FCE3', border: `1px solid ${P}40`, borderRadius: 12,
    padding: '12px 16px', fontSize: 14, fontWeight: 700, color: PD,
    textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  payCard: {
    background: 'linear-gradient(145deg, #0f1923, #1a2840)',
    borderRadius: 20, padding: '22px 20px',
    display: 'flex', flexDirection: 'column', gap: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  },
  payCardNum: {
    fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 4,
    fontFamily: 'monospace', padding: '4px 0',
  },
  payCardHolder: {
    fontSize: 14, color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  payDivider: { height: 1, background: 'rgba(255,255,255,0.08)' },
  payAmt: {
    fontSize: 36, fontWeight: 900, color: P, lineHeight: 1,
    display: 'flex', alignItems: 'baseline', letterSpacing: -1,
  },
  copyBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, padding: '10px 16px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  copyBtnDone: {
    background: `${P}30`, borderColor: `${P}50`, color: P,
  },
  payStep: { display: 'flex', alignItems: 'center', gap: 12 },
  payStepNum: {
    width: 28, height: 28, borderRadius: '50%',
    background: P, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 800, flexShrink: 0,
  },
  payStepText: { fontSize: 14, color: '#555', fontWeight: 500, lineHeight: 1.4 },
  payConfirmBtn: {
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    color: '#fff', border: 'none', borderRadius: 16,
    padding: '18px 0', fontSize: 18, fontWeight: 800, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: `0 6px 28px ${P}55`, transition: 'transform 0.15s',
  },

  // Success
  successPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '90vh', padding: '0 28px', gap: 18,
    textAlign: 'center', background: '#F2F2F7',
  },
  successRing: {
    width: 96, height: 96, borderRadius: '50%',
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 8px 32px ${P}55`,
  },
  successTitle: { fontSize: 28, fontWeight: 900, color: '#1A1A1A', letterSpacing: -0.5, margin: 0 },
  successDesc: { fontSize: 15, color: '#8E8E93', lineHeight: 1.6, maxWidth: 300, margin: 0 },
}
