import { useEffect, useState, useRef } from 'react'
import { courierCreateOrder, lookupClientByPhone, getProducts } from '../../api'
import { useAuthStore } from '../../store/auth'
import MapPicker from '../../components/MapPicker'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

function CLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{children}</div>
}

function CChip({ label, value, accent = CD }) {
  return (
    <div style={{ background: '#F2F2F7', borderRadius: 8, padding: '4px 10px', display: 'flex', gap: 5, alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: TEXT2 }}>{label}:</span>
      <span style={{ fontWeight: 700, color: accent }}>{value}</span>
    </div>
  )
}

function CStepper({ value, onDec, onInc, onChange, min = 0, max = Infinity }) {
  const canDec = value > min
  const canInc = value < max
  const handleInput = (e) => {
    const v = parseInt(e.target.value.replace(/\D/g, ''))
    const clamped = Math.max(min, Math.min(max === Infinity ? (isNaN(v) ? 0 : v) : max, isNaN(v) ? 0 : v))
    onChange?.(clamped)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={canDec ? onDec : undefined} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${canDec ? C : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: canDec ? C : TEXT2, cursor: canDec ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={value} onChange={handleInput}
        style={{ width: 44, textAlign: 'center', fontSize: 16, fontWeight: 800, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '4px 0', color: TEXT, background: '#fff', fontFamily: 'inherit', outline: 'none' }} />
      <button onClick={canInc ? onInc : undefined} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${canInc ? C : BORDER}`, background: canInc ? `${C}15` : '#F2F2F7', fontSize: 16, fontWeight: 700, color: canInc ? CD : TEXT2, cursor: canInc ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  )
}

function SuccessScreen({ orderTotal, onNewOrder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${C}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17L4 12" stroke={C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>Заказ создан!</div>
      <div style={{ fontSize: 15, color: TEXT2 }}>
        Сумма: <strong style={{ color: CD }}>{Number(orderTotal).toLocaleString()} сум</strong>
      </div>
      <button onClick={onNewOrder} style={{ marginTop: 8, padding: '14px 32px', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.35)' }}>
        Новый заказ
      </button>
    </div>
  )
}

export default function AgentCheckout() {
  const { user } = useAuthStore()
  const agentId = user?.agent_id
  const telegramId = tg?.initDataUnsafe?.user?.id || user?.telegram_id

  const [phone, setPhone] = useState('')
  const [client, setClient] = useState(null)
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [address, setAddress] = useState('')
  const [extraInfo, setExtraInfo] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState({})
  const [returnBottles, setReturnBottles] = useState(0)
  const [lentBottles, setLentBottles] = useState(0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lastTotal, setLastTotal] = useState(0)
  const debounceRef = useRef(null)

  const refreshProducts = useRef(() => {})
  refreshProducts.current = () =>
    getProducts().then(p => setProducts((p || []).filter(x => x.is_active !== false))).catch(() => {})

  useEffect(() => {
    tg?.ready?.()
    tg?.expand?.()
    refreshProducts.current()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProducts.current() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const handlePhoneChange = (val) => {
    setPhone(val)
    setClient(null)
    setNotFound(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const digits = val.replace(/\D/g, '')
    if (digits.length >= 9) {
      debounceRef.current = setTimeout(async () => {
        setLooking(true)
        try {
          const result = await lookupClientByPhone(val)
          setClient(result)
          const firstAddr = result?.order_addresses?.[0] || result?.addresses?.[0]
          if (firstAddr) {
            setAddress(firstAddr.address || '')
            setExtraInfo(firstAddr.extra_info || '')
            setLat(firstAddr.lat || null)
            setLng(firstAddr.lng || null)
          }
        } catch {
          setClient(null)
          setNotFound(true)
        } finally {
          setLooking(false)
        }
      }, 500)
    }
  }

  const add = (id) => setSelected(p => ({ ...p, [id]: (p[id] || 0) + 1 }))
  const rem = (id) => setSelected(p => {
    const n = { ...p }
    if (n[id] > 1) n[id]--; else delete n[id]
    return n
  })

  const deposit19L = products.filter(p => p.has_bottle_deposit)
  const qty19L = deposit19L.reduce((s, p) => s + (selected[p.id] || 0), 0)
  useEffect(() => { setReturnBottles(qty19L) }, [qty19L])

  const availReturn = client?.available_bottles ?? 0
  const surchargePerBottle = deposit19L.find(p => p.bottle_surcharge > 0)?.bottle_surcharge || 0
  const maxLent = Math.max(0, qty19L - returnBottles)
  const missingBottles = Math.max(0, qty19L - returnBottles - lentBottles)
  const bottleSurcharge = missingBottles > 0 ? missingBottles * surchargePerBottle : 0
  const subtotal = Object.entries(selected).reduce((sum, [id, qty]) => {
    const p = products.find(p => p.id === Number(id))
    return sum + (p ? p.price * qty : 0)
  }, 0)
  const grandTotal = subtotal + bottleSurcharge
  const items = Object.entries(selected).filter(([, qty]) => qty > 0).map(([id, qty]) => {
    const p = products.find(p => p.id === Number(id))
    return p ? { product_id: p.id, quantity: qty, price: p.price } : null
  }).filter(Boolean)

  const phoneDigits = phone.replace(/\D/g, '')
  const canSave = phoneDigits.length >= 9 && address.trim() && (items.length > 0 || returnBottles > 0)
  const allAddresses = client?.order_addresses?.length
    ? client.order_addresses
    : (client?.addresses || []).map(a => ({ address: a.address, extra_info: '', lat: null, lng: null }))

  const handleReset = () => {
    setPhone(''); setClient(null); setNotFound(false)
    setAddress(''); setExtraInfo(''); setLat(null); setLng(null)
    setSelected({}); setReturnBottles(0); setLentBottles(0); setSuccess(false)
    refreshProducts.current()
  }

  const handle = async () => {
    if (!canSave) return
    setLoading(true)
    try {
      await courierCreateOrder({
        phone: phone.trim(),
        address: address.trim(),
        note: extraInfo.trim() || null,
        total: grandTotal,
        items,
        return_bottles_count: returnBottles,
        bottles_lent: lentBottles,
        bottle_surcharge: bottleSurcharge,
        latitude: lat,
        longitude: lng,
        creator_role: 'agent',
        agent_id: agentId,
      })
      setLastTotal(grandTotal)
      setSuccess(true)
    } catch {
      alert('Ошибка при создании заказа')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#e4e4e8', display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ background: '#e4e4e8', padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 800, color: TEXT }}>Оформление заказа</div>
        </div>
        <SuccessScreen orderTotal={lastTotal} onNewOrder={handleReset} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#e4e4e8', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: '#e4e4e8', padding: '16px 20px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 800, color: TEXT }}>Оформление заказа</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Phone */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CLabel>Телефон клиента</CLabel>
          <div style={{ position: 'relative' }}>
            <input
              style={{ width: '100%', border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, boxSizing: 'border-box', paddingRight: looking ? 44 : undefined }}
              placeholder="+998 90 123-45-67" value={phone}
              onChange={e => handlePhoneChange(e.target.value)} inputMode="tel"
            />
            {looking && <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', border: `2px solid rgba(141,198,63,0.25)`, borderTop: `2px solid ${C}`, animation: 'spin 0.7s linear infinite' }} />}
          </div>
          {client && (
            <div style={{ background: '#F8FFED', borderRadius: 14, border: `1px solid ${C}33`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{client.name || client.order_addresses?.[0]?.address || 'Клиент'}</div>
                <div style={{ fontSize: 12, color: TEXT2 }}>{client.phone}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <CChip label="Доставок" value={client.order_count ?? 0} />
                {client.bottles_owed > 0 && <CChip label="Долг бутылок" value={client.available_bottles ?? client.bottles_owed} accent="#E03131" />}
              </div>
            </div>
          )}
          {notFound && phoneDigits.length >= 9 && (
            <div style={{ fontSize: 12, color: TEXT2, padding: '6px 10px', background: '#F8F9FA', borderRadius: 10 }}>
              Клиент не найден — заказ сохранится по номеру телефона
            </div>
          )}
        </div>

        {(client || notFound) && <>

        {/* Address */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CLabel>Адрес доставки</CLabel>
          {allAddresses.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {allAddresses.map((a, i) => {
                const active = address === a.address
                return (
                  <button key={i} onClick={() => { setAddress(a.address); setExtraInfo(a.extra_info || ''); setLat(a.lat || null); setLng(a.lng || null) }}
                    style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: active ? `${C}18` : '#F2F2F7', color: active ? CD : TEXT2, border: active ? `1.5px solid ${C}` : '1.5px solid transparent', maxWidth: 200, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.address}{a.extra_info && <span style={{ opacity: 0.65 }}> · {a.extra_info}</span>}
                  </button>
                )
              })}
            </div>
          )}
          <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' }}
            placeholder="Улица, дом, квартира" value={address}
            onChange={e => { setAddress(e.target.value); setLat(null); setLng(null) }} />
          <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' }}
            placeholder="Ориентир (необязательно)" value={extraInfo}
            onChange={e => setExtraInfo(e.target.value)} />

          {/* Map point — optional. For new addresses or saved ones without coords. */}
          {address.trim() && <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowMap(true)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: lat && lng ? `1.5px solid ${C}` : `1.5px solid ${BORDER}`,
                background: lat && lng ? `${C}14` : '#FAFAFA',
                color: lat && lng ? CD : TEXT2,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              {lat && lng ? 'Точка на карте указана — изменить' : 'Указать точку на карте'}
            </button>
            {lat && lng && (
              <button
                type="button"
                onClick={() => { setLat(null); setLng(null) }}
                title="Убрать точку"
                style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: 12, cursor: 'pointer',
                  border: '1.5px solid rgba(224,49,49,0.25)', background: '#FFF5F5', color: '#E03131',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: TEXT2 }}>Необязательно</div>
          </>}
        </div>

        {showMap && (
          <MapPicker
            lat={lat}
            lng={lng}
            onChange={(la, ln) => { setLat(la); setLng(ln) }}
            onClose={() => setShowMap(false)}
          />
        )}

        {/* Products */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CLabel>Состав заказа</CLabel>
          {products.length === 0 ? (
            <div style={{ color: TEXT2, fontSize: 13, padding: 8 }}>Загрузка...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#FAFAFA', borderRadius: 14, border: `1.5px solid ${BORDER}`, overflow: 'hidden' }}>
              {products.map((p, i) => {
                const qty = selected[p.id] || 0
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < products.length - 1 ? `1px solid ${BORDER}` : 'none', background: qty > 0 ? `${C}07` : 'transparent' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: TEXT2 }}>{Number(p.price).toLocaleString()} сум</div>
                    </div>
                    {qty > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: CD, whiteSpace: 'nowrap' }}>{(p.price * qty).toLocaleString()} сум</div>}
                    <CStepper value={qty} onDec={() => rem(p.id)} onInc={() => add(p.id)}
                      onChange={v => setSelected(prev => v === 0 ? (({ [p.id]: _, ...rest }) => rest)(prev) : { ...prev, [p.id]: v })} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottle return */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CLabel>Возврат бутылок 19л</CLabel>
            {client && availReturn > 0 && <span style={{ fontSize: 11, color: TEXT2 }}>Долг: {availReturn} шт.</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CStepper value={returnBottles} onDec={() => setReturnBottles(Math.max(0, returnBottles - 1))} onInc={() => setReturnBottles(returnBottles + 1)} onChange={v => setReturnBottles(v)} />
            {qty19L > 0 && <span style={{ fontSize: 13, color: TEXT2 }}>из {qty19L} заказанных</span>}
          </div>
          {missingBottles > 0 && surchargePerBottle > 0 && (
            <div style={{ fontSize: 12, color: '#E03131', background: '#FFF0F0', borderRadius: 8, padding: '6px 10px', fontWeight: 600 }}>
              {missingBottles} бут. не возвращается — надбавка +{Number(bottleSurcharge).toLocaleString()} сум
            </div>
          )}
        </div>

        {/* Lent bottles */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#E67700', textTransform: 'uppercase', letterSpacing: 0.4 }}>Одолжить бутылки</div>
          <CStepper value={lentBottles}
            onDec={() => setLentBottles(Math.max(0, lentBottles - 1))}
            onInc={() => setLentBottles(lentBottles + 1)}
            onChange={v => setLentBottles(Math.max(0, v))} />
          {lentBottles > 0 && <span style={{ fontSize: 12, color: '#E67700' }}>клиент вернёт позже, без надбавки</span>}
        </div>

        {/* Total */}
        {(items.length > 0 || bottleSurcharge > 0) && (
          <div style={{ background: '#F8FFED', borderRadius: 14, padding: '14px 16px', border: `1px solid ${C}33`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT2 }}>
              <span>Товары</span><span>{Number(subtotal).toLocaleString()} сум</span>
            </div>
            {bottleSurcharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#E03131' }}>
                <span>Надбавка за бутылки</span><span>+{Number(bottleSurcharge).toLocaleString()} сум</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: TEXT, borderTop: `1px solid ${C}22`, paddingTop: 6, marginTop: 2 }}>
              <span>Итого</span><span style={{ color: CD }}>{Number(grandTotal).toLocaleString()} сум</span>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          style={{ padding: '16px', borderRadius: 14, border: 'none', background: canSave ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: '#fff', fontSize: 16, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', boxShadow: canSave ? '0 4px 16px rgba(141,198,63,0.35)' : 'none', opacity: loading ? 0.7 : 1 }}
          disabled={!canSave || loading} onClick={handle}
        >
          {loading ? 'Создаю...' : `Создать заказ${grandTotal > 0 ? ` · ${Number(grandTotal).toLocaleString()} сум` : ''}`}
        </button>

        </>}
      </div>
    </div>
  )
}
