import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierOrders, courierAccept, courierInDelivery, courierDelivered } from '../../api'
import { useAuthStore } from '../../store/auth'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const STATUS_CFG = {
  confirmed:           { label: 'Новый',         bg: '#FFF3BF', color: '#E67700' },
  assigned_to_courier: { label: 'Назначен',      bg: `${C}15`,  color: CD },
  in_delivery:         { label: 'В пути',        bg: '#E7F5FF', color: '#1971C2' },
  delivered:           { label: 'Доставлен',     bg: '#EBFBEE', color: '#2B8A3E' },
}

function OrderCard({ order, onAction, actionLoading }) {
  const [open, setOpen] = useState(false)
  const st = STATUS_CFG[order.status] || { label: order.status, bg: '#F2F2F7', color: TEXT2 }
  const isActive = ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(order.status)
  const deliveryInfo = [order.delivery_date, order.delivery_period].filter(Boolean).join(' · ')

  return (
    <div style={{
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      opacity: order.status === 'delivered' ? 0.7 : 1,
      borderLeft: order.status === 'in_delivery' ? '3px solid #1971C2' : order.status === 'assigned_to_courier' ? `3px solid ${C}` : 'none',
    }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>#{order.id}</span>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            {order.client_name && <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginTop: 4 }}>{order.client_name}</div>}
            {order.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.address}</div>}
            {deliveryInfo && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{deliveryInfo}</div>}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: CD, fontWeight: 600 }}>
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

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FFF0', borderRadius: 14, padding: '13px 14px', border: `1px solid rgba(141,198,63,0.2)` }}>
            <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>Получить от клиента</span>
            <span style={{ fontWeight: 900, fontSize: 22, color: C }}>{(order.total || 0).toLocaleString()} сум</span>
          </div>

          {/* Contact client */}
          <div style={{ display: 'flex', gap: 8 }}>
            {order.recipient_phone && (
              <a href={`tel:${order.recipient_phone}`} style={s.contactBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
                Позвонить
              </a>
            )}
            {order.client_telegram_id && (
              <a href={`tg://user?id=${order.client_telegram_id}`} style={s.contactBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                Написать
              </a>
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
                <button style={s.btnPrimary} disabled={actionLoading} onClick={() => onAction(courierInDelivery, order.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/><path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Выехал
                </button>
              )}
              {order.status === 'in_delivery' && (
                <button style={s.btnSuccess} disabled={actionLoading} onClick={() => onAction(courierDelivered, order.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Доставлено
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CourierOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('active')
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

  // Auto-refresh every 30s
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

  const active = orders.filter(o => ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))
  const done = orders.filter(o => o.status === 'delivered')
  const shown = filter === 'active' ? active : done

  // Sort: in_delivery first, then assigned, then confirmed
  const sorted = shown.slice().sort((a, b) => {
    const priority = { in_delivery: 0, assigned_to_courier: 1, confirmed: 2, delivered: 3 }
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9)
  })

  return (
    <CourierLayout title="Заказы">

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { key: 'active', label: 'Активные', count: active.length },
          { key: 'done', label: 'Выполненные', count: done.length },
        ].map(f => {
          const isActive = filter === f.key
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: isActive ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
              color: isActive ? '#fff' : TEXT2,
              border: isActive ? 'none' : `1.5px solid ${C}40`,
              boxShadow: isActive ? '0 4px 12px rgba(141,198,63,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              {f.label}
              {f.count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, borderRadius: 999,
                  padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  background: isActive ? 'rgba(255,255,255,0.3)' : '#F2F2F7',
                  color: isActive ? '#fff' : TEXT2,
                }}>{f.count}</span>
              )}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT2, flexShrink: 0 }} onClick={load} disabled={loading}>
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
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>
            {filter === 'active' ? 'Нет активных заказов' : 'Нет выполненных заказов'}
          </div>
          <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>
            {filter === 'active' ? 'Ожидайте назначения от менеджера' : 'Выполненные заказы появятся здесь'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(order => (
            <OrderCard key={order.id} order={order} onAction={doAction} actionLoading={actionLoading} />
          ))}
        </div>
      )}
    </CourierLayout>
  )
}

const s = {
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
  btnSuccess: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', border: 'none',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)',
    WebkitTapHighlightColor: 'transparent',
  },
}
