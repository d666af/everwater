import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram, getUserOrders, getOrder } from '../api'
import { useCartStore } from '../store'
import ReviewModal from '../components/ReviewModal'

const tg = window.Telegram?.WebApp

const STATUSES = [
  { key: 'new', label: 'Новый', icon: '🆕' },
  { key: 'awaiting_confirmation', label: 'Ожидает подтверждения', icon: '⏳' },
  { key: 'confirmed', label: 'Подтверждён', icon: '✅' },
  { key: 'assigned_to_courier', label: 'Передан курьеру', icon: '🚚' },
  { key: 'in_delivery', label: 'В доставке', icon: '🚴' },
  { key: 'delivered', label: 'Доставлен', icon: '✔️' },
  { key: 'rejected', label: 'Отклонён', icon: '❌' },
]

const STATUS_STEP = {
  new: 1,
  awaiting_confirmation: 2,
  confirmed: 3,
  assigned_to_courier: 4,
  in_delivery: 5,
  delivered: 6,
  rejected: -1,
}

const ACTIVE_STATUSES = new Set(['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'])

function StatusProgress({ status }) {
  if (status === 'rejected') return (
    <div style={styles.rejected}>❌ Заказ отклонён</div>
  )
  const current = STATUS_STEP[status] || 0
  const steps = STATUSES.filter(s => s.key !== 'rejected')
  return (
    <div style={styles.progress}>
      {steps.map((s, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={s.key} style={styles.progressItem}>
            <div style={{ ...styles.progressDot, ...(done ? styles.dotDone : active ? styles.dotActive : {}) }}>
              {done ? '✓' : s.icon[0] || '○'}
            </div>
            {i < steps.length - 1 && (
              <div style={{ ...styles.progressLine, ...(done ? styles.lineDone : {}) }} />
            )}
            {active && <div style={styles.progressLabel}>{s.label}</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [reviewOrderId, setReviewOrderId] = useState(null)
  const [reviewedIds, setReviewedIds] = useState(new Set())
  const addToCart = useCartStore(s => s.addToCart)
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (!tgUser?.id) { setLoading(false); return }
    getUserByTelegram(tgUser.id)
      .then(user => getUserOrders(user.id))
      .then(list => setOrders(list.sort((a, b) => b.id - a.id)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const repeatOrder = async (order) => {
    try {
      const full = await getOrder(order.id)
      full.items.forEach(item => {
        addToCart({ id: item.product_id, name: item.product_name, price: item.price, volume: item.volume || 0 })
      })
      navigate('/cart')
    } catch {
      tg?.showAlert('Не удалось повторить заказ')
    }
  }

  const handleReviewDone = (orderId) => {
    setReviewedIds(s => new Set([...s, orderId]))
    setReviewOrderId(null)
    tg?.showAlert('Спасибо за отзыв!')
  }

  if (loading) return <div style={styles.center}>Загрузка...</div>
  if (!orders.length) return (
    <div style={styles.center}>
      <div style={{ fontSize: 48 }}>📦</div>
      <div>У вас пока нет заказов</div>
      <button style={styles.primaryBtn} onClick={() => navigate('/')}>Перейти в каталог</button>
    </div>
  )

  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status))
  const archived = orders.filter(o => !ACTIVE_STATUSES.has(o.status))

  return (
    <div style={styles.list}>
      {active.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Активные</div>
          {active.map(order => <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded} onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} />)}
        </>
      )}
      {archived.length > 0 && (
        <>
          <div style={styles.sectionTitle}>История</div>
          {archived.map(order => <OrderCard key={order.id} order={order} expanded={expanded} setExpanded={setExpanded} onRepeat={repeatOrder} onReview={setReviewOrderId} reviewedIds={reviewedIds} />)}
        </>
      )}

      {reviewOrderId && (
        <ReviewModal
          orderId={reviewOrderId}
          onClose={() => setReviewOrderId(null)}
          onDone={() => handleReviewDone(reviewOrderId)}
        />
      )}
    </div>
  )
}

function OrderCard({ order, expanded, setExpanded, onRepeat, onReview, reviewedIds }) {
  const isExpanded = expanded === order.id
  const statusInfo = STATUSES.find(s => s.key === order.status) || { label: order.status, icon: '?' }
  const canReview = order.status === 'delivered' && !reviewedIds.has(order.id) && !order.review_id

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
        <div>
          <div style={styles.orderId}>Заказ #{order.id}</div>
          <div style={{ ...styles.status, color: order.status === 'rejected' ? '#e53935' : order.status === 'delivered' ? '#2e7d32' : '#f57c00' }}>
            {statusInfo.icon} {statusInfo.label}
          </div>
          {order.delivery_time && <div style={styles.orderTime}>🕐 {order.delivery_time}</div>}
        </div>
        <div style={styles.cardRight}>
          <div style={styles.total}>{order.total} ₽</div>
          <div style={styles.chevron}>{isExpanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {isExpanded && (
        <div style={styles.details}>
          {/* Status progress */}
          <StatusProgress status={order.status} />

          {/* Rejection reason */}
          {order.rejection_reason && (
            <div style={styles.rejectBox}>
              <b>Причина отказа:</b> {order.rejection_reason}
            </div>
          )}

          {/* Courier contact */}
          {(order.status === 'assigned_to_courier' || order.status === 'in_delivery') && order.courier_name && (
            <div style={styles.courierBox}>
              <div style={styles.courierTitle}>🚴 Ваш курьер</div>
              <div style={styles.courierName}>{order.courier_name}</div>
              {order.courier_phone && (
                <a href={`tel:${order.courier_phone}`} style={styles.callCourier}>
                  📞 Позвонить курьеру
                </a>
              )}
            </div>
          )}

          {/* Address & info */}
          <div style={styles.infoBlock}>
            <div style={styles.detailRow}><b>📍 Адрес:</b> {order.address}</div>
            {order.extra_info && <div style={styles.detailRow}><b>🏠</b> {order.extra_info}</div>}
            {order.delivery_time && <div style={styles.detailRow}><b>🕐 Время:</b> {order.delivery_time}</div>}
            {order.recipient_phone && <div style={styles.detailRow}><b>📱 Телефон:</b> {order.recipient_phone}</div>}
          </div>

          {/* Items */}
          <div style={styles.itemsBlock}>
            <div style={styles.itemsTitle}>Состав заказа:</div>
            {order.items?.map(i => (
              <div key={i.id} style={styles.itemRow}>
                <span>{i.product_name}</span>
                <span style={{ color: '#888' }}>× {i.quantity}</span>
                <span style={{ marginLeft: 'auto' }}>{(i.price * i.quantity)} ₽</span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div style={styles.pricingBlock}>
            {order.bottle_discount > 0 && (
              <div style={styles.priceRow}>
                <span>Скидка за бутылки</span>
                <span style={{ color: '#4caf50' }}>−{order.bottle_discount} ₽</span>
              </div>
            )}
            {order.bonus_used > 0 && (
              <div style={styles.priceRow}>
                <span>Бонусы</span>
                <span style={{ color: '#f57c00' }}>−{order.bonus_used} ₽</span>
              </div>
            )}
            <div style={{ ...styles.priceRow, fontWeight: 700, fontSize: 16 }}>
              <span>Итого</span>
              <span>{order.total} ₽</span>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button style={styles.repeatBtn} onClick={() => onRepeat(order)}>
              🔄 Повторить заказ
            </button>
            {canReview && (
              <button style={styles.reviewBtn} onClick={() => onReview(order.id)}>
                ⭐ Оставить отзыв
              </button>
            )}
            {order.status === 'delivered' && reviewedIds.has(order.id) && (
              <div style={styles.reviewDone}>✅ Отзыв отправлен</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const C = 'var(--tg-theme-button-color, #2481cc)'
const BG = 'var(--tg-theme-secondary-bg-color, #f5f5f5)'
const HINT = 'var(--tg-theme-hint-color, #ddd)'

const styles = {
  list: { padding: '0 0 100px', display: 'flex', flexDirection: 'column', gap: 0 },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, height: '60vh',
    color: '#888', fontSize: 16, textAlign: 'center', padding: '0 24px',
  },
  sectionTitle: {
    padding: '16px 16px 8px', fontSize: 13, fontWeight: 700,
    color: '#888', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: { background: BG, margin: '0 16px 10px', borderRadius: 14, overflow: 'hidden' },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', cursor: 'pointer',
  },
  orderId: { fontWeight: 700, fontSize: 16 },
  status: { fontSize: 13, marginTop: 3, fontWeight: 500 },
  orderTime: { fontSize: 12, color: '#888', marginTop: 2 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 10 },
  total: { fontWeight: 800, fontSize: 16, color: C },
  chevron: { color: '#888', fontSize: 12 },
  details: {
    borderTop: `1px solid ${HINT}`,
    padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12,
  },
  progress: {
    display: 'flex', alignItems: 'center', padding: '0 16px',
    overflowX: 'auto', gap: 0,
  },
  progressItem: { display: 'flex', alignItems: 'center', flex: 1, position: 'relative' },
  progressDot: {
    width: 24, height: 24, borderRadius: '50%',
    background: HINT, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 10, fontWeight: 700,
    color: '#999', flexShrink: 0, zIndex: 1,
  },
  dotActive: { background: C, color: '#fff' },
  dotDone: { background: '#4caf50', color: '#fff' },
  progressLine: { flex: 1, height: 2, background: HINT },
  lineDone: { background: '#4caf50' },
  progressLabel: {
    position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
    fontSize: 9, color: C, fontWeight: 600, whiteSpace: 'nowrap',
  },
  rejected: {
    margin: '0 16px', padding: '10px 14px', background: '#ffebee',
    borderRadius: 10, color: '#c62828', fontSize: 14, fontWeight: 600,
  },
  rejectBox: {
    margin: '0 16px', padding: '10px 14px', background: '#ffebee',
    borderRadius: 10, fontSize: 13, color: '#c62828',
  },
  courierBox: {
    margin: '0 16px', padding: '12px 14px', background: '#e3f2fd',
    borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 4,
  },
  courierTitle: { fontSize: 12, color: '#1565c0', fontWeight: 600 },
  courierName: { fontSize: 15, fontWeight: 700, color: '#0d47a1' },
  callCourier: {
    fontSize: 14, color: C, fontWeight: 600, textDecoration: 'none',
    display: 'inline-block', marginTop: 4,
  },
  infoBlock: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  detailRow: { fontSize: 13, color: '#555', lineHeight: 1.5 },
  itemsBlock: { padding: '0 16px' },
  itemsTitle: { fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600 },
  itemRow: {
    display: 'flex', gap: 8, fontSize: 13, padding: '4px 0',
    borderBottom: `1px solid ${HINT}`,
  },
  pricingBlock: {
    padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  priceRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14 },
  actions: { padding: '4px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' },
  repeatBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${C}`,
    background: 'none', color: C, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  reviewBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
    background: C, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  reviewDone: { fontSize: 13, color: '#4caf50', fontWeight: 600, padding: '10px 0' },
  primaryBtn: {
    marginTop: 8, padding: '12px 24px', background: C, color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
}
