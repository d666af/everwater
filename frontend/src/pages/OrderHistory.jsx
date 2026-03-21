import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { useOrdersStore } from '../store/orders'
import ReviewModal from '../components/ReviewModal'

const C = '#8DC63F'

const STATUSES = [
  { key: 'new', label: 'Новый', icon: 'clock' },
  { key: 'awaiting_confirmation', label: 'Ожидает', icon: 'clock' },
  { key: 'confirmed', label: 'Подтверждён', icon: 'check' },
  { key: 'assigned_to_courier', label: 'Курьер назначен', icon: 'user' },
  { key: 'in_delivery', label: 'В пути', icon: 'truck' },
  { key: 'delivered', label: 'Доставлен', icon: 'done' },
  { key: 'rejected', label: 'Отклонён', icon: 'x' },
]

const STATUS_COLORS = {
  new: { bg: '#EBF4FF', color: '#3B82F6', border: '#BFDBFE' },
  awaiting_confirmation: { bg: '#FFF8E1', color: '#F59E0B', border: '#FDE68A' },
  confirmed: { bg: '#f0faf0', color: '#6CA32F', border: '#C6E9A7' },
  assigned_to_courier: { bg: '#F3E8FF', color: '#8B5CF6', border: '#DDD6FE' },
  in_delivery: { bg: '#EBF4FF', color: '#3B82F6', border: '#BFDBFE' },
  delivered: { bg: '#f0faf0', color: C, border: '#C6E9A7' },
  rejected: { bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
}

const ACTIVE = new Set(['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'])

const STEPS = ['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery', 'delivered']

function StatusIcon({ status, size = 16 }) {
  const icons = {
    clock: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>,
    check: <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>,
    user: <><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M5 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></>,
    truck: <><rect x="1" y="6" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M16 10h3l3 3v4h-6V10z" stroke="currentColor" strokeWidth="1.8" fill="none"/><circle cx="6.5" cy="18.5" r="1.5" fill="currentColor"/><circle cx="18.5" cy="18.5" r="1.5" fill="currentColor"/></>,
    done: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    x: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  }
  const info = STATUSES.find(s => s.key === status) || { icon: 'clock' }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">{icons[info.icon]}</svg>
}

export default function OrderHistory() {
  const [expanded, setExpanded] = useState(null)
  const [reviewOrderId, setReviewOrderId] = useState(null)
  const [reviewedIds, setReviewedIds] = useState(new Set())
  const addToCart = useCartStore(s => s.addToCart)
  const orders = useOrdersStore(s => s.orders)
  const navigate = useNavigate()

  const repeatOrder = (order) => {
    if (!order.items?.length) return
    order.items.forEach(item => {
      addToCart({ id: item.id || item.product_id, name: item.product_name, price: item.price, volume: item.volume || 0 })
    })
    navigate('/cart')
  }

  const handleReviewDone = (orderId) => {
    setReviewedIds(s => new Set([...s, orderId]))
    setReviewOrderId(null)
  }

  if (!orders.length) return (
    <div style={s.empty}>
      <div style={s.emptyIcon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" fill={C+'20'} stroke={C} strokeWidth="1.5"/>
          <path d="M8 8h8M8 12h5M8 16h3" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={s.emptyTitle}>Нет заказов</div>
      <div style={s.emptyDesc}>Ваши заказы появятся здесь<br/>после оформления</div>
      <button style={s.primaryBtn} onClick={() => navigate('/')}>Перейти в каталог</button>
    </div>
  )

  const active = orders.filter(o => ACTIVE.has(o.status))
  const archived = orders.filter(o => !ACTIVE.has(o.status))

  return (
    <div style={s.page}>
      {/* Active orders summary */}
      {active.length > 0 && (
        <div style={s.activeHeader}>
          <div style={s.activeHeaderIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2"/>
              <path d="M12 7v5l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={s.activeHeaderText}>{active.length} {active.length === 1 ? 'активный заказ' : 'активных заказа'}</span>
        </div>
      )}

      {active.length > 0 && (
        <>
          {active.map(order => (
            <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded}
              onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} isActive />
          ))}
        </>
      )}

      {archived.length > 0 && (
        <>
          <div style={s.sectionLabel}>
            <div style={s.sectionDot} />
            Завершённые
          </div>
          {archived.map(order => (
            <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded}
              onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} />
          ))}
        </>
      )}

      {reviewOrderId && (
        <ReviewModal orderId={reviewOrderId}
          onClose={() => setReviewOrderId(null)}
          onDone={() => handleReviewDone(reviewOrderId)} />
      )}
      <div style={{ height: 100 }} />
    </div>
  )
}

function ProgressBar({ status }) {
  const idx = STEPS.indexOf(status)
  if (idx < 0) return null
  const pct = Math.round(((idx + 1) / STEPS.length) * 100)
  return (
    <div style={s.progressWrap}>
      <div style={s.progressTrack}>
        <div style={{ ...s.progressFill, width: `${pct}%` }} />
      </div>
      <span style={s.progressText}>{pct}%</span>
    </div>
  )
}

function OrderCard({ order, expanded, setExpanded, onRepeat, onReview, reviewedIds, isActive }) {
  const isOpen = expanded === order.id
  const statusInfo = STATUSES.find(s => s.key === order.status) || { label: order.status }
  const colors = STATUS_COLORS[order.status] || { bg: '#f5f5f5', color: '#888', border: '#eee' }
  const canReview = order.status === 'delivered' && !reviewedIds.has(order.id) && !order.review_id
  const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0

  return (
    <div style={{ ...s.card, ...(isActive ? { borderLeft: `3px solid ${colors.color}` } : {}) }}>
      <div style={s.cardHead} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
        <div style={{ ...s.statusDot, background: colors.color, color: colors.color }}>
          <StatusIcon status={order.status} size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardTopRow}>
            <span style={s.orderId}>#{order.id}</span>
            <span style={{ ...s.statusPill, background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>
              {statusInfo.label}
            </span>
          </div>
          <div style={s.cardMeta}>
            <span>{itemCount} {itemCount === 1 ? 'товар' : itemCount < 5 ? 'товара' : 'товаров'}</span>
            <span style={s.metaDot}>·</span>
            <span style={s.cardTotal}>{(order.total || 0).toLocaleString()} сум</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {isActive && !isOpen && <div style={{ padding: '0 16px 12px' }}><ProgressBar status={order.status} /></div>}

      {isOpen && (
        <div style={s.details}>
          {isActive && <ProgressBar status={order.status} />}

          {order.address && (
            <div style={s.detailRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill={C}/>
              </svg>
              <span style={s.detailText}>{order.address}</span>
            </div>
          )}
          {order.delivery_time && (
            <div style={s.detailRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.8"/>
                <path d="M12 7v5l3 3" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span style={s.detailText}>{order.delivery_time}</span>
            </div>
          )}

          {(order.status === 'assigned_to_courier' || order.status === 'in_delivery') && order.courier_name && (
            <div style={s.courierBox}>
              <div style={s.courierHeader}>
                <div style={s.courierAvatar}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="3.5" fill="#fff"/>
                    <path d="M5 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Курьер</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{order.courier_name}</div>
                </div>
              </div>
              {order.courier_phone && (
                <a href={`tel:${order.courier_phone}`} style={s.callLink}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#fff" strokeWidth="1.5"/>
                  </svg>
                  Позвонить
                </a>
              )}
            </div>
          )}

          {order.items?.length > 0 && (
            <div style={s.itemsList}>
              <div style={s.itemsHeader}>Состав заказа</div>
              {order.items.map((i, idx) => (
                <div key={idx} style={s.itemRow}>
                  <span style={{ flex: 1, fontSize: 13, color: '#444' }}>{i.product_name}</span>
                  <span style={{ fontSize: 13, color: '#999', fontWeight: 500 }}>{i.quantity} × {i.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {order.rejection_reason && (
            <div style={s.rejectBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="1.8"/>
                <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {order.rejection_reason}
            </div>
          )}

          <div style={s.actions}>
            <button style={s.repeatBtn} onClick={() => onRepeat(order)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Повторить
            </button>
            {canReview && (
              <button style={s.reviewBtn} onClick={() => onReview(order.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#fff" strokeWidth="1.5" fill="none"/>
                </svg>
                Оценить
              </button>
            )}
            {reviewedIds.has(order.id) && (
              <span style={{ fontSize: 13, color: C, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Отзыв отправлен
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    padding: '4px 0',
    display: 'flex',
    flexDirection: 'column',
    background: '#fafafa',
    minHeight: '100dvh',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: '75vh',
    padding: '0 24px',
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: '50%', background: '#f0faf0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  emptyDesc: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 1.5 },
  primaryBtn: {
    marginTop: 8,
    padding: '14px 32px',
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },

  activeHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', margin: '0 16px 8px',
    background: `linear-gradient(135deg, ${C} 0%, #6CA32F 100%)`,
    borderRadius: 14,
  },
  activeHeaderIcon: { display: 'flex' },
  activeHeaderText: { fontSize: 14, fontWeight: 700, color: '#fff' },

  sectionLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '16px 20px 8px',
    fontSize: 12, fontWeight: 700, color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionDot: { width: 6, height: 6, borderRadius: '50%', background: '#ddd' },

  card: {
    background: '#fff',
    margin: '0 16px 8px',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #f0f0f0',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    cursor: 'pointer',
    gap: 12,
  },
  statusDot: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, opacity: 0.9,
  },
  cardTopRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
  },
  orderId: {
    fontWeight: 700, fontSize: 15, color: '#111',
  },
  statusPill: {
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
  },
  cardMeta: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: '#999',
  },
  metaDot: { color: '#ddd' },
  cardTotal: { fontWeight: 700, color: '#555' },

  progressWrap: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  progressTrack: {
    flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: `linear-gradient(90deg, ${C}, #6CA32F)`,
    borderRadius: 2, transition: 'width 0.3s ease',
  },
  progressText: { fontSize: 11, fontWeight: 700, color: C, minWidth: 28 },

  details: {
    borderTop: '1px solid #f0f0f0',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  detailRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 1.4,
  },
  courierBox: {
    background: `linear-gradient(135deg, #2563EB, #1D4ED8)`,
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  courierHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  courierAvatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  callLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: '#fff', fontWeight: 700,
    textDecoration: 'none',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 8, padding: '8px 12px', alignSelf: 'flex-start',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: '#f7f7f8',
    borderRadius: 10,
    padding: '10px 12px',
  },
  itemsHeader: {
    fontSize: 11, fontWeight: 700, color: '#bbb',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  rejectBox: {
    background: '#FEF2F2',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    color: '#EF4444',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #FECACA',
  },
  actions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    paddingTop: 2,
  },
  repeatBtn: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 10,
    border: '1px solid #eee',
    background: '#fff',
    color: '#444',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewBtn: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 10,
    border: 'none',
    background: C,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
}
