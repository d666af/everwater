import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'
import { useOrdersStore } from '../store/orders'
import ReviewModal from '../components/ReviewModal'

const C = '#7CB342'

const STATUSES = [
  { key: 'new', label: 'Новый' },
  { key: 'awaiting_confirmation', label: 'Ожидает' },
  { key: 'confirmed', label: 'Подтверждён' },
  { key: 'assigned_to_courier', label: 'Курьер назначен' },
  { key: 'in_delivery', label: 'В пути' },
  { key: 'delivered', label: 'Доставлен' },
  { key: 'rejected', label: 'Отклонён' },
]

const STATUS_STYLE = {
  new: { bg: '#E3F2FD', color: '#1565C0' },
  awaiting_confirmation: { bg: '#FFF8E1', color: '#F57F17' },
  confirmed: { bg: '#E8F5E9', color: '#2E7D32' },
  assigned_to_courier: { bg: '#F3E5F5', color: '#7B1FA2' },
  in_delivery: { bg: '#E8EAF6', color: '#283593' },
  delivered: { bg: '#E8F5E9', color: '#2E7D32' },
  rejected: { bg: '#FFEBEE', color: '#C62828' },
}

const ACTIVE_STATUSES = new Set(['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'])

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
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="1.5"/>
        <path d="M8 8h8M8 12h5M8 16h3" stroke="#E0E0E0" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#212121' }}>Нет заказов</div>
      <div style={{ fontSize: 14, color: '#9E9E9E' }}>Ваши заказы появятся здесь</div>
      <button style={s.primaryBtn} onClick={() => navigate('/')}>В каталог</button>
    </div>
  )

  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status))
  const archived = orders.filter(o => !ACTIVE_STATUSES.has(o.status))

  return (
    <div style={s.page}>
      {active.length > 0 && (
        <>
          <div style={s.sectionTitle}>Активные</div>
          {active.map(order => (
            <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded}
              onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} />
          ))}
        </>
      )}
      {archived.length > 0 && (
        <>
          <div style={s.sectionTitle}>Завершённые</div>
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
  const statusSt = STATUS_STYLE[order.status] || { bg: '#F5F5F5', color: '#757575' }
  const canReview = order.status === 'delivered' && !reviewedIds.has(order.id) && !order.review_id

  return (
    <div style={s.card}>
      <div style={s.cardHead} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
        <div style={{ flex: 1 }}>
          <div style={s.orderId}>#{order.id}</div>
          <div style={{ ...s.statusPill, background: statusSt.bg, color: statusSt.color }}>
            {statusInfo.label}
          </div>
        </div>
        <div style={s.cardRight}>
          <div style={s.total}>{(order.total || 0).toLocaleString()} сум</div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div style={s.details}>
          {order.address && (
            <div style={s.detailRow}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="#9E9E9E"/>
              </svg>
              <span style={s.detailText}>{order.address}</span>
            </div>
          )}
          {order.delivery_time && (
            <div style={s.detailRow}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#9E9E9E" strokeWidth="1.8"/>
                <path d="M12 7v5l3 3" stroke="#9E9E9E" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span style={s.detailText}>{order.delivery_time}</span>
            </div>
          )}

          {(order.status === 'assigned_to_courier' || order.status === 'in_delivery') && order.courier_name && (
            <div style={s.courierBox}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1565C0' }}>Курьер</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#212121' }}>{order.courier_name}</div>
              {order.courier_phone && (
                <a href={`tel:${order.courier_phone}`} style={s.callBtn}>Позвонить</a>
              )}
            </div>
          )}

          {order.items?.length > 0 && (
            <div style={s.itemsList}>
              {order.items.map((i, idx) => (
                <div key={idx} style={s.itemRow}>
                  <span style={{ flex: 1, fontSize: 13, color: '#424242' }}>{i.product_name}</span>
                  <span style={{ fontSize: 13, color: '#9E9E9E' }}>{i.quantity} x {i.price.toLocaleString()}</span>
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
              <span style={{ fontSize: 13, color: C, fontWeight: 600 }}>Отзыв отправлен</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    background: '#FAFAFA',
    minHeight: '100vh',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: '65vh',
    padding: '0 24px',
  },
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
    boxShadow: '0 4px 16px rgba(124,179,66,0.3)',
  },
  sectionTitle: {
    padding: '16px 24px 8px',
    fontSize: 13,
    fontWeight: 700,
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    background: '#FFFFFF',
    margin: '0 20px 10px',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 18px',
    cursor: 'pointer',
    gap: 12,
  },
  orderId: {
    fontWeight: 800,
    fontSize: 16,
    color: '#212121',
    marginBottom: 6,
  },
  statusPill: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  total: {
    fontWeight: 800,
    fontSize: 16,
    color: '#212121',
  },
  details: {
    borderTop: '1px solid #F5F5F5',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  detailRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },
  detailText: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 1.5,
  },
  courierBox: {
    background: '#E3F2FD',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  callBtn: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: 700,
    textDecoration: 'none',
    marginTop: 4,
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#FAFAFA',
    borderRadius: 12,
    padding: '12px 14px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  rejectBox: {
    background: '#FFEBEE',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 13,
    color: '#C62828',
  },
  actions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  repeatBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 12,
    border: 'none',
    background: '#F5F5F5',
    color: '#424242',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  reviewBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 12,
    border: 'none',
    background: C,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(124,179,66,0.3)',
  },
}
