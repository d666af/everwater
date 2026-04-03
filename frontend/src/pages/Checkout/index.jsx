import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../../store'
import { createOrder, getUserByTelegram, paymentConfirmed, getSettings } from '../../api'
import MapPicker from '../../components/MapPicker'
import { useAuthStore } from '../../store/auth'
import { useUserStore } from '../../store/user'
import { useOrdersStore } from '../../store/orders'

import s, { C, GRAD } from './styles'
import SavedAddresses from './SavedAddresses'
import DateTimePicker from './DateTimePicker'
import BottleReturn from './BottleReturn'
import SaveAddressPopup from './SaveAddressPopup'
import CardPayment from './CardPayment'
import SuccessScreen from './SuccessScreen'

const tg = window.Telegram?.WebApp

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
    bottle_return_buttons_visible: true, bottle_return_mode: 'max',
  })
  const [form, setForm] = useState({
    phone: '', address: '', extraInfo: '',
    lat: null, lng: null, geoLoading: false,
    returnCount: 0, bonusUsed: 0,
    paymentMethod: 'balance',
    deliveryDate: '', deliveryTime: '',
  })
  const [selectedAddrId, setSelectedAddrId] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [showSaveAddr, setShowSaveAddr] = useState(false)
  const [createdOrder, setCreatedOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
    getSettings().then(s => setSettings(prev => ({ ...prev, ...s }))).catch(console.error)
  }, [authUser]) // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // 20L items in cart
  const has20L = items.some(i => i.product.volume >= 18.9)
  const qty20L = items.filter(i => i.product.volume >= 18.9).reduce((sum, i) => sum + i.quantity, 0)

  // Bottle return limit
  const bottlesOwed = userStore.bottles_owed
  const maxReturn = settings.bottle_return_mode === 'equal' ? qty20L : bottlesOwed

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

  const isBalancePayment = form.paymentMethod === 'balance'
  const afterBonus = Math.max(0, afterBottle - Number(form.bonusUsed))
  const balanceUsed = isBalancePayment ? Math.min(availableBalance, afterBonus) : 0
  const finalTotal = Math.max(0, afterBonus - balanceUsed)
  const cardRemainder = isBalancePayment && finalTotal > 0 ? finalTotal : 0

  // Saved addresses
  const savedAddresses = userStore.saved_addresses

  const selectSavedAddress = (addr) => {
    setSelectedAddrId(addr.id)
    setForm(f => ({
      ...f,
      address: addr.address,
      extraInfo: addr.extraInfo || '',
      lat: addr.lat || null,
      lng: addr.lng || null,
    }))
  }

  const requestLocation = () => {
    if (!navigator.geolocation) { setError('Геолокация недоступна'); return }
    set('geoLoading', true); setError('')
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude, geoLoading: false })),
      () => { set('geoLoading', false); setError('Разрешите доступ к местоположению') },
      { timeout: 10000 }
    )
  }

  const buildDeliveryTime = () => {
    if (!form.deliveryDate || !form.deliveryTime) return null
    const timeLabel = form.deliveryTime === 'morning' ? '9:00–13:00' : '13:00–18:00'
    return `${form.deliveryDate} ${timeLabel}`
  }

  const submitOrder = async () => {
    if (!form.address.trim()) return setError('Укажите адрес доставки')
    if (!form.deliveryDate) return setError('Выберите дату доставки')
    if (!form.deliveryTime) return setError('Выберите время доставки')
    setLoading(true); setError('')
    try {
      const order = await createOrder({
        user_id: user?.id,
        recipient_phone: form.phone || user?.phone,
        address: form.address,
        extra_info: form.extraInfo || null,
        delivery_time: buildDeliveryTime(),
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

      // Track bottles: add ordered 20L, subtract returned
      if (qty20L > 0) userStore.addBottlesOwed(qty20L)
      if (Number(form.returnCount) > 0) userStore.returnBottles(Number(form.returnCount))

      if (form.paymentMethod === 'cash') {
        await paymentConfirmed(order.id)
        finishOrder(order)
      } else if (form.paymentMethod === 'balance' && cardRemainder === 0) {
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
      total: finalTotal, address: form.address,
      delivery_time: buildDeliveryTime(),
      recipient_phone: form.phone || user?.phone, status: 'awaiting_confirmation',
    }
    addOrder(fullOrder)
    if (Number(form.bonusUsed)) userStore.deductBonus(Number(form.bonusUsed))
    if (balanceUsed > 0) userStore.deductBalance(balanceUsed)
    userStore.incrementOrders()
    clearCart()

    // Check if address is already saved
    const alreadySaved = savedAddresses.some(a => a.address === form.address)
    if (form.address.trim() && !alreadySaved) {
      setShowSaveAddr(true)
    } else {
      setSuccess(true)
    }
  }

  const handleSaveAddress = () => {
    userStore.addSavedAddress({
      label: form.address.split(',')[0].trim(),
      address: form.address,
      extraInfo: form.extraInfo,
      lat: form.lat,
      lng: form.lng,
    })
    setShowSaveAddr(false)
    setSuccess(true)
  }

  // ── Save Address Popup ──
  if (showSaveAddr) return (
    <SaveAddressPopup
      address={form.address.split(',')[0]}
      onSave={handleSaveAddress}
      onSkip={() => { setShowSaveAddr(false); setSuccess(true) }}
    />
  )

  // ── Success ──
  if (success) return (
    <SuccessScreen
      onOrders={() => navigate('/orders')}
      onCatalog={() => navigate('/')}
    />
  )

  // ── Card Payment ──
  const needCardPayment = createdOrder && (form.paymentMethod === 'card' || cardRemainder > 0)
  if (needCardPayment) return (
    <CardPayment
      settings={settings}
      amount={cardRemainder > 0 ? cardRemainder : finalTotal}
      balanceUsed={balanceUsed}
      cardRemainder={cardRemainder}
      onConfirm={confirmCardPayment}
      loading={loading}
      error={error}
    />
  )

  // ── Main Form ──
  return (
    <div style={s.page}>
      {showMap && (
        <MapPicker
          lat={form.lat} lng={form.lng}
          onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Header: Back + Title */}
      <div style={s.pageHeader}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <div style={s.pageTitle}>Оформление заказа</div>
        <div style={{ width: 70 }} />
      </div>

      {/* Order summary */}
      <div style={{ ...s.section, marginTop: 12 }}>
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
          {/* Saved addresses */}
          <SavedAddresses
            addresses={savedAddresses}
            selectedId={selectedAddrId}
            onSelect={selectSavedAddress}
          />

          <input
            style={s.input}
            placeholder="Адрес: улица, дом, квартира"
            value={form.address}
            onChange={e => { set('address', e.target.value); setSelectedAddrId(null) }}
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

      {/* Date & Time */}
      <DateTimePicker
        selectedDate={form.deliveryDate}
        selectedTime={form.deliveryTime}
        onDateChange={v => set('deliveryDate', v)}
        onTimeChange={v => set('deliveryTime', v)}
      />

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
      {has20L && bottlesOwed > 0 && (
        <BottleReturn
          returnCount={Number(form.returnCount)}
          onCountChange={v => set('returnCount', v)}
          bottleDiscount={bottleDiscount}
          bottlesOwed={maxReturn}
          settings={settings}
        />
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

      {/* Payment */}
      <div style={s.section}>
        <div style={s.sLabel}>Способ оплаты</div>
        <div style={s.card}>
          {PAYMENT_METHODS.map(m => {
            const isBalance = m.key === 'balance'
            const isSelected = form.paymentMethod === m.key
            return (
              <button key={m.key}
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
                    <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 3 }}>Пополните баланс в профиле</div>
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
