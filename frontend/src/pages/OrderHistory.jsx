import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram, getUserOrders, getOrder } from '../api'
import { useCartStore } from '../store'
import { useAuthStore } from '../store/auth'
import ReviewModal from '../components/ReviewModal'
import { SkeletonOrderCard } from '../components/Skeleton'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

const STATUSES = [
  { key: 'new', label: 'Новый' },
  { key: 'awaiting_confirmation', label: 'Ожидает подтверждения' },
  { key: 'confirmed', label: 'Подтверждён' },
  { key: 'assigned_to_courier', label: 'Передан курьеру' },
  { key: 'in_delivery', label: 'В доставке' },
  { key: 'delivered', label: 'Доставлен' },
  { key: 'rejected', label: 'Отклонён' },
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

const STATUS_STYLE = {
  new: { bg: '#EDF3FF', color: '#3B5BDB' },
  awaiting_confirmation: { bg: '#FFF8E6', color: '#E67700' },
  confirmed: { bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier: { bg: '#F3F0FF', color: '#6741D9' },
  in_delivery: { bg: '#F3F0FF', color: '#6741D9' },
  delivered: { bg: '#EBFBEE', color: '#2B8A3E' },
  rejected: { bg: '#FFF5F5', color: '#E03131' },
}

const ACTIVE_STATUSES = new Set(['new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'])

function StatusProgress({ status }) {
  if (status === 'rejected') return (
    <div style={styles.rejected}>Заказ отклонён</div>
  )
  const current = STATUS_STEP[status] || 0
  const steps = STATUSES.filter(s => s.key !== 'rejected')
  return (
    <div style={styles.progress}>
      {steps.map((st, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <div key={st.key} style={styles.progressItem}>
            <div style={{
              ...styles.progressDot,
              ...(done ? styles.dotDone : active ? styles.dotActive : {}),
            }}>
              {done ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span style={{ fontSize: 8, fontWeight: 800 }}>{step}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ ...styles.progressLine, ...(done ? styles.lineDone : {}) }} />
            )}
            {active && <div style={styles.progressLabel}>{st.label}</div>}
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
  const { user: authUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    const load = async () => {
      try {
        let userId
        if (tgUser?.id) {
          const u = await getUserByTelegram(tgUser.id)
          userId = u.id
        } else if (authUser?.id) {
          userId = authUser.id
        } else {
          return
        }
        const list = await getUserOrders(userId)
        setOrders(list.sort((a, b) => b.id - a.id))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authUser])

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

  if (loading) return (
    <div style={styles.list}>
      <div style={styles.sectionTitle}>Загрузка...</div>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonOrderCard key={i} />
      ))}
    </div>
  )

  if (!orders.length) return (
    <div style={styles.center}>
      <div style={styles.emptyIconWrap}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="16" rx="3" fill="#F2F2F7" stroke="#C7C7CC" strokeWidth="1.5"/>
          <path d="M7 9h10M7 13h6" stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: TEXT }}>Нет заказов</div>
      <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>У вас пока нет заказов</div>
      <button style={styles.primaryBtn} onClick={() => navigate('/')}>
        Перейти в каталог
      </button>
    </div>
  )

  const active = orders.filter(o => ACTIVE_STATUSES.has(o.status))
  const archived = orders.filter(o => !ACTIVE_STATUSES.has(o.status))

  return (
    <div style={styles.list}>
      {active.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Активные</div>
          {active.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded}
              setExpanded={setExpanded}
              onRepeat={repeatOrder}
              onReview={setReviewOrderId}
              reviewedIds={reviewedIds}
            />
          ))}
        </>
      )}
      {archived.length > 0 && (
        <>
          <div style={styles.sectionTitle}>История</div>
          {archived.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded}
              setExpanded={setExpanded}
              onRepeat={repeatOrder}
              onReview={setReviewOrderId}
              reviewedIds={reviewedIds}
            />
          ))}
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
  const statusInfo = STATUSES.find(s => s.key === order.status) || { label: order.status }
  const statusStyle = STATUS_STYLE[order.status] || { bg: '#F2F2F7', color: TEXT2 }
  const canReview = order.status === 'delivered' && !reviewedIds.has(order.id) && !order.review_id

  return (
    <div style={styles.card}>
      <div
        style={styles.cardHeader}
        onClick={() => setExpanded(e => e === order.id ? null : order.id)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.orderId}>Заказ #{order.id}</div>
          <div style={{ marginTop: 5 }}>
            <span style={{ ...styles.statusPill, background: statusStyle.bg, color: statusStyle.color }}>
              {statusInfo.label}
            </span>
          </div>
          {order.delivery_time && (
            <div style={styles.orderTime}>{order.delivery_time}</div>
          )}
        </div>
        <div style={styles.cardRight}>
          <div style={styles.total}>{order.total} сум</div>
          <div style={styles.chevron}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: TRANSITION }}>
              <path d="M6 9l6 6 6-6" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div style={styles.details}>
          {/* Status progress */}
          <StatusProgress status={order.status} />

          {/* Rejection reason */}
          {order.rejection_reason && (
            <div style={styles.rejectBox}>
              <strong>Причина отказа:</strong> {order.rejection_reason}
            </div>
          )}

          {/* Courier info */}
          {(order.status === 'assigned_to_courier' || order.status === 'in_delivery') && order.courier_name && (
            <div style={styles.courierBox}>
              <div style={styles.courierTitle}>Ваш курьер</div>
              <div style={styles.courierName}>{order.courier_name}</div>
              {order.courier_phone && (
                <a href={`tel:${order.courier_phone}`} style={styles.callCourier}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="#007AFF"/>
                  </svg>
                  Позвонить курьеру
                </a>
              )}
            </div>
          )}

          {/* Address & info */}
          <div style={styles.infoBlock}>
            {order.address && (
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Адрес</span>
                <span style={styles.detailVal}>{order.address}</span>
              </div>
            )}
            {order.extra_info && (
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Доп. инфо</span>
                <span style={styles.detailVal}>{order.extra_info}</span>
              </div>
            )}
            {order.delivery_time && (
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Время</span>
                <span style={styles.detailVal}>{order.delivery_time}</span>
              </div>
            )}
            {order.recipient_phone && (
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Телефон</span>
                <span style={styles.detailVal}>{order.recipient_phone}</span>
              </div>
            )}
          </div>

          {/* Items */}
          {order.items?.length > 0 && (
            <div style={styles.itemsBlock}>
              <div style={styles.itemsTitle}>Состав заказа</div>
              {order.items.map(i => (
                <div key={i.id} style={styles.itemRow}>
                  <span style={{ flex: 1, color: TEXT }}>{i.product_name}</span>
                  <span style={{ color: TEXT2 }}>× {i.quantity}</span>
                  <span style={{ fontWeight: 700, color: TEXT, minWidth: 80, textAlign: 'right' }}>
                    {(i.price * i.quantity).toLocaleString()} сум
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pricing */}
          <div style={styles.pricingBlock}>
            {order.bottle_discount > 0 && (
              <div style={styles.priceRow}>
                <span>Скидка за бутылки</span>
                <span style={{ color: '#2B8A3E', fontWeight: 600 }}>−{order.bottle_discount} сум</span>
              </div>
            )}
            {order.bonus_used > 0 && (
              <div style={styles.priceRow}>
                <span>Бонусы</span>
                <span style={{ color: '#E67700', fontWeight: 600 }}>−{order.bonus_used} сум</span>
              </div>
            )}
            <div style={{ ...styles.priceRow, fontWeight: 700, fontSize: 16, color: TEXT }}>
              <span>Итого</span>
              <span style={{ color: C }}>{order.total} сум</span>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button style={styles.repeatBtn} onClick={() => onRepeat(order)}>
              Повторить заказ
            </button>
            {canReview && (
              <button style={styles.reviewBtn} onClick={() => onReview(order.id)}>
                Оставить отзыв
              </button>
            )}
            {order.status === 'delivered' && reviewedIds.has(order.id) && (
              <div style={styles.reviewDone}>Отзыв отправлен</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  list: {
    padding: '12px 0 100px',
    display: 'flex',
    flexDirection: 'column',
    background: BG,
    minHeight: '100vh',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: '65vh',
    padding: '0 24px',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${BORDER}`,
    marginBottom: 4,
  },
  sectionTitle: {
    padding: '10px 16px 6px',
    fontSize: 13,
    fontWeight: 700,
    color: TEXT2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    background: '#FFFFFF',
    margin: '0 16px 10px',
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 16px',
    cursor: 'pointer',
    gap: 12,
  },
  orderId: {
    fontWeight: 700,
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.2,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },
  orderTime: {
    fontSize: 12,
    color: TEXT2,
    marginTop: 4,
    fontWeight: 400,
  },
  cardRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  total: {
    fontWeight: 800,
    fontSize: 16,
    color: C,
  },
  chevron: {
    display: 'flex',
    alignItems: 'center',
  },
  details: {
    borderTop: `1px solid ${BORDER}`,
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 16px 20px',
    overflowX: 'auto',
    gap: 0,
  },
  progressItem: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  progressDot: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: '#F2F2F7',
    border: `2px solid ${BORDER}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: TEXT2,
    flexShrink: 0,
    zIndex: 1,
  },
  dotActive: {
    background: C,
    border: `2px solid ${CD}`,
    color: '#fff',
  },
  dotDone: {
    background: CD,
    border: `2px solid #4E7A20`,
    color: '#fff',
  },
  progressLine: {
    flex: 1,
    height: 2,
    background: '#E5E5EA',
  },
  lineDone: {
    background: CD,
  },
  progressLabel: {
    position: 'absolute',
    top: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 9,
    color: C,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  rejected: {
    margin: '0 16px',
    padding: '10px 14px',
    background: '#FFF5F5',
    borderRadius: 12,
    color: '#E03131',
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid #FFCDD2',
  },
  rejectBox: {
    margin: '0 16px',
    padding: '10px 14px',
    background: '#FFF5F5',
    borderRadius: 12,
    fontSize: 13,
    color: '#E03131',
    border: '1px solid #FFCDD2',
  },
  courierBox: {
    margin: '0 16px',
    padding: '12px 14px',
    background: '#EFF6FF',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    border: '1px solid #BFDBFE',
  },
  courierTitle: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  courierName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1E3A8A',
  },
  callCourier: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    background: '#DBEAFE',
    borderRadius: 8,
    padding: '6px 12px',
    alignSelf: 'flex-start',
  },
  infoBlock: {
    padding: '0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.4,
  },
  detailKey: {
    color: TEXT2,
    fontWeight: 500,
    flexShrink: 0,
    width: 70,
  },
  detailVal: {
    color: TEXT,
    fontWeight: 500,
  },
  itemsBlock: {
    padding: '0 16px',
  },
  itemsTitle: {
    fontSize: 11,
    color: TEXT2,
    marginBottom: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
    padding: '8px 0',
    borderBottom: `1px solid ${BORDER}`,
  },
  pricingBlock: {
    margin: '0 16px',
    background: BG,
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: TEXT2,
  },
  actions: {
    padding: '4px 16px',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  repeatBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 12,
    border: `1.5px solid ${C}`,
    background: 'none',
    color: C,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: TRANSITION,
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
    boxShadow: '0 4px 12px rgba(141,198,63,0.3)',
    transition: TRANSITION,
  },
  reviewDone: {
    fontSize: 13,
    color: CD,
    fontWeight: 700,
    padding: '10px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  primaryBtn: {
    marginTop: 8,
    padding: '13px 28px',
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.3)',
  },
}
