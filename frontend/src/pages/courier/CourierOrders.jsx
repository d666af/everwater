import { useEffect, useState, useCallback, useRef } from 'react'
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
  confirmed:           { label: 'Назначен',      bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier: { label: 'Ожидает старта', bg: '#F3F0FF', color: '#6741D9' },
  in_delivery:         { label: 'В доставке',    bg: '#E8F4FD', color: '#1971C2' },
  delivered:           { label: 'Доставлен',     bg: '#EBFBEE', color: C },
}

// ── Parse delivery_time string → Date (today) ──────────────────────────────
function parseDeliveryEnd(delivery_time) {
  if (!delivery_time) return null
  // Formats: "Сегодня 14:00–15:00", "14:00-15:00", "14:30", "Завтра 09:00–12:00"
  if (/завтра/i.test(delivery_time)) return null  // future → not overdue
  const ranges = delivery_time.match(/(\d{1,2}):(\d{2})[\s–\-]+(\d{1,2}):(\d{2})/)
  const single = delivery_time.match(/(\d{1,2}):(\d{2})/)
  const now = new Date()
  const d = new Date(now)
  if (ranges) {
    d.setHours(parseInt(ranges[3]), parseInt(ranges[4]), 0, 0)
  } else if (single) {
    d.setHours(parseInt(single[1]), parseInt(single[2]), 0, 0)
  } else {
    return null
  }
  return d
}

function isOverdue(order) {
  if (order.status !== 'in_delivery') return false
  const end = parseDeliveryEnd(order.delivery_time)
  if (!end) return false
  return new Date() > end
}

function minutesPastDue(order) {
  const end = parseDeliveryEnd(order.delivery_time)
  if (!end) return 0
  return Math.floor((Date.now() - end.getTime()) / 60000)
}

// ── OrderCard ─────────────────────────────────────────────────────────────────
function OrderCard({ order, onAction, actionLoading }) {
  const [open, setOpen] = useState(false)
  const st = STATUS[order.status] || { label: order.status, bg: '#F2F2F7', color: TEXT2 }
  const isActive = ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(order.status)
  const overdue = isOverdue(order)
  const minsLate = overdue ? minutesPastDue(order) : 0

  return (
    <div style={{
      ...s.card,
      opacity: order.status === 'delivered' ? 0.75 : 1,
      border: overdue
        ? '1.5px solid rgba(224,49,49,0.4)'
        : order.status === 'in_delivery'
          ? `1.5px solid rgba(25,113,194,0.25)`
          : `1px solid ${BORDER}`,
      boxShadow: overdue ? '0 2px 16px rgba(224,49,49,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>

      {/* Overdue strip */}
      {overdue && (
        <div style={s.overdueStrip}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="none" stroke="#fff" strokeWidth="1.6"/>
          </svg>
          Время доставки прошло {minsLate > 0 ? `${minsLate} мин назад` : ''}— подтвердите доставку!
        </div>
      )}

      {/* Card header */}
      <div style={s.cardTop} onClick={() => setOpen(o => !o)}>
        <div style={s.cardLeft}>
          <div style={s.orderBadge}>#{order.id}</div>
          <div style={s.cardInfo}>
            <div style={s.cardAddr}>{order.address}</div>
            {order.delivery_time && (
              <div style={{ ...s.cardTime, color: overdue ? '#E03131' : TEXT2 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {order.delivery_time}
              </div>
            )}
          </div>
        </div>
        <div style={s.cardRight}>
          <div style={{ ...s.cardTotal, color: overdue ? '#E03131' : C }}>{Number(order.total || 0).toLocaleString()} сум</div>
          <span style={{ ...s.statusBadge, background: st.bg, color: st.color }}>{st.label}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            style={{ marginTop: 4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={s.details}>

          {/* Client contacts */}
          <div style={s.infoBlock}>
            {order.recipient_phone && (
              <a href={`tel:${order.recipient_phone}`} style={s.contactRow}>
                <div style={{ ...s.contactIcon, background: '#EDF3FF' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4l1.9-1.9c.2-.2.5-.3.8-.1 1 .4 2.1.6 3.1.6.4 0 .8.3.8.8V19c0 .4-.4.8-.8.8C9.1 19.8 4.2 14.9 4.2 8.8c0-.5.4-.8.8-.8H8c.5 0 .8.4.8.8 0 1.1.2 2.1.6 3.1.1.3 0 .6-.1.8l-1.9 1.9-.6-3.8z" fill="#3B5BDB"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.contactLabel}>Позвонить клиенту</div>
                  <div style={{ ...s.contactVal, color: '#3B5BDB' }}>{order.recipient_phone}</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </a>
            )}

            {order.client_telegram_id && (
              <a href={`tg://user?id=${order.client_telegram_id}`} style={s.contactRow}>
                <div style={{ ...s.contactIcon, background: '#E8F4FD' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M21.6 12.3C21.6 17.4 17.4 21.6 12 21.6C9.8 21.6 7.7 20.9 6 19.7L2.4 20.4 3.1 17C1.9 15.2 1.2 13.1 1.2 10.9 1.2 5.8 5.4 1.6 10.8 1.6" stroke="#1971C2" strokeWidth="1.4" strokeLinecap="round"/>
                    <path d="M17.5 5.5l-7 4 3 1 1 3 3-4" stroke="#1971C2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.contactLabel}>Написать в Telegram</div>
                  <div style={{ ...s.contactVal, color: '#1971C2' }}>Открыть чат</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </a>
            )}
          </div>

          {/* Address + map */}
          <div style={s.addrBlock}>
            <div style={{ flex: 1 }}>
              <div style={s.blockLabel}>Адрес доставки</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}>{order.address}</div>
              {order.extra_info && (
                <div style={{ fontSize: 13, color: TEXT2, marginTop: 4, lineHeight: 1.4 }}>
                  {order.extra_info}
                </div>
              )}
            </div>
            {order.latitude && order.longitude && (
              <a
                href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                target="_blank" rel="noopener noreferrer"
                style={s.mapBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7M9 20l6-3M9 20V7m6 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7M9 7l6-2"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Карта
              </a>
            )}
          </div>

          {/* Delivery time highlight */}
          {order.delivery_time && (
            <div style={{ ...s.timeBlock, background: overdue ? '#FFF5F5' : '#F3F0FF', borderColor: overdue ? 'rgba(224,49,49,0.2)' : 'rgba(103,65,217,0.15)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke={overdue ? '#E03131' : '#6741D9'} strokeWidth="1.6"/>
                <path d="M12 7v5l3 3" stroke={overdue ? '#E03131' : '#6741D9'} strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: overdue ? '#E03131' : '#6741D9', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {overdue ? 'Время вышло!' : 'Время доставки'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: overdue ? '#E03131' : '#6741D9' }}>{order.delivery_time}</div>
              </div>
            </div>
          )}

          {/* Items to deliver */}
          {order.items?.length > 0 && (
            <div style={s.itemsBlock}>
              <div style={s.blockLabel}>Доставить</div>
              {order.items.map((item, idx) => (
                <div key={item.id ?? idx} style={s.itemRow}>
                  <div style={s.itemDot} />
                  <span style={{ flex: 1, fontSize: 14, color: TEXT, fontWeight: 500 }}>{item.product_name}</span>
                  <span style={s.itemQty}>× {item.quantity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Return bottles */}
          {order.return_bottles_count > 0 && (
            <div style={s.bottleBlock}>
              <div style={{ ...s.bottleIcon }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#0A7A5C" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M3 3v5h5" stroke="#0A7A5C" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0A7A5C' }}>Забрать пустые бутылки</div>
                <div style={{ fontSize: 13, color: '#12B886' }}>
                  {order.return_bottles_count} шт.{order.return_bottles_volume ? ` · ${order.return_bottles_volume} л каждая` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Total */}
          <div style={s.totalRow}>
            <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>Получить от клиента</span>
            <span style={s.totalVal}>{Number(order.total || 0).toLocaleString()} сум</span>
          </div>

          {/* Action buttons */}
          {isActive && (
            <div style={s.actions}>
              {/* confirmed: just show "Принял" to acknowledge */}
              {order.status === 'confirmed' && (
                <button
                  style={{ ...s.actionBtn, background: '#F3F0FF', color: '#6741D9', border: '1.5px solid rgba(103,65,217,0.2)', flex: 1 }}
                  disabled={actionLoading}
                  onClick={() => onAction(courierAccept, order.id)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Принял заказ
                </button>
              )}

              {/* assigned_to_courier: Принял + Выехал */}
              {order.status === 'assigned_to_courier' && (
                <>
                  <button
                    style={{ ...s.actionBtn, background: '#F3F0FF', color: '#6741D9', border: '1.5px solid rgba(103,65,217,0.2)' }}
                    disabled={actionLoading}
                    onClick={() => onAction(courierAccept, order.id)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
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

              {/* in_delivery: Доставлено */}
              {order.status === 'in_delivery' && (
                <button
                  style={{
                    ...s.actionBtn, border: 'none', flex: 1,
                    background: overdue
                      ? 'linear-gradient(135deg, #E03131, #C92A2A)'
                      : `linear-gradient(135deg, ${C}, ${CD})`,
                    color: '#fff',
                    boxShadow: overdue
                      ? '0 4px 14px rgba(224,49,49,0.35)'
                      : '0 4px 14px rgba(141,198,63,0.35)',
                  }}
                  disabled={actionLoading}
                  onClick={() => onAction(courierDelivered, order.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {overdue ? 'Подтвердить доставку!' : 'Доставлено'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CourierOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('active')
  const [now, setNow] = useState(new Date())
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

  // ── Tick every 30s for overdue detection
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const doAction = async (fn, orderId) => {
    setActionLoading(true)
    try { await fn(orderId); load() }
    catch (e) { console.error(e) }
    finally { setActionLoading(false) }
  }

  const active = orders.filter(o => ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))
  const done = orders.filter(o => o.status === 'delivered')
  const overdueOrders = active.filter(o => isOverdue(o))
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

      {/* Overdue alert */}
      {overdueOrders.length > 0 && (
        <div style={s.overdueAlert}>
          <div style={s.overdueAlertLeft}>
            <div style={s.overdueAlertPulse} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {overdueOrders.length === 1
                  ? '⚠️ Просроченная доставка!'
                  : `⚠️ ${overdueOrders.length} просроченных доставки!`}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                Нажмите на заказ и подтвердите доставку
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={s.summaryRow}>
        <button style={{ ...s.chip, ...(filter === 'active' ? s.chipActive : {}) }} onClick={() => setFilter('active')}>
          Активные
          {active.length > 0 && (
            <span style={{ ...s.chipBadge, background: filter === 'active' ? '#fff' : (overdueOrders.length > 0 ? '#E03131' : '#F2F2F7'), color: filter === 'active' ? C : (overdueOrders.length > 0 ? '#fff' : TEXT2) }}>
              {active.length}
            </span>
          )}
        </button>
        <button style={{ ...s.chip, ...(filter === 'done' ? s.chipActive : {}) }} onClick={() => setFilter('done')}>
          Выполнено сегодня
          {done.length > 0 && (
            <span style={{ ...s.chipBadge, background: filter === 'done' ? '#fff' : '#F2F2F7', color: filter === 'done' ? C : TEXT2 }}>
              {done.length}
            </span>
          )}
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
            {filter === 'active' ? 'Ожидайте назначения от менеджера' : 'Выполненные заказы за сегодня появятся здесь'}
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {/* Sort: overdue first, then in_delivery, then rest */}
          {shown
            .slice()
            .sort((a, b) => {
              if (isOverdue(a) && !isOverdue(b)) return -1
              if (!isOverdue(a) && isOverdue(b)) return 1
              if (a.status === 'in_delivery' && b.status !== 'in_delivery') return -1
              if (a.status !== 'in_delivery' && b.status === 'in_delivery') return 1
              return 0
            })
            .map(order => (
              <OrderCard key={order.id} order={order} onAction={doAction} actionLoading={actionLoading} />
            ))}
        </div>
      )}
    </CourierLayout>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
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

  overdueAlert: {
    background: 'linear-gradient(135deg, #E03131, #C92A2A)',
    borderRadius: 14, padding: '14px 16px',
    color: '#fff', marginBottom: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 4px 16px rgba(224,49,49,0.3)',
  },
  overdueAlertLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  overdueAlertPulse: {
    width: 12, height: 12, borderRadius: '50%',
    background: '#fff', flexShrink: 0,
    boxShadow: '0 0 0 4px rgba(255,255,255,0.3)',
    animation: 'pulse 1.5s infinite',
  },

  summaryRow: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 999, border: `1.5px solid rgba(60,60,67,0.12)`,
    background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
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

  list: { display: 'flex', flexDirection: 'column', gap: 10 },

  // Card
  card: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    transition: 'box-shadow 0.2s',
  },
  overdueStrip: {
    background: 'linear-gradient(90deg, #E03131, #C92A2A)',
    color: '#fff', padding: '8px 16px',
    fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '14px 16px', cursor: 'pointer', gap: 12,
    WebkitTapHighlightColor: 'transparent',
  },
  cardLeft: { display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  orderBadge: {
    background: '#F2F2F7', borderRadius: 8, padding: '4px 8px',
    fontSize: 12, fontWeight: 800, color: TEXT2, flexShrink: 0,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardAddr: { fontSize: 14, fontWeight: 600, color: TEXT, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardTime: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 3 },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  cardTotal: { fontWeight: 900, fontSize: 16 },
  statusBadge: { fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700 },

  details: {
    borderTop: `1px solid ${BORDER}`, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },

  // Contacts
  infoBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  contactRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 12px', background: '#FAFAFA', borderRadius: 13,
    textDecoration: 'none', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  contactIcon: {
    width: 34, height: 34, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  contactLabel: { fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 },
  contactVal: { fontSize: 14, fontWeight: 700, marginTop: 1 },

  // Address
  addrBlock: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#FAFAFA', borderRadius: 13, padding: '12px 14px',
  },
  blockLabel: { fontSize: 10, color: TEXT2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  mapBtn: {
    display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'column',
    background: '#111827', color: '#fff', borderRadius: 12,
    padding: '12px 14px', fontSize: 11, fontWeight: 700, textDecoration: 'none',
    flexShrink: 0, WebkitTapHighlightColor: 'transparent',
  },

  // Time
  timeBlock: {
    display: 'flex', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: '11px 14px', border: '1px solid',
  },

  // Items
  itemsBlock: {
    background: '#FAFAFA', borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8 },
  itemDot: { width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 },
  itemQty: { fontSize: 14, fontWeight: 700, color: TEXT2 },

  // Bottles
  bottleBlock: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#E6FCF5', borderRadius: 12, padding: '13px 14px',
    border: '1px solid rgba(18,184,134,0.25)',
  },
  bottleIcon: {
    width: 38, height: 38, borderRadius: 10, background: 'rgba(18,184,134,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Total
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#F0FFF0', borderRadius: 12, padding: '13px 14px',
    border: `1px solid rgba(141,198,63,0.25)`,
  },
  totalVal: { fontWeight: 900, fontSize: 22, color: C },

  // Actions
  actions: { display: 'flex', gap: 8 },
  actionBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent', transition: 'opacity 0.15s',
  },
}
