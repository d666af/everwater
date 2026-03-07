import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { createOrder, getUserByTelegram, paymentConfirmed, getSettings } from '../api'
import MapPicker from '../components/MapPicker'
import { useAuthStore } from '../store/auth'

const tg = window.Telegram?.WebApp

const TIME_SLOTS = [
  'Сегодня 9:00–12:00',
  'Сегодня 12:00–15:00',
  'Сегодня 15:00–18:00',
  'Сегодня 18:00–21:00',
  'Завтра 9:00–12:00',
  'Завтра 12:00–15:00',
  'Завтра 15:00–18:00',
  'Завтра 18:00–21:00',
]

const STEPS = ['Доставка', 'Возврат', 'Оплата']

export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const navigate = useNavigate()
  const { user: authUser } = useAuthStore()

  const [step, setStep] = useState(1)
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState({ payment_card: '', payment_holder: '', bottle_discount_type: 'fixed', bottle_discount_value: 2000 })
  const [form, setForm] = useState({
    useOwnPhone: true,
    phone: '',
    address: '',
    extraInfo: '',
    deliveryTime: '',
    lat: null,
    lng: null,
    geoLoading: false,
    returnCount: 0,
    returnVolume: '',
    bonusUsed: 0,
  })
  const [showMap, setShowMap] = useState(false)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentDone, setPaymentDone] = useState(false)

  useEffect(() => {
    // Try Telegram WebApp user first, then web auth user
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(u => { setUser(u); setForm(f => ({ ...f, phone: u.phone || '' })) })
        .catch(console.error)
    } else if (authUser) {
      setUser(authUser)
      setForm(f => ({ ...f, phone: authUser.phone || '' }))
    }
    getSettings().then(setSettings).catch(console.error)
  }, [authUser])

  const bottleDiscountAmount = (() => {
    const { bottle_discount_type, bottle_discount_value } = settings
    const count = Number(form.returnCount)
    if (!count) return 0
    if (bottle_discount_type === 'percent') {
      return Math.round(total() * (bottle_discount_value / 100))
    }
    return count * Number(bottle_discount_value)
  })()

  const bonusMax = Math.min(user?.bonus_points || 0, total() - bottleDiscountAmount)
  const subtotal = total()
  const finalTotal = Math.max(0, subtotal - bottleDiscountAmount - Number(form.bonusUsed))

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }))
  const field = (name) => ({
    value: form[name],
    onChange: (e) => set(name, e.target.value),
  })

  const getUserLocation = () => {
    if (!navigator.geolocation) { setError('Геолокация недоступна в вашем браузере'); return }
    set('geoLoading', true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude, geoLoading: false }))
      },
      () => {
        set('geoLoading', false)
        setError('Не удалось получить геолокацию. Разрешите доступ к местоположению.')
      },
      { timeout: 10000 }
    )
  }

  const goStep2 = () => {
    if (!form.address.trim()) { setError('Введите адрес доставки'); return }
    if (!form.lat || !form.lng) { setError('Укажите точку на карте — это обязательно для курьера'); return }
    if (!form.deliveryTime) { setError('Выберите удобное время доставки'); return }
    if (!form.useOwnPhone && !form.phone.trim()) { setError('Введите номер телефона'); return }
    setError('')
    setStep(2)
  }

  const submitOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const orderData = {
        user_id: user.id,
        recipient_phone: form.useOwnPhone ? user.phone : form.phone,
        address: form.address,
        extra_info: form.extraInfo || null,
        delivery_time: form.deliveryTime || null,
        latitude: form.lat,
        longitude: form.lng,
        return_bottles_count: Number(form.returnCount),
        return_bottles_volume: Number(form.returnVolume) || 0,
        bonus_used: Number(form.bonusUsed),
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      }
      const order = await createOrder(orderData)
      setCreatedOrder(order)
      setStep(3)
    } catch {
      setError('Ошибка при создании заказа. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async () => {
    setLoading(true)
    setError('')
    try {
      await paymentConfirmed(createdOrder.id)
      setPaymentDone(true)
      clearCart()
    } catch {
      setError('Ошибка подтверждения оплаты')
    } finally {
      setLoading(false)
    }
  }

  // Успешная оплата
  if (paymentDone) {
    return (
      <div style={styles.success}>
        <div style={{ fontSize: 72 }}>✅</div>
        <h2 style={styles.successTitle}>Оплата подтверждена!</h2>
        <p style={styles.successText}>Ожидайте подтверждения заказа от администратора</p>
        <button style={styles.btn} onClick={() => navigate('/orders')}>Мои заказы</button>
        <button style={styles.secondaryBtn} onClick={() => navigate('/')}>На главную</button>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Map picker modal */}
      {showMap && (
        <MapPicker
          lat={form.lat}
          lng={form.lng}
          onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Stepper */}
      <div style={styles.stepper}>
        {STEPS.map((s, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={s} style={styles.stepWrap}>
              <div style={{ ...styles.stepCircle, ...(done ? styles.stepDone : active ? styles.stepActive : {}) }}>
                {done ? '✓' : n}
              </div>
              <div style={{ ...styles.stepLabel, ...(active ? styles.stepLabelActive : {}) }}>{s}</div>
              {i < STEPS.length - 1 && <div style={{ ...styles.stepLine, ...(done ? styles.stepLineDone : {}) }} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Delivery */}
      {step === 1 && (
        <div style={styles.section}>
          <div style={styles.fieldGroup}>
            <div style={styles.label}>Номер телефона</div>
            <div style={styles.radioRow}>
              <label style={styles.radio}>
                <input type="radio" checked={form.useOwnPhone}
                  onChange={() => set('useOwnPhone', true)} />
                <span>Мой номер {user?.phone ? `(${user.phone})` : ''}</span>
              </label>
              <label style={styles.radio}>
                <input type="radio" checked={!form.useOwnPhone}
                  onChange={() => set('useOwnPhone', false)} />
                <span>Другой номер</span>
              </label>
            </div>
            {!form.useOwnPhone && (
              <input style={styles.input} placeholder="+998 90 123-45-67" type="tel" {...field('phone')} />
            )}
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.label}>Адрес доставки <span style={styles.req}>*</span></div>
            <input style={styles.input} placeholder="ул. Примерная, д. 1, кв. 10" {...field('address')} />
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.label}>Подъезд, этаж, ориентир</div>
            <input style={styles.input} placeholder="Подъезд 2, этаж 5, домофон 10#" {...field('extraInfo')} />
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.label}>Удобное время доставки <span style={styles.req}>*</span></div>
            <div style={styles.timeGrid}>
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  style={{ ...styles.timeBtn, ...(form.deliveryTime === slot ? styles.timeBtnActive : {}) }}
                  onClick={() => set('deliveryTime', slot)}
                  type="button"
                >
                  {slot}
                </button>
              ))}
            </div>
            <input
              style={{ ...styles.input, marginTop: 8 }}
              placeholder="Или введите своё время..."
              value={form.deliveryTime}
              onChange={e => set('deliveryTime', e.target.value)}
            />
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.label}>
              Местоположение <span style={styles.req}>*</span>
              <span style={{ color: '#888', fontWeight: 400, fontSize: 12, marginLeft: 4 }}>
                (обязательно для курьера)
              </span>
            </div>

            {form.lat ? (
              <div style={styles.geoDone}>
                <span>✅ Точка выбрана ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})</span>
                <button style={styles.resetGeo} onClick={() => setForm(f => ({ ...f, lat: null, lng: null }))} type="button">✕</button>
              </div>
            ) : null}

            <div style={styles.geoButtons}>
              <button
                style={{ ...styles.geoBtn, flex: 1 }}
                onClick={getUserLocation}
                type="button"
                disabled={form.geoLoading}
              >
                {form.geoLoading ? '⏳ Определяем...' : '📍 Авто'}
              </button>
              <button
                style={{ ...styles.geoBtn, flex: 2, borderColor: '#2d6a4f' }}
                onClick={() => setShowMap(true)}
                type="button"
              >
                🗺️ Выбрать на карте
              </button>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.primaryBtn} onClick={goStep2}>Далее →</button>
        </div>
      )}

      {/* Step 2: Bottle return & summary */}
      {step === 2 && (
        <div style={styles.section}>
          <div style={styles.fieldGroup}>
            <div style={styles.label}>Возврат пустых бутылок</div>
            <div style={styles.bottleRow}>
              <div style={styles.bottleField}>
                <div style={styles.sublabel}>Количество</div>
                <div style={styles.counter}>
                  <button style={styles.cb} onClick={() => set('returnCount', Math.max(0, Number(form.returnCount) - 1))}>−</button>
                  <span style={styles.cval}>{form.returnCount}</span>
                  <button style={styles.cb} onClick={() => set('returnCount', Number(form.returnCount) + 1)}>+</button>
                </div>
              </div>
              <div style={styles.bottleField}>
                <div style={styles.sublabel}>Объём (л)</div>
                <input
                  style={{ ...styles.input, textAlign: 'center' }}
                  type="number" min="0" step="0.1"
                  placeholder="18.9"
                  value={form.returnVolume}
                  onChange={e => set('returnVolume', e.target.value)}
                />
              </div>
            </div>
            {bottleDiscountAmount > 0 && (
              <div style={styles.discountHint}>
                🎉 Скидка за возврат: −{bottleDiscountAmount} сум
              </div>
            )}
          </div>

          {bonusMax > 0 && (
            <div style={styles.fieldGroup}>
              <div style={styles.label}>Бонусные баллы (доступно: {user?.bonus_points || 0})</div>
              <input
                style={styles.input}
                type="number" min="0" max={bonusMax}
                placeholder={`Списать до ${bonusMax} сум`}
                value={form.bonusUsed}
                onChange={e => set('bonusUsed', Math.min(bonusMax, Math.max(0, +e.target.value)))}
              />
            </div>
          )}

          <div style={styles.summaryBox}>
            <div style={styles.summaryTitle}>Итог заказа</div>
            {items.map(({ product, quantity }) => (
              <div key={product.id} style={styles.summaryRow}>
                <span>{product.name} × {quantity}</span>
                <span>{product.price * quantity} сум</span>
              </div>
            ))}
            <div style={styles.summaryDivider} />
            <div style={styles.summaryRow}>
              <span>Товары</span><span>{subtotal} сум</span>
            </div>
            {bottleDiscountAmount > 0 && (
              <div style={{ ...styles.summaryRow, color: '#4caf50' }}>
                <span>Скидка за бутылки ({form.returnCount} шт.)</span>
                <span>−{bottleDiscountAmount} сум</span>
              </div>
            )}
            {Number(form.bonusUsed) > 0 && (
              <div style={{ ...styles.summaryRow, color: '#f57c00' }}>
                <span>Бонусы</span><span>−{form.bonusUsed} сум</span>
              </div>
            )}
            <div style={styles.summaryDivider} />
            <div style={{ ...styles.summaryRow, fontWeight: 800, fontSize: 18 }}>
              <span>Итого к оплате</span><span style={{ color: 'var(--tg-theme-button-color, #2481cc)' }}>{finalTotal} сум</span>
            </div>
          </div>

          <div style={styles.deliveryInfo}>
            <div style={styles.infoRow}><b>📍</b> {form.address}</div>
            {form.extraInfo && <div style={styles.infoRow}><b>🏠</b> {form.extraInfo}</div>}
            <div style={styles.infoRow}><b>🕐</b> {form.deliveryTime}</div>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.btnRow}>
            <button style={styles.backBtn} onClick={() => setStep(1)}>← Назад</button>
            <button style={{ ...styles.primaryBtn, flex: 2 }} onClick={submitOrder} disabled={loading}>
              {loading ? 'Создаём заказ...' : 'Перейти к оплате →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 3 && createdOrder && (
        <div style={styles.section}>
          <div style={styles.paymentCard}>
            <div style={styles.payIcon}>💳</div>
            <div style={styles.payLabel}>Переведите на карту</div>
            <div style={styles.payCardNum}>{settings.payment_card || '0000 0000 0000 0000'}</div>
            <div style={styles.payHolder}>{settings.payment_holder || 'Иванов Иван'}</div>
            <div style={styles.payAmount}>{createdOrder.total} сум</div>
            <button
              style={styles.copyBtn}
              onClick={() => {
                navigator.clipboard?.writeText(createdOrder.total.toString())
                tg?.showPopup({ message: 'Сумма скопирована!' })
              }}
            >
              📋 Скопировать сумму
            </button>
          </div>

          <div style={styles.payInfo}>
            <div style={styles.payInfoRow}>📦 Заказ #{createdOrder.id}</div>
            <div style={styles.payInfoRow}>📍 {createdOrder.address}</div>
          </div>

          <p style={styles.payHint}>
            После перевода нажмите «Я оплатил». Администратор проверит оплату вручную.
          </p>

          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.primaryBtn} onClick={confirmPayment} disabled={loading}>
            {loading ? 'Отправляем...' : '✅ Я оплатил'}
          </button>
        </div>
      )}
    </div>
  )
}

const C = 'var(--tg-theme-button-color, #2481cc)'
const BG = 'var(--tg-theme-secondary-bg-color, #f5f5f5)'
const HINT = 'var(--tg-theme-hint-color, #ddd)'

const styles = {
  page: { padding: '0 0 120px', maxWidth: 520, margin: '0 auto' },
  stepper: {
    display: 'flex', alignItems: 'center', padding: '16px 24px',
    background: BG, marginBottom: 8,
  },
  stepWrap: { display: 'flex', alignItems: 'center', flex: 1, position: 'relative' },
  stepCircle: {
    width: 28, height: 28, borderRadius: '50%', border: `2px solid ${HINT}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#999', flexShrink: 0, zIndex: 1,
    background: 'var(--tg-theme-bg-color, #fff)',
  },
  stepActive: { borderColor: C, color: C },
  stepDone: { borderColor: '#4caf50', background: '#4caf50', color: '#fff' },
  stepLabel: { fontSize: 11, color: '#999', marginLeft: 4, whiteSpace: 'nowrap' },
  stepLabelActive: { color: C, fontWeight: 600 },
  stepLine: { flex: 1, height: 2, background: HINT, margin: '0 6px' },
  stepLineDone: { background: '#4caf50' },
  section: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontWeight: 600, fontSize: 14, color: 'var(--tg-theme-text-color, #000)' },
  sublabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  req: { color: '#e53935' },
  input: {
    border: `1px solid ${HINT}`, borderRadius: 10, padding: '11px 14px',
    fontSize: 15, background: BG, color: 'var(--tg-theme-text-color, #000)',
    outline: 'none', width: '100%',
  },
  radioRow: { display: 'flex', gap: 20 },
  radio: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' },
  timeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  timeBtn: {
    padding: '9px 6px', borderRadius: 10, border: `1px solid ${HINT}`,
    fontSize: 12, background: BG, cursor: 'pointer', textAlign: 'center',
    color: 'var(--tg-theme-text-color, #333)',
  },
  timeBtnActive: { borderColor: C, background: C, color: '#fff' },
  geoBtn: {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: `2px dashed ${HINT}`, background: BG,
    fontSize: 14, cursor: 'pointer', textAlign: 'center', fontWeight: 500,
    color: 'var(--tg-theme-text-color, #333)',
  },
  geoBtnDone: { borderColor: '#4caf50', borderStyle: 'solid', color: '#2e7d32' },
  resetGeo: {
    background: 'none', border: 'none', color: '#e53935',
    fontSize: 12, cursor: 'pointer', textAlign: 'center', padding: '4px 0',
  },
  bottleRow: { display: 'flex', gap: 12 },
  bottleField: { flex: 1 },
  counter: { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' },
  cb: {
    width: 36, height: 36, borderRadius: 8, border: 'none',
    background: C, color: '#fff', fontSize: 20, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cval: { fontWeight: 700, fontSize: 20, minWidth: 30, textAlign: 'center' },
  discountHint: {
    background: '#e8f5e9', borderRadius: 8, padding: '8px 12px',
    fontSize: 13, color: '#2e7d32', fontWeight: 500,
  },
  summaryBox: {
    background: BG, borderRadius: 14, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  summaryTitle: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14 },
  summaryDivider: { height: 1, background: HINT, margin: '4px 0' },
  deliveryInfo: {
    background: BG, borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  infoRow: { fontSize: 13, color: '#555' },
  primaryBtn: {
    background: C, color: '#fff',
    border: 'none', borderRadius: 14, padding: '14px 0',
    fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%',
  },
  secondaryBtn: {
    background: BG, color: 'var(--tg-theme-text-color, #333)',
    border: 'none', borderRadius: 14, padding: '14px 0',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  backBtn: {
    flex: 1, background: BG, border: 'none', borderRadius: 14, padding: '14px 0',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    color: 'var(--tg-theme-text-color, #333)',
  },
  btnRow: { display: 'flex', gap: 10 },
  paymentCard: {
    background: BG, borderRadius: 16, padding: '24px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  payIcon: { fontSize: 48 },
  payLabel: { color: '#888', fontSize: 14 },
  payCardNum: { fontWeight: 700, fontSize: 22, letterSpacing: 2 },
  payHolder: { color: '#888', fontSize: 14 },
  payAmount: { fontWeight: 800, fontSize: 36, color: C, marginTop: 4 },
  copyBtn: {
    marginTop: 4, background: 'none', border: `1px solid ${C}`,
    borderRadius: 8, padding: '6px 14px', color: C,
    fontSize: 13, cursor: 'pointer',
  },
  payInfo: {
    background: BG, borderRadius: 12, padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  payInfoRow: { fontSize: 14, color: '#555' },
  payHint: { fontSize: 13, color: '#888', lineHeight: 1.5 },
  error: { color: '#e53935', fontSize: 13 },
  success: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, minHeight: '70vh', padding: '0 24px',
    textAlign: 'center',
  },
  successTitle: { fontSize: 24, fontWeight: 700 },
  successText: { color: '#888', fontSize: 15, lineHeight: 1.5 },
  geoDone: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#e8f5e9', borderRadius: 10, padding: '8px 12px',
    fontSize: 13, color: '#2d6a4f', fontWeight: 500,
  },
  geoButtons: { display: 'flex', gap: 8 },
}
