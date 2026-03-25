import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { useOrdersStore } from '../store/orders'
import ReviewModal from '../components/ReviewModal'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const STATUSES = [
  { key: 'new', label: 'Новый', icon: 'clock' },
  { key: 'awaiting_confirmation', label: 'Ожидает', icon: 'clock' },
  { key: 'confirmed', label: 'Подтверждён', icon: 'check' },
  { key: 'assigned_to_courier', label: 'Курьер назначен', icon: 'user' },
  { key: 'in_delivery', label: 'В пути', icon: 'truck' },
  { key: 'delivered', label: 'Доставлен', icon: 'done' },
  { key: 'rejected', label: 'Отклонён', icon: 'x' },
  { key: 'rejected_by_manager', label: 'Отклонён менеджером', icon: 'x' },
  { key: 'cancelled', label: 'Отклонён', icon: 'x' },
]

/* On-brand colors: green for active/positive, light gray for neutral, muted red only for rejected */
const STATUS_COLORS = {
  new:                    { bg: `${C}12`, color: C },
  awaiting_confirmation:  { bg: `${C}12`, color: '#7aaa30' },
  confirmed:              { bg: `${C}18`, color: '#5a9620' },
  assigned_to_courier:    { bg: `${C}18`, color: '#4a8a18' },
  in_delivery:            { bg: `${C}20`, color: '#3d7a10' },
  delivered:              { bg: `${C}25`, color: C },
  rejected:               { bg: '#fef2f2', color: '#c0392b' },
  rejected_by_manager:    { bg: '#fef2f2', color: '#c0392b' },
  cancelled:              { bg: '#fef2f2', color: '#c0392b' },
}

const ACTIVE = new Set(['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'])
const STEPS = ['awaiting', 'assigned_to_courier', 'in_delivery', 'delivered']
const STATUS_TO_STEP = {
  new: 0, awaiting_confirmation: 0, confirmed: 0,
  assigned_to_courier: 1, in_delivery: 2, delivered: 3,
}

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
  }

  const handleReviewDone = (orderId) => {
    setReviewedIds(s => new Set([...s, orderId]))
    setReviewOrderId(null)
  }

  if (!orders.length) return (
    <div style={s.page}>
      <div style={s.empty}>
        <div style={s.emptyCircle}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" fill={C + '20'} stroke={C} strokeWidth="1.5"/>
            <path d="M8 8h8M8 12h5M8 16h3" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={s.emptyTitle}>Нет заказов</div>
        <div style={s.emptyDesc}>Ваши заказы появятся здесь после оформления</div>
        <button style={s.primaryBtn} onClick={() => navigate('/')}>Перейти в каталог</button>
      </div>
    </div>
  )

  const active = orders.filter(o => ACTIVE.has(o.status))
  const archived = orders.filter(o => !ACTIVE.has(o.status))

  return (
    <div style={s.page}>
      {active.length > 0 && (
        <div style={s.sectionLabel}>Активные</div>
      )}

      {active.map(order => (
        <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded}
          onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} isActive navigate={navigate} />
      ))}

      {archived.length > 0 && (
        <div style={s.sectionLabel}>Завершённые</div>
      )}

      {archived.map(order => (
        <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded}
          onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} navigate={navigate} />
      ))}

      {reviewOrderId && (
        <ReviewModal orderId={reviewOrderId}
          onClose={() => setReviewOrderId(null)}
          onDone={() => handleReviewDone(reviewOrderId)} />
      )}
      <div style={{ height: 100 }} />
    </div>
  )
}

function ProgressSteps({ status }) {
  const idx = STATUS_TO_STEP[status]
  if (idx === undefined) return null
  return (
    <div style={s.stepsWrap}>
      {STEPS.map((step, i) => (
        <div key={step} style={{ ...s.stepDash, background: i <= idx ? C : '#e0e0e4' }} />
      ))}
    </div>
  )
}

function OrderCard({ order, expanded, setExpanded, onRepeat, onReview, reviewedIds, isActive, navigate }) {
  const isOpen = expanded === order.id
  const statusInfo = STATUSES.find(s => s.key === order.status) || { label: order.status }
  const colors = STATUS_COLORS[order.status] || { bg: '#f5f5f5', color: '#888' }
  const canReview = order.status === 'delivered' && !reviewedIds.has(order.id) && !order.review_id
  const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0
  const isRejected = order.status === 'rejected' || order.status === 'rejected_by_manager' || order.status === 'cancelled'

  return (
    <div style={s.card}>
      <div style={s.cardHead} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
        <div style={{ ...s.statusIcon, background: colors.bg, color: colors.color, border: `1.5px solid ${colors.color}30` }}>
          <StatusIcon status={order.status} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardTopRow}>
            <span style={{ ...s.statusBadge, background: colors.bg, color: colors.color }}>
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
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      {isActive && !isOpen && <div style={{ padding: '0 16px 14px' }}><ProgressSteps status={order.status} /></div>}

      {isOpen && (
        <div style={s.details}>
          {isActive && <ProgressSteps status={order.status} />}

          {order.address && (
            <div style={s.detailRow}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill={C}/>
              </svg>
              <span style={s.detailText}>{order.address}</span>
            </div>
          )}

          {(order.status === 'assigned_to_courier' || order.status === 'in_delivery') && order.courier_name && (
            <div style={s.courierCard}>
              <div style={s.courierRow}>
                <div style={s.courierAvatar}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="3.5" fill="#fff"/>
                    <path d="M5 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.courierLabel}>Курьер</div>
                  <div style={s.courierName}>{order.courier_name}</div>
                </div>
                {order.courier_phone && (
                  <a href={`tel:${order.courier_phone}`} style={s.callBtn}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#fff" strokeWidth="1.5"/>
                    </svg>
                    Позвонить
                  </a>
                )}
              </div>
            </div>
          )}

          {order.items?.length > 0 && (
            <div style={{ ...s.itemsBox, background: colors.bg }}>
              <div style={s.itemsLabel}>Состав заказа</div>
              {order.items.map((i, idx) => (
                <div key={idx} style={s.itemRow}>
                  <span style={s.itemName}>{i.product_name}</span>
                  <span style={s.itemQty}>{i.quantity} x {i.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rejection reason */}
          {isRejected && order.rejection_reason && (
            <div style={s.rejectBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="#c0392b" strokeWidth="1.8"/>
                <path d="M12 8v4M12 16h.01" stroke="#c0392b" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>{order.rejection_reason}</span>
            </div>
          )}

          {/* Manager comment for rejected_by_manager */}
          {order.status === 'rejected_by_manager' && order.manager_comment && (
            <div style={s.managerComment}>
              <div style={s.managerCommentHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="#8e8e93" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                <span style={s.managerCommentLabel}>Комментарий менеджера</span>
              </div>
              <span style={s.managerCommentText}>{order.manager_comment}</span>
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
              <span style={s.reviewDone}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Отзыв отправлен
              </span>
            )}
          </div>

          {/* Support button */}
          <button style={s.supportBtn} onClick={() => navigate('/support')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={C} strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M8 9h8M8 13h5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Связаться с поддержкой
          </button>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: '#e4e4e8', minHeight: '100dvh',
    paddingTop: 4,
  },

  /* Empty state */
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 10, minHeight: '70vh', padding: '0 24px',
  },
  emptyCircle: {
    width: 80, height: 80, borderRadius: '50%', background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  emptyDesc: { fontSize: 14, color: '#8e8e93', textAlign: 'center', lineHeight: 1.5 },
  primaryBtn: {
    marginTop: 8, padding: '14px 32px',
    background: GRAD, color: '#fff', border: 'none',
    borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },

  /* Section label */
  sectionLabel: {
    padding: '18px 20px 8px',
    fontSize: 13, fontWeight: 700, color: '#8e8e93',
    letterSpacing: 0.3,
  },

  /* Order card */
  card: {
    background: '#fff', margin: '0 16px 10px',
    borderRadius: 18, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    position: 'relative',
  },
  cardHead: {
    display: 'flex', alignItems: 'center',
    padding: '14px 16px', cursor: 'pointer', gap: 12,
  },
  statusIcon: {
    width: 38, height: 38, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardTopRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
  },
  statusBadge: {
    display: 'inline-flex', padding: '3px 10px',
    borderRadius: 8, fontSize: 12, fontWeight: 700,
  },
  cardMeta: {
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#8e8e93',
  },
  metaDot: { color: '#c7c7cc' },
  cardTotal: { fontWeight: 700, color: '#3c3c43', fontSize: 13 },

  /* Progress steps */
  stepsWrap: { display: 'flex', gap: 4 },
  stepDash: {
    flex: 1, height: 4, borderRadius: 2,
    transition: 'background 0.3s ease',
  },

  /* Details */
  details: {
    borderTop: '1px solid #f0f0f2', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  detailRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  detailText: { fontSize: 14, color: '#3c3c43', lineHeight: 1.4 },

  /* Courier */
  courierCard: {
    background: GRAD, borderRadius: 14, padding: '12px 14px',
  },
  courierRow: { display: 'flex', alignItems: 'center', gap: 10 },
  courierAvatar: {
    width: 34, height: 34, borderRadius: 10,
    background: 'rgba(255,255,255,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  courierLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: 0.3 },
  courierName: { fontSize: 14, fontWeight: 700, color: '#fff' },
  callBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: '#fff', fontWeight: 700,
    textDecoration: 'none', background: 'rgba(255,255,255,0.2)',
    borderRadius: 10, padding: '8px 14px', flexShrink: 0, marginLeft: 'auto',
  },

  /* Items */
  itemsBox: {
    display: 'flex', flexDirection: 'column', gap: 4,
    borderRadius: 12, padding: '10px 12px',
  },
  itemsLabel: {
    fontSize: 11, fontWeight: 700, color: C,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  itemRow: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  itemName: { flex: 1, fontSize: 13, color: '#3c3c43' },
  itemQty: { fontSize: 13, color: '#8e8e93', fontWeight: 500 },

  /* Reject */
  rejectBox: {
    background: '#fef2f2', borderRadius: 12, padding: '10px 12px',
    fontSize: 13, color: '#c0392b', display: 'flex', alignItems: 'center',
    gap: 8,
  },

  /* Manager comment */
  managerComment: {
    background: '#f8f8fa', borderRadius: 12, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  managerCommentHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  managerCommentLabel: {
    fontSize: 11, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.3,
  },
  managerCommentText: {
    fontSize: 13, color: '#3c3c43', lineHeight: 1.4,
  },

  /* Actions */
  actions: {
    display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4,
  },
  repeatBtn: {
    flex: 1, padding: '12px 0', borderRadius: 14,
    border: 'none', background: GRAD,
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    boxShadow: '0 3px 12px rgba(100,160,30,0.25)',
  },
  reviewBtn: {
    flex: 1, padding: '12px 0', borderRadius: 14,
    border: 'none', background: GRAD,
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    boxShadow: '0 3px 12px rgba(100,160,30,0.25)',
  },
  reviewDone: {
    fontSize: 13, color: C, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 4,
  },

  /* Support button */
  supportBtn: {
    width: '100%', padding: '11px 0', borderRadius: 12,
    border: `1.5px solid ${C}`, background: `${C}08`,
    color: '#3c3c43', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 6,
  },
}
