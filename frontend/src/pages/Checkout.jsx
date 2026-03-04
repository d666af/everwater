import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { createOrder, getUserByTelegram, paymentConfirmed } from '../api'

const tg = window.Telegram?.WebApp

const DISCOUNT_PER_BOTTLE = 50  // руб за бутылку

export default function Checkout() {
  const { items, total, clearCart } = useCartStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1=address, 2=bottles, 3=payment
  const [form, setForm] = useState({
    phone: tg?.initDataUnsafe?.user?.id ? '' : '',
    useOwnPhone: true,
    address: '',
    extraInfo: '',
    deliveryTime: '',
    lat: null,
    lng: null,
    returnCount: 0,
    returnVolume: 0,
    bonusUsed: 0,
  })
  const [createdOrder, setCreatedOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subtotal = total()
  const bottleDiscount = form.returnCount * DISCOUNT_PER_BOTTLE
  const finalTotal = Math.max(0, subtotal - bottleDiscount - form.bonusUsed)

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm(f => ({ ...f, [name]: e.target.value })),
  })

  const getUserLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })),
      () => alert('Не удалось получить геолокацию. Введите адрес вручную.'),
    )
  }

  const submitOrder = async () => {
    if (!form.address.trim()) { setError('Введите адрес доставки'); return }
    setLoading(true)
    setError('')
    try {
      const tgUser = tg?.initDataUnsafe?.user
      const user = await getUserByTelegram(tgUser?.id)
      const orderData = {
        user_id: user.id,
        recipient_phone: form.useOwnPhone ? user.phone : form.phone,
        address: form.address,
        extra_info: form.extraInfo || null,
        delivery_time: form.deliveryTime || null,
        latitude: form.lat,
        longitude: form.lng,
        return_bottles_count: Number(form.returnCount),
        return_bottles_volume: Number(form.returnVolume),
        bonus_used: Number(form.bonusUsed),
        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      }
      const order = await createOrder(orderData)
      setCreatedOrder(order)
      setStep(3)
    } catch (e) {
      setError('Ошибка при создании заказа. Попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async () => {
    setLoading(true)
    try {
      await paymentConfirmed(createdOrder.id)
      clearCart()
      tg?.showAlert('Оплата подтверждена! Ожидайте подтверждения заказа.', () => {
        tg?.close()
      })
    } catch {
      setError('Ошибка подтверждения оплаты')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Step 1: Address */}
      {step === 1 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Данные доставки</h2>

          <label style={styles.label}>Номер телефона</label>
          <div style={styles.radioGroup}>
            <label>
              <input type="radio" checked={form.useOwnPhone}
                onChange={() => setForm(f => ({ ...f, useOwnPhone: true }))} /> Использовать мой
            </label>
            <label>
              <input type="radio" checked={!form.useOwnPhone}
                onChange={() => setForm(f => ({ ...f, useOwnPhone: false }))} /> Указать другой
            </label>
          </div>
          {!form.useOwnPhone && (
            <input style={styles.input} placeholder="+7 999 999-99-99" type="tel" {...field('phone')} />
          )}

          <label style={styles.label}>Адрес доставки *</label>
          <input style={styles.input} placeholder="ул. Примерная, д. 1" {...field('address')} />

          <label style={styles.label}>Подъезд, этаж, ориентир</label>
          <input style={styles.input} placeholder="Подъезд 2, этаж 5" {...field('extraInfo')} />

          <label style={styles.label}>Удобное время доставки</label>
          <input style={styles.input} placeholder="Сегодня с 14:00 до 18:00" {...field('deliveryTime')} />

          <label style={styles.label}>Геолокация</label>
          <button style={styles.secondaryBtn} onClick={getUserLocation} type="button">
            📍 {form.lat ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : 'Указать точку на карте'}
          </button>

          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.btn} onClick={() => setStep(2)}>Далее</button>
        </div>
      )}

      {/* Step 2: Bottles & Summary */}
      {step === 2 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Возврат бутылок</h2>

          <label style={styles.label}>Количество возвращаемых бутылок</label>
          <input style={styles.input} type="number" min="0"
            value={form.returnCount}
            onChange={e => setForm(f => ({ ...f, returnCount: +e.target.value }))} />

          <label style={styles.label}>Объём бутылок (л)</label>
          <input style={styles.input} type="number" min="0" step="0.1"
            value={form.returnVolume}
            onChange={e => setForm(f => ({ ...f, returnVolume: +e.target.value }))} />

          <div style={styles.summaryBox}>
            <div style={styles.summaryRow}><span>Товары</span><span>{subtotal} ₽</span></div>
            <div style={styles.summaryRow}><span>Скидка за бутылки</span><span>−{bottleDiscount} ₽</span></div>
            <div style={styles.summaryRow}><span>Бонусов списано</span><span>−{form.bonusUsed} ₽</span></div>
            <div style={{ ...styles.summaryRow, fontWeight: 700, fontSize: 18 }}>
              <span>Итого</span><span>{finalTotal} ₽</span>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.btn} onClick={submitOrder} disabled={loading}>
            {loading ? 'Создаём заказ...' : 'Перейти к оплате'}
          </button>
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 3 && createdOrder && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Оплата</h2>

          <div style={styles.paymentBox}>
            <div style={styles.payLabel}>Переведите на карту:</div>
            <div style={styles.card}>0000 0000 0000 0000</div>
            <div style={styles.payLabel}>Получатель: Иванов Иван</div>
            <div style={styles.amount}>{createdOrder.total} ₽</div>
          </div>

          <p style={{ color: '#888', fontSize: 14, margin: '16px 0' }}>
            После перевода нажмите кнопку ниже. Администратор подтвердит оплату вручную.
          </p>

          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.btn} onClick={confirmPayment} disabled={loading}>
            {loading ? 'Отправляем...' : '✅ Я оплатил'}
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: 16, maxWidth: 480, margin: '0 auto' },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  label: { fontWeight: 600, fontSize: 14, marginTop: 4 },
  input: {
    border: '1px solid var(--tg-theme-hint-color, #ddd)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: 15, background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    color: 'var(--tg-theme-text-color, #000)', outline: 'none', width: '100%',
  },
  radioGroup: { display: 'flex', gap: 24, fontSize: 15 },
  btn: {
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: 'var(--tg-theme-button-text-color, #fff)',
    border: 'none', borderRadius: 12, padding: '14px 0',
    fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8,
  },
  secondaryBtn: {
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    border: '1px solid var(--tg-theme-hint-color, #ddd)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: 14, cursor: 'pointer', textAlign: 'left',
  },
  summaryBox: {
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 15 },
  paymentBox: {
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 12, padding: 20, textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payLabel: { color: '#888', fontSize: 14 },
  card: { fontWeight: 700, fontSize: 20, letterSpacing: 2 },
  amount: {
    fontWeight: 700, fontSize: 32,
    color: 'var(--tg-theme-button-color, #2481cc)',
  },
  error: { color: 'red', fontSize: 14 },
}
