import { useEffect, useState } from 'react'
import { getUserByTelegram, getUserOrders } from '../api'

const tg = window.Telegram?.WebApp

const STATUS_LABELS = {
  new: '🆕 Новый',
  awaiting_confirmation: '⏳ Ожидает подтверждения',
  confirmed: '✅ Подтвержден',
  assigned_to_courier: '🚚 Передан курьеру',
  in_delivery: '🚴 В доставке',
  delivered: '✔️ Доставлен',
  rejected: '❌ Отклонен',
}

export default function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (!tgUser?.id) { setLoading(false); return }

    getUserByTelegram(tgUser.id)
      .then(user => getUserOrders(user.id))
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={styles.center}>Загрузка...</div>
  if (!orders.length) return <div style={styles.center}>История заказов пуста</div>

  return (
    <div style={styles.list}>
      {orders.map(order => (
        <div key={order.id} style={styles.card}>
          <div style={styles.cardHeader} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
            <div>
              <div style={styles.orderId}>Заказ #{order.id}</div>
              <div style={styles.status}>{STATUS_LABELS[order.status] || order.status}</div>
            </div>
            <div style={styles.cardRight}>
              <div style={styles.total}>{order.total} ₽</div>
              <div style={styles.chevron}>{expanded === order.id ? '▲' : '▼'}</div>
            </div>
          </div>

          {expanded === order.id && (
            <div style={styles.details}>
              <div style={styles.detailRow}><b>Адрес:</b> {order.address}</div>
              {order.delivery_time && <div style={styles.detailRow}><b>Время:</b> {order.delivery_time}</div>}
              {order.rejection_reason && <div style={styles.detailRow}><b>Причина отказа:</b> {order.rejection_reason}</div>}
              <div style={styles.items}>
                {order.items.map(i => (
                  <div key={i.id} style={styles.itemRow}>
                    {i.product_name} × {i.quantity} — {i.price * i.quantity} ₽
                  </div>
                ))}
              </div>
              <div style={styles.detailRow}><b>Скидка за бутылки:</b> −{order.bottle_discount} ₽</div>
              <div style={styles.detailRow}><b>Итого:</b> {order.total} ₽</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const styles = {
  list: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  center: { textAlign: 'center', padding: 40, color: '#888' },
  card: {
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 12, overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', cursor: 'pointer',
  },
  orderId: { fontWeight: 600, fontSize: 16 },
  status: { color: '#666', fontSize: 13, marginTop: 2 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 10 },
  total: { fontWeight: 700, fontSize: 16, color: 'var(--tg-theme-button-color, #2481cc)' },
  chevron: { color: '#888' },
  details: {
    borderTop: '1px solid var(--tg-theme-hint-color, #ddd)',
    padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  detailRow: { fontSize: 14 },
  items: { display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0' },
  itemRow: { fontSize: 14, paddingLeft: 12 },
}
