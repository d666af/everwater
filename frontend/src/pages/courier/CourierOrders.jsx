import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierOrders, courierAccept, courierInDelivery, courierDelivered, courierCreateOrder, lookupClientByPhone, getProducts } from '../../api'
import { useAuthStore } from '../../store/auth'
import PhonePopup from '../../components/PhonePopup'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const STATUS_CFG = {
  confirmed:           { label: 'Новый',    bg: '#FFF3BF', color: '#E67700' },
  assigned_to_courier: { label: 'Назначен', bg: `${C}15`,  color: CD },
  in_delivery:         { label: 'В пути',   bg: '#E7F5FF', color: '#1971C2' },
  delivered:           { label: 'Доставлен', bg: '#EBFBEE', color: '#2B8A3E' },
}

const FILTERS = [
  { key: 'waiting', label: 'Ожидают' },
  { key: 'enroute', label: 'В пути' },
  { key: 'done',    label: 'Доставлено' },
  { key: 'all',     label: 'Все' },
]

/* ── Urgency: parse delivery_period end time, check if today & approaching ── */
function parseEndHour(period) {
  if (!period) return null
  const m = period.match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/)
  if (!m) return null
  return { h: parseInt(m[3]), m: parseInt(m[4]) }
}

function getUrgency(order) {
  // Only for orders not yet in delivery
  if (order.status === 'in_delivery' || order.status === 'delivered') return 'none'
  if (!order.delivery_date || !/сегодня/i.test(order.delivery_date)) return 'none'
  const end = parseEndHour(order.delivery_period)
  if (!end) return 'none'
  const now = new Date()
  const endMin = end.h * 60 + end.m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const diff = endMin - nowMin
  if (diff <= 0) return 'overdue'    // past deadline
  if (diff <= 60) return 'urgent'    // less than 1 hour
  if (diff <= 120) return 'warning'  // less than 2 hours
  return 'none'
}

/* ── Phone icon SVG ── */
const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
)

/* ── OrderCard ───────────────────────────────────────────────────────────────── */
function OrderCard({ order, onAction, onDeliverCash, actionLoading }) {
  const [open, setOpen] = useState(false)
  const [cashConfirm, setCashConfirm] = useState(false)
  const [phoneModal, setPhoneModal] = useState(null)
  const st = STATUS_CFG[order.status] || { label: order.status, bg: '#F2F2F7', color: TEXT2 }
  const isActive = ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(order.status)
  const deliveryInfo = [order.delivery_date, order.delivery_period].filter(Boolean).join(' · ')
  const urgency = getUrgency(order)
  const isCash = order.payment_method === 'cash'

  const urgencyBorder = urgency === 'overdue'
    ? '2px solid #E03131'
    : urgency === 'urgent'
      ? '2px solid #E67700'
      : urgency === 'warning'
        ? '2px solid #FFD43B'
        : 'none'

  const urgencyShadow = urgency === 'overdue'
    ? '0 0 0 3px rgba(224,49,49,0.15), 0 2px 12px rgba(224,49,49,0.2)'
    : urgency === 'urgent'
      ? '0 0 0 3px rgba(230,119,0,0.12), 0 2px 12px rgba(230,119,0,0.15)'
      : '0 1px 4px rgba(0,0,0,0.04)'

  return (
    <div style={{
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      border: urgencyBorder,
      boxShadow: urgencyShadow,
      opacity: order.status === 'delivered' ? 0.7 : 1,
      borderLeft: urgency !== 'none' ? undefined
        : order.status === 'in_delivery' ? '3px solid #1971C2'
        : order.status === 'assigned_to_courier' ? `3px solid ${C}`
        : 'none',
      animation: urgency === 'overdue' ? 'urgencyPulse 1.5s ease-in-out infinite' : urgency === 'urgent' ? 'urgencyPulse 2.5s ease-in-out infinite' : 'none',
    }}>

      {/* Urgency strip */}
      {urgency !== 'none' && (
        <div style={{
          padding: '7px 14px', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
          background: urgency === 'overdue' ? 'linear-gradient(90deg, #E03131, #C92A2A)' : urgency === 'urgent' ? 'linear-gradient(90deg, #E67700, #D9480F)' : '#FFF3BF',
          color: urgency === 'warning' ? '#E67700' : '#fff',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: urgency === 'warning' ? '#E67700' : '#fff',
            boxShadow: `0 0 0 3px ${urgency === 'warning' ? 'rgba(230,119,0,0.3)' : 'rgba(255,255,255,0.3)'}`,
            animation: 'pulse 1.5s infinite',
          }} />
          {urgency === 'overdue' ? 'Время доставки вышло!' : urgency === 'urgent' ? 'Срочно — менее 1 часа!' : 'Скоро истечёт время доставки'}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '14px 16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            {order.client_name && <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginTop: 4 }}>{order.client_name}</div>}
            {order.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.address}</div>}
            {deliveryInfo && (
              <div style={{ fontSize: 12, marginTop: 2, color: urgency === 'overdue' ? '#E03131' : urgency === 'urgent' ? '#E67700' : TEXT2, fontWeight: urgency !== 'none' ? 700 : 400 }}>
                {deliveryInfo}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 6, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Delivery info */}
          {order.address && (
            <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Доставка</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}>{order.address}</div>
              {order.extra_info && <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.3 }}>{order.extra_info}</div>}
              {deliveryInfo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: urgency !== 'none' ? '#E03131' : CD, fontWeight: 600 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  {deliveryInfo}
                </div>
              )}
              {order.latitude && (
                <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, background: '#111827', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
                  Открыть на карте
                </a>
              )}
            </div>
          )}

          {/* Items */}
          {order.items?.length > 0 && (
            <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Доставить</div>
              {order.items.map((item, idx) => (
                <div key={item.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: TEXT, fontWeight: 500 }}>{item.product_name}</span>
                  <span style={{ fontWeight: 700, color: TEXT2 }}>x{item.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Return bottles */}
          {order.return_bottles_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#E6FCF5', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(18,184,134,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#0A7A5C" strokeWidth="1.8" strokeLinecap="round"/><path d="M3 3v5h5" stroke="#0A7A5C" strokeWidth="1.8" strokeLinecap="round"/></svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0A7A5C' }}>Забрать пустые бутылки</div>
                <div style={{ fontSize: 13, color: '#12B886' }}>{order.return_bottles_count} шт.</div>
              </div>
            </div>
          )}

          {/* Total — only for cash */}
          {isCash && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FFF0', borderRadius: 14, padding: '13px 14px', border: `1px solid rgba(141,198,63,0.2)` }}>
              <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>Получить от клиента</span>
              <span style={{ fontWeight: 900, fontSize: 22, color: C }}>{(order.total || 0).toLocaleString()} сум</span>
            </div>
          )}

          {/* Call buttons: client + manager */}
          {phoneModal && <PhonePopup number={phoneModal.number} label={phoneModal.label} onClose={() => setPhoneModal(null)} />}
          <div style={{ display: 'flex', gap: 8 }}>
            {order.recipient_phone && (
              <button onClick={() => setPhoneModal({ number: order.recipient_phone, label: 'Телефон клиента' })} style={s.contactBtn}>
                <PhoneIcon />
                Клиенту
              </button>
            )}
            {order.manager_phone && (
              <button onClick={() => setPhoneModal({ number: order.manager_phone, label: 'Телефон менеджера' })} style={s.contactBtn}>
                <PhoneIcon />
                Менеджеру
              </button>
            )}
          </div>

          {/* Action buttons */}
          {isActive && (
            <div style={{ display: 'flex', gap: 8 }}>
              {order.status === 'confirmed' && (
                <button style={s.btnAccent} disabled={actionLoading} onClick={() => onAction(courierAccept, order.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Принял заказ
                </button>
              )}
              {order.status === 'assigned_to_courier' && (
                <button style={urgency !== 'none' ? s.btnUrgent : s.btnPrimary} disabled={actionLoading} onClick={() => onAction(courierInDelivery, order.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/><path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Выехал
                </button>
              )}
              {order.status === 'in_delivery' && !cashConfirm && (
                <button style={s.btnSuccess} disabled={actionLoading} onClick={() => {
                  if (isCash) setCashConfirm(true)
                  else onAction(courierDelivered, order.id)
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Доставлено
                </button>
              )}
              {cashConfirm && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: '#FFF8E6', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#E67700', textAlign: 'center' }}>
                    Вы получили {(order.total || 0).toLocaleString()} сум наличными?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.btnSuccess} disabled={actionLoading} onClick={() => { onDeliverCash(order.id, true); setCashConfirm(false) }}>
                      Да, получил
                    </button>
                    <button style={{ ...s.btnAccent, flex: 1, background: '#FFF5F5', color: '#E03131', border: '1.5px solid rgba(224,49,49,0.2)' }} disabled={actionLoading} onClick={() => { onDeliverCash(order.id, false); setCashConfirm(false) }}>
                      Нет
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Create Order Modal ──────────────────────────────────────────────────────── */
function CreateOrderModal({ onClose, onSave, courierId }) {
  const [phone, setPhone] = useState('')
  const [client, setClient] = useState(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [looked, setLooked] = useState(false)
  const [address, setAddress] = useState('')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState({}) // { productId: qty }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getProducts().then(p => setProducts(p || [])).catch(() => {})
  }, [])

  const doLookup = async () => {
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 9) { setClient(null); setLooked(false); return }
    setLookingUp(true)
    try {
      const result = await lookupClientByPhone(phone)
      setClient(result)
      if (result?.addresses?.[0]?.address) setAddress(result.addresses[0].address)
    } catch { setClient(null) }
    finally { setLookingUp(false); setLooked(true) }
  }

  const add = (id) => setSelected(p => ({ ...p, [id]: (p[id] || 0) + 1 }))
  const rem = (id) => setSelected(p => {
    const n = { ...p }
    if (n[id] > 1) n[id]--; else delete n[id]
    return n
  })

  const total = Object.entries(selected).reduce((sum, [id, qty]) => {
    const p = products.find(p => p.id === Number(id))
    return sum + (p ? p.price * qty : 0)
  }, 0)

  const items = Object.entries(selected)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = products.find(p => p.id === Number(id))
      return p ? { product_id: p.id, quantity: qty, price: p.price } : null
    }).filter(Boolean)

  const canSave = phone.trim() && address.trim() && items.length > 0

  const handle = async () => {
    if (!canSave) return
    setLoading(true)
    try {
      await onSave({
        phone: phone.trim(),
        address: address.trim(),
        total,
        items,
        courier_id: courierId,
        user_id: client?.id || null,
      })
      onClose()
    } catch (e) {
      alert('Ошибка при создании заказа')
    }
    finally { setLoading(false) }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...s.sheet, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={s.sheetHandle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Новый заказ</div>

        {/* Phone lookup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Телефон клиента</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...s.inp, flex: 1 }} placeholder="+998 90 123-45-67" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
            <button style={{ padding: '0 16px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }} onClick={doLookup} disabled={lookingUp}>
              {lookingUp ? '...' : 'Найти'}
            </button>
          </div>

          {/* Client info */}
          {looked && client && (
            <div style={{ background: '#EBFBEE', borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2B8A3E' }}>{client.name}</div>
              {client.bottles_owed > 0 && (
                <div style={{ fontSize: 12, color: '#E03131', fontWeight: 600 }}>Долг: {client.bottles_owed} бутылок (20л)</div>
              )}
            </div>
          )}
          {looked && !client && (
            <div style={{ fontSize: 12, color: TEXT2, fontStyle: 'italic' }}>Клиент не найден — заказ сохранится по номеру</div>
          )}
        </div>

        {/* Address */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Адрес доставки</div>
          {client?.addresses?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {client.addresses.map(a => (
                <button key={a.id} onClick={() => setAddress(a.address)} style={{
                  padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: address === a.address ? `${C}15` : '#F8F9FA',
                  color: address === a.address ? CD : TEXT2,
                  border: address === a.address ? `1px solid ${C}` : `1px solid ${BORDER}`,
                }}>{a.label || a.address?.split(',')[0] || a.address}</button>
              ))}
            </div>
          )}
          <input style={s.inp} placeholder="Улица, дом, квартира" value={address} onChange={e => setAddress(e.target.value)} />
        </div>

        {/* Product selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Состав заказа</div>
          {products.length === 0 ? (
            <div style={{ color: TEXT2, fontSize: 13, padding: 8 }}>Загрузка...</div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {products.map(p => {
                const qty = selected[p.id] || 0
                return (
                  <div key={p.id} style={{
                    borderRadius: 12, border: qty ? `1.5px solid ${C}` : `1.5px solid #e5e5ea`,
                    background: qty ? `${C}06` : '#fff', padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{p.name}{p.volume ? ` (${p.volume}л)` : ''}</span>
                      <span style={{ fontSize: 12, color: TEXT2, marginRight: 8 }}>{p.price.toLocaleString()} сум</span>
                      {qty === 0 ? (
                        <button style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C}`, background: `${C}15`, fontSize: 18, fontWeight: 700, color: CD, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => add(p.id)}>+</button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C}`, background: '#fff', fontSize: 14, fontWeight: 700, color: C, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => rem(p.id)}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 800, minWidth: 20, textAlign: 'center', color: TEXT }}>{qty}</span>
                          <button style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C}`, background: '#fff', fontSize: 14, fontWeight: 700, color: C, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => add(p.id)}>+</button>
                        </div>
                      )}
                    </div>
                    {qty > 0 && <div style={{ fontSize: 12, color: CD, fontWeight: 700, marginTop: 4, textAlign: 'right' }}>{(p.price * qty).toLocaleString()} сум</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Total + payment info */}
        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FFF0', borderRadius: 12, padding: '12px 14px', border: `1px solid rgba(141,198,63,0.2)` }}>
            <span style={{ fontSize: 13, color: TEXT2 }}>Итого (наличные)</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: C }}>{total.toLocaleString()} сум</span>
          </div>
        )}

        <button style={{ ...s.btnSuccess, ...(canSave ? {} : { opacity: 0.45, cursor: 'not-allowed' }) }} disabled={!canSave || loading} onClick={handle}>
          {loading ? 'Создаю...' : `Создать заказ · ${total.toLocaleString()} сум`}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────────── */
export default function CourierOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const { user } = useAuthStore()

  const courierId = tg?.initDataUnsafe?.user?.id || user?.telegram_id || user?.id

  const load = useCallback(() => {
    if (!courierId) { setLoading(false); return }
    setLoading(true)
    getCourierOrders(courierId)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [courierId])

  useEffect(load, [load])

  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const doAction = async (fn, orderId) => {
    setActionLoading(true)
    try { await fn(orderId); load() }
    catch { alert('Ошибка операции') }
    finally { setActionLoading(false) }
  }

  const doDeliverCash = async (orderId, cashCollected) => {
    setActionLoading(true)
    try { await courierDelivered(orderId, cashCollected); load() }
    catch { alert('Ошибка операции') }
    finally { setActionLoading(false) }
  }

  const handleCreateOrder = async (data) => {
    await courierCreateOrder(data)
    load()
  }

  const waiting = orders.filter(o => ['confirmed', 'assigned_to_courier'].includes(o.status))
  const enroute = orders.filter(o => o.status === 'in_delivery')
  const done = orders.filter(o => o.status === 'delivered')
  const counts = { waiting: waiting.length, enroute: enroute.length, done: done.length, all: orders.length }

  const shown = filter === 'waiting' ? waiting : filter === 'enroute' ? enroute : filter === 'done' ? done : orders

  // Sort: urgent first
  const sorted = shown.slice().sort((a, b) => {
    const urgA = getUrgency(a) === 'overdue' ? 0 : getUrgency(a) === 'urgent' ? 1 : getUrgency(a) === 'warning' ? 2 : 3
    const urgB = getUrgency(b) === 'overdue' ? 0 : getUrgency(b) === 'urgent' ? 1 : getUrgency(b) === 'warning' ? 2 : 3
    if (urgA !== urgB) return urgA - urgB
    const pri = { in_delivery: 0, assigned_to_courier: 1, confirmed: 2, delivered: 3 }
    return (pri[a.status] ?? 9) - (pri[b.status] ?? 9)
  })

  const urgentWaiting = waiting.filter(o => getUrgency(o) !== 'none').length

  const emptyMsg = {
    waiting: { title: 'Нет ожидающих заказов', hint: 'Ожидайте назначения от менеджера' },
    enroute: { title: 'Нет заказов в пути', hint: 'Нажмите "Выехал" чтобы начать доставку' },
    done:    { title: 'Нет доставленных', hint: 'Выполненные заказы появятся здесь' },
    all:     { title: 'Нет заказов', hint: 'Создайте заказ или ожидайте назначения' },
  }[filter]

  return (
    <CourierLayout title="Заказы">
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onSave={handleCreateOrder} courierId={courierId} />}

      {/* CSS for urgency pulse animation */}
      <style>{`
        @keyframes urgencyPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(224,49,49,0); }
          50% { box-shadow: 0 0 0 6px rgba(224,49,49,0.12); }
        }
      `}</style>

      {/* Create order button */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '11px 14px', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)', WebkitTapHighlightColor: 'transparent',
        marginBottom: 12,
      }} onClick={() => setShowCreate(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        Создать заказ
      </button>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          const count = counts[f.key] || 0
          const hasUrgent = f.key === 'waiting' && urgentWaiting > 0
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '10px 4px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: active ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
              color: active ? '#fff' : TEXT2,
              border: active ? 'none' : `1.5px solid ${C}40`,
              boxShadow: active ? '0 4px 12px rgba(141,198,63,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
              WebkitTapHighlightColor: 'transparent', position: 'relative',
            }}>
              {f.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, borderRadius: 999,
                  padding: '1px 5px', minWidth: 16, textAlign: 'center',
                  background: active ? 'rgba(255,255,255,0.3)' : hasUrgent ? '#E03131' : '#F2F2F7',
                  color: active ? '#fff' : hasUrgent ? '#fff' : TEXT2,
                }}>{count}</span>
              )}
            </button>
          )
        })}
        <button style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT2, flexShrink: 0 }} onClick={load} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 10 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
            <rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M7 9h10M7 13h6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>{emptyMsg.title}</div>
          <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>{emptyMsg.hint}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(order => (
            <OrderCard key={order.id} order={order} onAction={doAction} onDeliverCash={doDeliverCash} actionLoading={actionLoading} />
          ))}
        </div>
      )}
    </CourierLayout>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  sheetHandle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  inp: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 15, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  contactBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
  },
  btnAccent: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    background: '#F3F0FF', color: '#6741D9', border: '1.5px solid rgba(103,65,217,0.2)',
    WebkitTapHighlightColor: 'transparent',
  },
  btnPrimary: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    background: '#111827', color: '#fff', border: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  btnUrgent: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    background: 'linear-gradient(135deg, #E03131, #C92A2A)', color: '#fff', border: 'none',
    boxShadow: '0 4px 14px rgba(224,49,49,0.3)',
    WebkitTapHighlightColor: 'transparent',
  },
  btnSuccess: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', border: 'none',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)',
    WebkitTapHighlightColor: 'transparent',
  },
}
