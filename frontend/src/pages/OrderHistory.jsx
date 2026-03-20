import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { useOrdersStore } from '../store/orders'
import ReviewModal from '../components/ReviewModal'

const STATUSES = [
  { key: 'new', label: 'Новый' },
  { key: 'awaiting_confirmation', label: 'Ожидает' },
  { key: 'confirmed', label: 'Подтверждён' },
  { key: 'assigned_to_courier', label: 'Курьер назначен' },
  { key: 'in_delivery', label: 'В пути' },
  { key: 'delivered', label: 'Доставлен' },
  { key: 'rejected', label: 'Отклонён' },
]

const STATUS_COLORS = {
  new: { bg: '#e3f2fd', color: '#1565C0' },
  awaiting_confirmation: { bg: '#fff8e1', color: '#f57f17' },
  confirmed: { bg: '#e8f5e9', color: '#2e7d32' },
  assigned_to_courier: { bg: '#f3e5f5', color: '#7b1fa2' },
  in_delivery: { bg: '#e8eaf6', color: '#283593' },
  delivered: { bg: '#e8f5e9', color: '#2e7d32' },
  rejected: { bg: '#ffebee', color: '#c62828' },
}

const ACTIVE = new Set(['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'])

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
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5"/>
        <path d="M8 8h8M8 12h5M8 16h3" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>Нет заказов</div>
      <div style={{ fontSize: 14, color: '#999' }}>Ваши заказы появятся здесь</div>
      <button style={s.primaryBtn} onClick={() => navigate('/')}>В каталог</button>
    </div>
  )

  const active = orders.filter(o => ACTIVE.has(o.status))
  const archived = orders.filter(o => !ACTIVE.has(o.status))

  return (
    <div style={s.page}>
      {active.length > 0 && (
        <>
          <div style={s.sectionLabel}>Активные</div>
          {active.map(order => (
            <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded}
              onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} />
          ))}
        </>
      )}
      {archived.length > 0 && (
        <>
          <div style={s.sectionLabel}>Завершённые</div>
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

function OrderCard({ order, expanded, setExpanded, onRepeat, onReview, reviewedIds }) {
  const isOpen = expanded === order.id
  const statusInfo = STATUSES.find(s => s.key === order.status) || { label: order.status }
  const colors = STATUS_COLORS[order.status] || { bg: '#f5f5f5', color: '#888' }
  const canReview = order.status === 'delivered' && !reviewedIds.has(order.id) && !order.review_id

  return (
    <div style={s.card}>
      <div style={s.cardHead} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.orderId}>#{order.id}</div>
          <span style={{ ...s.pill, background: colors.bg, color: colors.color }}>
            {statusInfo.label}
          </span>
        </div>
        <div style={s.cardRight}>
          <div style={s.total}>{(order.total || 0).toLocaleString()} сум</div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div style={s.details}>
          {order.address && (
            <div style={s.detailRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="#999"/>
              </svg>
              <span style={s.detailText}>{order.address}</span>
            </div>
          )}
          {order.delivery_time && (
            <div style={s.detailRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <circle cx="12" cy="12" r="9" stroke="#999" strokeWidth="1.8"/>
                <path d="M12 7v5l3 3" stroke="#999" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span style={s.detailText}>{order.delivery_time}</span>
            </div>
          )}

          {(order.status === 'assigned_to_courier' || order.status === 'in_delivery') && order.courier_name && (
            <div style={s.courierBox}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1565C0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Курьер</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{order.courier_name}</div>
              {order.courier_phone && (
                <a href={`tel:${order.courier_phone}`} style={s.callLink}>Позвонить</a>
              )}
            </div>
          )}

          {order.items?.length > 0 && (
            <div style={s.itemsList}>
              {order.items.map((i, idx) => (
                <div key={idx} style={s.itemRow}>
                  <span style={{ flex: 1, fontSize: 13, color: '#444' }}>{i.product_name}</span>
                  <span style={{ fontSize: 13, color: '#999' }}>{i.quantity} × {i.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {order.rejection_reason && (
            <div style={s.rejectBox}>{order.rejection_reason}</div>
          )}

          <div style={s.actions}>
            <button style={s.repeatBtn} onClick={() => onRepeat(order)}>Повторить</button>
            {canReview && (
              <button style={s.reviewBtn} onClick={() => onReview(order.id)}>Оценить</button>
            )}
            {reviewedIds.has(order.id) && (
              <span style={{ fontSize: 13, color: '#4CAF50', fontWeight: 600 }}>Отзыв отправлен</span>
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
    height: '65vh',
    padding: '0 24px',
  },
  primaryBtn: {
    marginTop: 8,
    padding: '12px 28px',
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  sectionLabel: {
    padding: '14px 20px 6px',
    fontSize: 12,
    fontWeight: 700,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    background: '#fff',
    margin: '0 16px 8px',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #f0f0f0',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    cursor: 'pointer',
    gap: 12,
  },
  orderId: {
    fontWeight: 700,
    fontSize: 15,
    color: '#111',
    marginBottom: 5,
  },
  pill: {
    display: 'inline-flex',
    padding: '3px 9px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  total: {
    fontWeight: 700,
    fontSize: 15,
    color: '#111',
  },
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
    background: '#f0f7ff',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  callLink: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: 2,
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: '#f7f7f8',
    borderRadius: 10,
    padding: '10px 12px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  rejectBox: {
    background: '#fff5f5',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    color: '#c62828',
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
  },
  reviewBtn: {
    flex: 1,
    padding: '11px 0',
    borderRadius: 10,
    border: 'none',
    background: '#4CAF50',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
