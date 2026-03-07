import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { createOrder, getUserByTelegram, paymentConfirmed, getSettings } from '../api'
import MapPicker from '../components/MapPicker'
import { useAuthStore } from '../store/auth'

const tg = window.Telegram?.WebApp

const TIME_SLOTS = [
  { label: 'Сег. 9–12', value: 'Сегодня 9:00–12:00', icon: '🌅' },
  { label: 'Сег. 12–15', value: 'Сегодня 12:00–15:00', icon: '☀️' },
  { label: 'Сег. 15–18', value: 'Сегодня 15:00–18:00', icon: '🌤' },
  { label: 'Сег. 18–21', value: 'Сегодня 18:00–21:00', icon: '🌇' },
  { label: 'Завт. 9–12', value: 'Завтра 9:00–12:00', icon: '🌅' },
  { label: 'Завт. 12–15', value: 'Завтра 12:00–15:00', icon: '☀️' },
  { label: 'Завт. 15–18', value: 'Завтра 15:00–18:00', icon: '🌤' },
  { label: 'Завт. 18–21', value: 'Завтра 18:00–21:00', icon: '🌇' },
]

const STEPS = [
  { label: 'Доставка', icon: '📍' },
  { label: 'Скидки', icon: '🎁' },
  { label: 'Оплата', icon: '💳' },
]

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
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 800 }}>{n}</span>
              )}
            </div>
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? P : done ? PD : '#AAA',
              marginTop: 4, whiteSpace: 'nowrap',
            }}>{st.label}</span>
            {i < STEPS.length - 1 && (
              <div style={{ ...s.stepConnector, ...(done ? s.stepConnectorDone : {}) }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ ...s.card, ...style }}>{children}</div>
}

function SectionLabel({ children, required }) {
  return (
    <div style={s.sectionLabel}>
      {children}
      {required && <span style={s.req}>*</span>}
    </div>
  )
}

function Input({ label, required, ...props }) {
  return (
    <div style={s.inputGroup}>
      {label && <SectionLabel required={required}>{label}</SectionLabel>}
      <input style={s.input} {...props} />
    </div>
  )
}

export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const navigate = useNavigate()
  const { user: authUser } = useAuthStore()

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
    }
    getSettings().then(setSettings).catch(console.error)
  }, [authUser])

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }))

  const bottleDiscountAmount = (() => {
    const count = Number(form.returnCount)
    if (!count) return 0
    if (settings.bottle_discount_type === 'percent') {
      return Math.round(total() * (settings.bottle_discount_value / 100))
    }
    return count * Number(settings.bottle_discount_value)
  })()

  const bonusMax = Math.min(user?.bonus_points || 0, total() - bottleDiscountAmount)
  const subtotal = total()
  const finalTotal = Math.max(0, subtotal - bottleDiscountAmount - Number(form.bonusUsed))

  const getUserLocation = () => {
    if (!navigator.geolocation) { setError('Геолокация недоступна в браузере'); return }
    set('geoLoading', true); setError('')
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude, geoLoading: false })),
      () => { set('geoLoading', false); setError('Разрешите доступ к местоположению') },
      { timeout: 10000 }
    )
  }

  const goStep2 = () => {
    if (!form.address.trim()) return setError('Введите адрес доставки')
    if (!form.lat || !form.lng) return setError('Укажите точку на карте — обязательно для курьера')
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
        bonus_used: Number(form.bonusUsed),
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
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

  // ─── Success screen ───────────────────────────────────
  if (paymentDone) return (
    <div style={s.successPage}>
      <div style={s.successRing}>
        <div style={s.successIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <h2 style={s.successTitle}>Заказ оплачен!</h2>
      <p style={s.successDesc}>Ожидайте подтверждения от администратора. Мы пришлём уведомление.</p>
      <button style={s.primaryBtn} onClick={() => navigate('/orders')}>Отслеживать заказ →</button>
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

      {/* Step bar */}
      <StepBar step={step} />

      {/* ─── STEP 1: Delivery info ─── */}
      {step === 1 && (
        <div style={s.content}>
          {/* Cart mini summary */}
          <Card>
            <div style={s.cartSummaryTitle}>Ваш заказ</div>
            <div style={s.cartItems}>
              {items.map(({ product, quantity }) => (
                <div key={product.id} style={s.cartRow}>
                  <div style={s.cartRowLeft}>
                    <div style={s.cartQtyBadge}>{quantity}</div>
                    <span style={s.cartItemName}>{product.name}</span>
                  </div>
                  <span style={s.cartItemPrice}>{(product.price * quantity).toLocaleString()} сум</span>
                </div>
              ))}
            </div>
            <div style={s.cartTotal}>
              <span style={s.cartTotalLabel}>Итого</span>
              <span style={s.cartTotalAmt}>{subtotal.toLocaleString()} сум</span>
            </div>
          </Card>

          {/* Phone */}
          <Card>
            <SectionLabel>Телефон для связи</SectionLabel>
            <div style={s.phoneToggle}>
              <button
                style={{ ...s.phoneOption, ...(form.useOwnPhone ? s.phoneOptionActive : {}) }}
                onClick={() => set('useOwnPhone', true)}
              >
                <div style={s.phoneOptionIcon}>👤</div>
                <div>
                  <div style={s.phoneOptionLabel}>Мой номер</div>
                  <div style={s.phoneOptionVal}>{user?.phone || '—'}</div>
                </div>
              </button>
              <button
                style={{ ...s.phoneOption, ...(!form.useOwnPhone ? s.phoneOptionActive : {}) }}
                onClick={() => set('useOwnPhone', false)}
              >
                <div style={s.phoneOptionIcon}>✏️</div>
                <div>
                  <div style={s.phoneOptionLabel}>Другой номер</div>
                  <div style={s.phoneOptionVal}>Ввести вручную</div>
                </div>
              </button>
            </div>
            {!form.useOwnPhone && (
              <input
                style={{ ...s.input, marginTop: 10 }}
                type="tel" placeholder="+998 90 123-45-67"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            )}
          </Card>

          {/* Address */}
          <Card>
            <Input
              label="Адрес доставки" required
              placeholder="ул. Примерная, д. 1, кв. 10"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
            <Input
              label="Подъезд, этаж, ориентир"
              placeholder="Подъезд 2, этаж 5"
              value={form.extraInfo}
              onChange={e => set('extraInfo', e.target.value)}
              style={{ marginTop: 10 }}
            />
          </Card>

          {/* Map */}
          <Card>
            <SectionLabel required>Точка на карте</SectionLabel>
            <p style={s.fieldHint}>Курьер использует метку для навигации</p>

            {form.lat ? (
              <div style={s.geoSuccess}>
                <div style={s.geoSuccessLeft}>
                  <div style={s.geoSuccessDot} />
                  <div>
                    <div style={s.geoSuccessLabel}>Точка выбрана</div>
                    <div style={s.geoSuccessCoords}>{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</div>
                  </div>
                </div>
                <button style={s.geoResetBtn} onClick={() => setForm(f => ({ ...f, lat: null, lng: null }))}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#888" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ) : null}

            <div style={s.geoRow}>
              <button style={s.geoAutoBtn} onClick={getUserLocation} disabled={form.geoLoading}>
                {form.geoLoading ? (
                  <span style={s.geoSpinner}>⟳</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" fill="currentColor"/>
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
                {form.geoLoading ? 'Определяем...' : 'Авто'}
              </button>
              <button style={s.geoMapBtn} onClick={() => setShowMap(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7M9 20l6-3M9 20V7m6 13l4.447 2.224A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7M15 20V7M9 7l6-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Выбрать на карте
              </button>
            </div>
          </Card>

          {/* Time */}
          <Card>
            <SectionLabel required>Удобное время доставки</SectionLabel>
            <div style={s.timeGrid}>
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot.value}
                  style={{ ...s.timeChip, ...(form.deliveryTime === slot.value ? s.timeChipActive : {}) }}
                  onClick={() => set('deliveryTime', slot.value)}
                >
                  <span style={{ fontSize: 14 }}>{slot.icon}</span>
                  <span>{slot.label}</span>
                </button>
              ))}
            </div>
            <input
              style={{ ...s.input, marginTop: 10 }}
              placeholder="Или введите своё время..."
              value={form.deliveryTime.includes('Сег') || form.deliveryTime.includes('Завт') ? '' : form.deliveryTime}
              onChange={e => set('deliveryTime', e.target.value)}
            />
          </Card>

          {error && <div style={s.errorBox}>{error}</div>}
          <button style={s.primaryBtn} onClick={goStep2}>
            Далее — Скидки
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ─── STEP 2: Discounts & Summary ─── */}
      {step === 2 && (
        <div style={s.content}>
          {/* Bottle return */}
          <Card>
            <div style={s.cardTitleRow}>
              <span style={s.cardTitleIcon}>♻️</span>
              <div>
                <div style={s.cardTitle}>Возврат пустых бутылок</div>
                <div style={s.cardSubtitle}>Получите скидку за каждую бутылку</div>
              </div>
            </div>

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
                <input
                  style={{ ...s.input, textAlign: 'center' }}
                  type="number" min="0" step="0.5" placeholder="18.9"
                  value={form.returnVolume}
                  onChange={e => set('returnVolume', e.target.value)}
                />
              </div>
            </div>

            {bottleDiscountAmount > 0 && (
              <div style={s.discountBanner}>
                <span style={{ fontSize: 18 }}>🎉</span>
                <div>
                  <div style={s.discountTitle}>Скидка за возврат</div>
                  <div style={s.discountAmt}>−{bottleDiscountAmount.toLocaleString()} сум</div>
                </div>
              </div>
            )}
          </Card>

          {/* Bonuses */}
          {bonusMax > 0 && (
            <Card>
              <div style={s.cardTitleRow}>
                <span style={s.cardTitleIcon}>⭐</span>
                <div>
                  <div style={s.cardTitle}>Бонусные баллы</div>
                  <div style={s.cardSubtitle}>Доступно: {(user?.bonus_points || 0).toLocaleString()} сум</div>
                </div>
              </div>
              <div style={s.bonusRow}>
                <button style={s.bonusMax} onClick={() => set('bonusUsed', bonusMax)}>
                  Списать все ({bonusMax.toLocaleString()})
                </button>
                <input
                  style={{ ...s.input, flex: 1, textAlign: 'right' }}
                  type="number" min="0" max={bonusMax}
                  placeholder="0"
                  value={form.bonusUsed || ''}
                  onChange={e => set('bonusUsed', Math.min(bonusMax, Math.max(0, +e.target.value)))}
                />
              </div>
            </Card>
          )}

          {/* Order summary */}
          <Card style={s.summaryCard}>
            <div style={s.summaryHeader}>Итог заказа</div>
            <div style={s.summaryItems}>
              {items.map(({ product, quantity }) => (
                <div key={product.id} style={s.summaryItemRow}>
                  <span style={s.summaryItemName}>{product.name} × {quantity}</span>
                  <span style={s.summaryItemAmt}>{(product.price * quantity).toLocaleString()} сум</span>
                </div>
              ))}
            </div>
            <div style={s.summaryDivider} />
            <div style={s.summaryPriceRows}>
              <div style={s.priceRow}>
                <span>Товары</span>
                <span>{subtotal.toLocaleString()} сум</span>
              </div>
              {bottleDiscountAmount > 0 && (
                <div style={{ ...s.priceRow, color: '#52B788' }}>
                  <span>Скидка за бутылки</span>
                  <span>−{bottleDiscountAmount.toLocaleString()} сум</span>
                </div>
              )}
              {Number(form.bonusUsed) > 0 && (
                <div style={{ ...s.priceRow, color: '#F0A500' }}>
                  <span>Бонусы</span>
                  <span>−{Number(form.bonusUsed).toLocaleString()} сум</span>
                </div>
              )}
            </div>
            <div style={s.summaryDivider} />
            <div style={s.finalRow}>
              <span style={s.finalLabel}>К оплате</span>
              <span style={s.finalAmt}>{finalTotal.toLocaleString()} сум</span>
            </div>
          </Card>

          {/* Delivery recap */}
          <Card>
            <div style={s.recapGrid}>
              <div style={s.recapItem}>
                <div style={s.recapIcon}>📍</div>
                <div style={s.recapText}>{form.address}</div>
              </div>
              {form.extraInfo && (
                <div style={s.recapItem}>
                  <div style={s.recapIcon}>🏠</div>
                  <div style={s.recapText}>{form.extraInfo}</div>
                </div>
              )}
              <div style={s.recapItem}>
                <div style={s.recapIcon}>🕐</div>
                <div style={s.recapText}>{form.deliveryTime}</div>
              </div>
            </div>
          </Card>

          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.btnRow}>
            <button style={s.backBtn} onClick={() => setStep(1)}>← Назад</button>
            <button style={{ ...s.primaryBtn, flex: 2 }} onClick={submitOrder} disabled={loading}>
              {loading ? (
                <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
              ) : (
                <>К оплате · {finalTotal.toLocaleString()} сум</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Payment ─── */}
      {step === 3 && createdOrder && (
        <div style={s.content}>
          <div style={s.payOrderBadge}>
            Заказ #{createdOrder.id} создан
          </div>

          {/* Payment card */}
          <Card style={s.payCard}>
            <div style={s.payCardHeader}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="3" fill="#8DC63F" opacity="0.15" stroke="#8DC63F" strokeWidth="1.5"/>
                <path d="M2 10h20" stroke="#8DC63F" strokeWidth="1.5"/>
                <rect x="5" y="14" width="4" height="2" rx="1" fill="#8DC63F"/>
              </svg>
              <div style={s.payCardTitle}>Перевод на карту</div>
            </div>
            <div style={s.payCardNumber}>
              {settings.payment_card || '0000 0000 0000 0000'}
            </div>
            <div style={s.payCardHolder}>{settings.payment_holder || '—'}</div>
            <div style={s.payDivider} />
            <div style={s.payAmtLabel}>Сумма к переводу</div>
            <div style={s.payAmt}>{finalTotal.toLocaleString()} <span style={s.payAmtCur}>сум</span></div>
            <button style={{ ...s.copyCardBtn, ...(copied ? s.copyCardBtnCopied : {}) }} onClick={copyCard}>
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  Скопировано!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8"/>
                  </svg>
                  Скопировать номер карты
                </>
              )}
            </button>
          </Card>

          {/* Steps */}
          <Card>
            <div style={s.paySteps}>
              {[
                { n: 1, text: 'Переведите сумму на карту выше', icon: '💳' },
                { n: 2, text: 'Нажмите «Я оплатил» ниже', icon: '✅' },
                { n: 3, text: 'Администратор подтвердит заказ', icon: '📞' },
              ].map(st => (
                <div key={st.n} style={s.payStep}>
                  <div style={s.payStepNum}>{st.n}</div>
                  <span style={s.payStepIcon}>{st.icon}</span>
                  <span style={s.payStepText}>{st.text}</span>
                </div>
              ))}
            </div>
          </Card>

          {error && <div style={s.errorBox}>{error}</div>}
          <button style={s.payConfirmBtn} onClick={confirmPayment} disabled={loading}>
            {loading ? (
              <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
            ) : (
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

const P = '#8DC63F'
const PD = '#6CA32F'

const s = {
  page: { background: '#F5F5F5', minHeight: '100vh', paddingBottom: 32 },
  content: { display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' },
  card: {
    background: '#fff', borderRadius: 16, padding: '16px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #F0F0F0',
    display: 'flex', flexDirection: 'column', gap: 10,
  },

  // Step bar
  stepBar: {
    display: 'flex', padding: '14px 20px 10px',
    background: '#fff', borderBottom: '1px solid #F0F0F0',
    alignItems: 'flex-start',
    position: 'sticky', top: 0, zIndex: 50,
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },
  stepItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flex: 1, position: 'relative',
  },
  stepCircle: {
    width: 30, height: 30, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1, position: 'relative',
  },
  stepPending: { background: '#F0F0F0', color: '#AAA' },
  stepActive: { background: P, color: '#fff', boxShadow: `0 4px 12px rgba(141,198,63,0.4)` },
  stepDone: { background: PD, color: '#fff' },
  stepConnector: {
    position: 'absolute', top: 15, left: '50%', width: '100%', height: 2,
    background: '#E8E8E8', zIndex: 0,
  },
  stepConnectorDone: { background: PD },

  // Cart summary
  cartSummaryTitle: { fontWeight: 700, fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  cartItems: { display: 'flex', flexDirection: 'column', gap: 6 },
  cartRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cartRowLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  cartQtyBadge: {
    width: 22, height: 22, borderRadius: '50%',
    background: P, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 800, flexShrink: 0,
  },
  cartItemName: { fontSize: 13, color: '#333', fontWeight: 500 },
  cartItemPrice: { fontSize: 13, fontWeight: 700, color: '#1A1A1A' },
  cartTotal: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, borderTop: '1px solid #F5F5F5', marginTop: 2,
  },
  cartTotalLabel: { fontSize: 13, fontWeight: 700, color: '#555' },
  cartTotalAmt: { fontSize: 17, fontWeight: 900, color: P },

  // Phone selector
  sectionLabel: { fontSize: 13, fontWeight: 700, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 4 },
  req: { color: '#E53935' },
  phoneToggle: { display: 'flex', gap: 8 },
  phoneOption: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
    border: '2px solid #E8E8E8', background: '#FAFAFA',
    transition: 'all 0.2s',
  },
  phoneOptionActive: { border: `2px solid ${P}`, background: '#F7FCF0' },
  phoneOptionIcon: { fontSize: 20, flexShrink: 0 },
  phoneOptionLabel: { fontSize: 12, fontWeight: 700, color: '#1A1A1A' },
  phoneOptionVal: { fontSize: 11, color: '#888' },

  // Inputs
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  input: {
    border: '2px solid #E8E8E8', borderRadius: 12, padding: '11px 14px',
    fontSize: 15, background: '#FAFAFA', color: '#1A1A1A',
    outline: 'none', width: '100%', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  },
  fieldHint: { fontSize: 12, color: '#888', margin: 0 },

  // Geo
  geoSuccess: {
    background: '#F0FCE4', borderRadius: 10, padding: '10px 12px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    border: '1px solid #D0EBAA',
  },
  geoSuccessLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  geoSuccessDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: P, boxShadow: `0 0 0 3px ${P}30`,
  },
  geoSuccessLabel: { fontSize: 13, fontWeight: 700, color: PD },
  geoSuccessCoords: { fontSize: 11, color: '#888', fontFamily: 'monospace' },
  geoResetBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  geoRow: { display: 'flex', gap: 8 },
  geoAutoBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 12px', borderRadius: 12,
    border: '2px solid #E8E8E8', background: '#FAFAFA',
    fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer',
  },
  geoSpinner: { animation: 'spin 0.8s linear infinite', display: 'inline-block', fontSize: 16 },
  geoMapBtn: {
    flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 12px', borderRadius: 12,
    border: `2px solid ${P}`, background: '#F7FCF0',
    fontSize: 13, fontWeight: 700, color: PD, cursor: 'pointer',
  },

  // Time grid
  timeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
  },
  timeChip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '8px 4px', borderRadius: 10,
    border: '1.5px solid #E8E8E8', background: '#FAFAFA',
    fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#555',
    transition: 'all 0.2s',
  },
  timeChipActive: { border: `1.5px solid ${P}`, background: '#F0FCE4', color: PD },

  // Bottle return (step 2)
  cardTitleRow: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  cardTitleIcon: { fontSize: 24, flexShrink: 0 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#1A1A1A' },
  cardSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  bottleRow: { display: 'flex', gap: 12 },
  bottleCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  bottleLabel: { fontSize: 12, fontWeight: 600, color: '#888' },
  counter: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '4px 0' },
  cBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: P, border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 2px 8px rgba(141,198,63,0.3)`,
  },
  counterVal: { fontWeight: 900, fontSize: 22, minWidth: 28, textAlign: 'center', color: '#1A1A1A' },
  discountBanner: {
    background: '#F0FCE4', borderRadius: 12, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    border: '1px solid #D0EBAA',
  },
  discountTitle: { fontSize: 12, color: PD, fontWeight: 600 },
  discountAmt: { fontSize: 18, fontWeight: 900, color: PD },

  // Bonuses
  bonusRow: { display: 'flex', gap: 8, alignItems: 'center' },
  bonusMax: {
    background: '#F7FCF0', border: `1.5px solid ${P}`,
    borderRadius: 10, padding: '8px 12px',
    fontSize: 12, fontWeight: 700, color: PD, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // Summary
  summaryCard: { background: '#1A1A1A' },
  summaryHeader: { fontSize: 14, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryItems: { display: 'flex', flexDirection: 'column', gap: 6 },
  summaryItemRow: { display: 'flex', justifyContent: 'space-between' },
  summaryItemName: { fontSize: 13, color: '#AAA' },
  summaryItemAmt: { fontSize: 13, color: '#DDD', fontWeight: 600 },
  summaryDivider: { height: 1, background: 'rgba(255,255,255,0.1)' },
  summaryPriceRows: { display: 'flex', flexDirection: 'column', gap: 6 },
  priceRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#888' },
  finalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  finalLabel: { fontSize: 15, fontWeight: 700, color: '#AAA' },
  finalAmt: { fontSize: 24, fontWeight: 900, color: P },

  // Recap
  recapGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  recapItem: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  recapIcon: { fontSize: 16, flexShrink: 0, width: 24, textAlign: 'center' },
  recapText: { fontSize: 13, color: '#555', lineHeight: 1.4 },

  // Buttons
  primaryBtn: {
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '15px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: `0 4px 20px rgba(141,198,63,0.4)`,
    transition: 'transform 0.15s',
  },
  ghostBtn: {
    background: 'none', border: 'none', color: '#888',
    padding: '12px 0', fontSize: 14, cursor: 'pointer',
    textAlign: 'center',
  },
  backBtn: {
    flex: 1, background: '#F5F5F5', border: 'none', borderRadius: 14, padding: '15px 0',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#555',
  },
  btnRow: { display: 'flex', gap: 10 },
  errorBox: {
    background: '#FFF3F3', border: '1px solid #FFCDD2', borderRadius: 12,
    padding: '10px 14px', fontSize: 13, color: '#E53935', fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 6,
  },

  // Payment (step 3)
  payOrderBadge: {
    background: '#F0FCE4', border: `1px solid ${P}40`, borderRadius: 12,
    padding: '10px 14px', fontSize: 13, fontWeight: 700, color: PD,
    textAlign: 'center',
  },
  payCard: {
    background: `linear-gradient(145deg, #111827, #1F2937)`,
    borderRadius: 20, padding: '20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  payCardHeader: { display: 'flex', alignItems: 'center', gap: 10, width: '100%' },
  payCardTitle: { fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' },
  payCardNumber: {
    fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 3,
    fontFamily: 'monospace', textAlign: 'center', padding: '8px 0',
  },
  payCardHolder: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  payDivider: { height: 1, background: 'rgba(255,255,255,0.1)', width: '100%' },
  payAmtLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8 },
  payAmt: { fontSize: 36, fontWeight: 900, color: P, lineHeight: 1 },
  payAmtCur: { fontSize: 18, fontWeight: 400, color: '#AAA' },
  copyCardBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10, padding: '9px 16px',
    fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  copyCardBtnCopied: {
    background: `rgba(141,198,63,0.2)`,
    borderColor: `rgba(141,198,63,0.5)`,
    color: P,
  },
  paySteps: { display: 'flex', flexDirection: 'column', gap: 12 },
  payStep: { display: 'flex', alignItems: 'center', gap: 12 },
  payStepNum: {
    width: 26, height: 26, borderRadius: '50%',
    background: P, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 800, flexShrink: 0,
  },
  payStepIcon: { fontSize: 18, flexShrink: 0 },
  payStepText: { fontSize: 13, color: '#555', fontWeight: 500 },
  payConfirmBtn: {
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '17px 0', fontSize: 18, fontWeight: 800, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: `0 6px 24px rgba(141,198,63,0.45)`,
  },

  // Success
  successPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '90vh', padding: '0 24px', gap: 16,
    textAlign: 'center', background: '#F5F5F5',
  },
  successRing: {
    width: 100, height: 100, borderRadius: '50%',
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 8px 32px rgba(141,198,63,0.4)`,
    animation: 'scaleIn 0.4s ease',
  },
  successIcon: { display: 'flex' },
  successTitle: { fontSize: 28, fontWeight: 900, color: '#1A1A1A', letterSpacing: -0.5 },
  successDesc: { fontSize: 15, color: '#888', lineHeight: 1.6, maxWidth: 300 },
}
