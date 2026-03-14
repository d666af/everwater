import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierOrders, courierAccept, courierInDelivery, courierDelivered } from '../../api'
import { useAuthStore } from '../../store/auth'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

const STATUS = {
  confirmed:           { label: 'Подтверждён',   bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier: { label: 'Назначен вам',  bg: '#F3F0FF', color: '#6741D9' },
  in_delivery:         { label: 'В доставке',    bg: '#E8F4FD', color: '#1971C2' },
  delivered:           { label: 'Доставлен',     bg: '#EBFBEE', color: C },
}

function OrderCard({ order, onAction, actionLoading }) {
  const [open, setOpen] = useState(false)
  const st = STATUS[order.status] || { label: order.status, bg: '#F2F2F7', color: TEXT2 }
  const isActive = ['assigned_to_courier', 'in_delivery', 'confirmed'].includes(order.status)

  return (
    <div style={{ ...s.card, opacity: order.status === 'delivered' ? 0.7 : 1 }}>
      {/* Card header */}
      <div style={s.cardTop} onClick={() => setOpen(o => !o)}>
        <div style={s.cardLeft}>
          <div style={s.orderBadge}>#{order.id}</div>
          <div style={s.cardInfo}>
            <div style={s.cardAddr}>{order.address}</div>
            {order.delivery_time && (
              <div style={s.cardTime}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke={TEXT2} strokeWidth="1.5"/>
                  <path d="M12 7v5l3 3" stroke={TEXT2} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {order.delivery_time}
              </div>
            )}
          </div>
        </div>
        <div style={s.cardRight}>
          <div style={s.cardTotal}>{Number(order.total || 0).toLocaleString()} сум</div>
          <span style={{ ...s.statusBadge, background: st.bg, color: st.color }}>{st.label}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            style={{ marginTop: 4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={s.details}>
          {/* Info rows */}
          <div style={s.infoBlock}>
            {order.recipient_phone && (
              <a href={`tel:${order.recipient_phone}`} style={s.infoRow}>
                <div style={{ ...s.infoIcon, background: '#EDF3FF' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4l1.9-1.9c.2-.2.5-.3.8-.1 1 .4 2.1.6 3.1.6.4 0 .8.3.8.8V19c0 .4-.4.8-.8.8C9.1 19.8 4.2 14.9 4.2 8.8c0-.5.4-.8.8-.8H8c.5 0 .8.4.8.8 0 1.1.2 2.1.6 3.1.1.3 0 .6-.1.8l-1.9 1.9-.6-3.8z" fill="#3B5BDB"/>
                  </svg>
                </div>
                <div>
                  <div style={s.infoLabel}>Телефон клиента</div>
                  <div style={{ ...s.infoVal, color: '#3B5BDB', fontWeight: 700 }}>{order.recipient_phone}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            )}

            <div style={s.infoRow}>
              <div style={{ ...s.infoIcon, background: '#FFF8E6' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#E67700"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.infoLabel}>Адрес доставки</div>
                <div style={s.infoVal}>{order.address}</div>
                {order.extra_info && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{order.extra_info}</div>}
              </div>
            </div>

            {order.latitude && order.longitude && (
              <a
                href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                target="_blank" rel="noopener noreferrer"
                style={s.mapBtn}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7M9 20l6-3M9 20V7m6 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7M9 7l6-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Открыть на карте
              </a>
            )}
          </div>

          {/* Items */}
          {order.items?.length > 0 && (
            <div style={s.itemsBlock}>
              <div style={s.blockLabel}>Доставить</div>
              {order.items.map((item, idx) => (
                <div key={item.id ?? idx} style={s.itemRow}>
                  <div style={s.itemDot} />
                  <span style={{ flex: 1, fontSize: 14, color: TEXT }}>{item.product_name}</span>
                  <span style={s.itemQty}>× {item.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottles */}
          {order.return_bottles_count > 0 && (
            <div style={s.bottleBlock}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M3 3v5h5" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0A7A5C' }}>Забрать бутылки</div>
                <div style={{ fontSize: 13, color: '#12B886' }}>
                  {order.return_bottles_count} шт.
                  {order.return_bottles_volume ? ` · ${order.return_bottles_volume} л` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Total */}
          <div style={s.totalRow}>
            <span style={{ fontSize: 14, color: TEXT2, fontWeight: 500 }}>К получению от клиента</span>
            <span style={s.totalVal}>{Number(order.total || 0).toLocaleString()} сум</span>
          </div>

          {/* Action buttons */}
          {isActive && (
            <div style={s.actions}>
              {order.status === 'assigned_to_courier' && (
                <>
                  <button
                    style={{ ...s.actionBtn, background: '#EDF3FF', color: '#3B5BDB', border: '1.5px solid rgba(59,91,219,0.2)' }}
                    disabled={actionLoading}
                    onClick={() => onAction(courierAccept, order.id)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Принял
                  </button>
                  <button
                    style={{ ...s.actionBtn, background: '#111827', color: '#fff', border: 'none', flex: 1.5 }}
                    disabled={actionLoading}
                    onClick={() => onAction(courierInDelivery, order.id)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <circle cx="5" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/>
                      <circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/>
                      <path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Выехал
                  </button>
                </>
              )}
              {order.status === 'in_delivery' && (
                <button
                  style={{ ...s.actionBtn, background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', border: 'none', flex: 1, boxShadow: '0 4px 14px rgba(141,198,63,0.35)' }}
                  disabled={actionLoading}
                  onClick={() => onAction(courierDelivered, order.id)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
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
  const [filter, setFilter] = useState('active') // 'active' | 'done'
  const { user } = useAuthStore()

  const telegramId = tg?.initDataUnsafe?.user?.id || user?.telegram_id

  const load = useCallback(() => {
    if (!telegramId) { setLoading(false); return }
    setLoading(true)
    getCourierOrders(telegramId)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [telegramId])

  useEffect(load, [load])

  const doAction = async (fn, orderId) => {
    setActionLoading(true)
    try { await fn(orderId); load() }
    catch (e) { console.error(e) }
    finally { setActionLoading(false) }
  }

  const active = orders.filter(o => ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))
  const done = orders.filter(o => o.status === 'delivered')
  const shown = filter === 'active' ? active : done

  if (!telegramId) return (
    <CourierLayout title="Заказы">
      <div style={s.noAccess}>
        <div style={s.noAccessIcon}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="18" r="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6"/>
            <circle cx="19" cy="18" r="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6"/>
            <path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 20, color: TEXT }}>Панель курьера</div>
        <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>Откройте приложение через Telegram-бота</div>
      </div>
    </CourierLayout>
  )

  return (
    <CourierLayout title="Заказы" activeCount={active.length} onRefresh={load}>
      {/* Summary chips */}
      <div style={s.summaryRow}>
        <button style={{ ...s.chip, ...(filter === 'active' ? s.chipActive : {}) }} onClick={() => setFilter('active')}>
          Активные
          {active.length > 0 && <span style={{ ...s.chipBadge, background: filter === 'active' ? '#fff' : '#E03131', color: filter === 'active' ? C : '#fff' }}>{active.length}</span>}
        </button>
        <button style={{ ...s.chip, ...(filter === 'done' ? s.chipActive : {}) }} onClick={() => setFilter('done')}>
          Выполнено
          {done.length > 0 && <span style={{ ...s.chipBadge, background: filter === 'done' ? '#fff' : '#F2F2F7', color: filter === 'done' ? C : TEXT2 }}>{done.length}</span>}
        </button>
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : shown.length === 0 ? (
        <div style={s.empty}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="3" stroke={C} strokeWidth="1.2"/>
            <path d="M7 9h10M7 13h6" stroke={C} strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyTitle}>
            {filter === 'active' ? 'Нет активных заказов' : 'Нет выполненных заказов'}
          </div>
          <div style={s.emptyHint}>
            {filter === 'active' ? 'Ожидайте назначения от менеджера' : 'Выполненные заказы появятся здесь'}
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {filter === 'active' && active.some(o => o.status === 'in_delivery') && (
            <div style={s.urgentBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="5" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              В пути — не забудьте отметить доставку!
            </div>
          )}
          {shown.map(order => (
            <OrderCard key={order.id} order={order} onAction={doAction} actionLoading={actionLoading} />
          ))}
        </div>
      )}
    </CourierLayout>
  )
}

const s = {
  noAccess: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, padding: '80px 24px', textAlign: 'center',
  },
  noAccessIcon: {
    width: 80, height: 80, borderRadius: 24,
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(141,198,63,0.3)',
  },

  summaryRow: { display: 'flex', gap: 8, marginBottom: 14 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 999, border: `1.5px solid rgba(60,60,67,0.12)`,
    background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  chipActive: { background: C, color: '#fff', borderColor: 'transparent', boxShadow: '0 4px 12px rgba(141,198,63,0.3)' },
  chipBadge: {
    fontSize: 10, fontWeight: 800, borderRadius: 999,
    padding: '1px 6px', minWidth: 18, textAlign: 'center',
  },

  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '60px 20px', textAlign: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: 700, color: TEXT },
  emptyHint: { fontSize: 13, color: TEXT2 },

  urgentBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#E8F4FD', border: '1px solid rgba(25,113,194,0.2)',
    borderRadius: 12, padding: '10px 14px',
    fontSize: 13, fontWeight: 600, color: '#1971C2',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },

  card: {
    background: '#fff', borderRadius: 16,
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '14px 16px', cursor: 'pointer', gap: 12,
  },
  cardLeft: { display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  orderBadge: {
    background: '#F2F2F7', borderRadius: 8, padding: '4px 8px',
    fontSize: 12, fontWeight: 800, color: TEXT2, flexShrink: 0,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardAddr: { fontSize: 14, fontWeight: 600, color: TEXT, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardTime: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: TEXT2, marginTop: 3 },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  cardTotal: { fontWeight: 900, fontSize: 16, color: C },
  statusBadge: { fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700 },

  details: {
    borderTop: `1px solid ${BORDER}`, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },

  infoBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  infoRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    background: '#FAFAFA', borderRadius: 12, textDecoration: 'none', cursor: 'pointer',
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoLabel: { fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoVal: { fontSize: 14, color: TEXT, fontWeight: 500, marginTop: 1 },

  mapBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#111827', color: '#fff', borderRadius: 12,
    padding: '10px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
    WebkitTapHighlightColor: 'transparent',
  },

  itemsBlock: {
    background: '#FAFAFA', borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  blockLabel: { fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8 },
  itemDot: { width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 },
  itemQty: { fontSize: 14, fontWeight: 700, color: TEXT2 },

  bottleBlock: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#E6FCF5', borderRadius: 12, padding: '12px 14px',
    border: '1px solid rgba(18,184,134,0.2)',
  },

  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#F0FFF0', borderRadius: 12, padding: '12px 14px',
    border: `1px solid rgba(141,198,63,0.2)`,
  },
  totalVal: { fontWeight: 900, fontSize: 20, color: C },

  actions: { display: 'flex', gap: 8 },
  actionBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '13px 0', borderRadius: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
}
