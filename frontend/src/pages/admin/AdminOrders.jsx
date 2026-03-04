import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers } from '../../api'

const STATUS_LABELS = {
  new: 'Новый',
  awaiting_confirmation: 'Ожид. подтв.',
  confirmed: 'Подтверждён',
  assigned_to_courier: 'У курьера',
  in_delivery: 'В доставке',
  delivered: 'Доставлен',
  rejected: 'Отклонён',
}
const STATUS_COLORS = {
  new: '#1565c0',
  awaiting_confirmation: '#f57f17',
  confirmed: '#2e7d32',
  assigned_to_courier: '#4527a0',
  in_delivery: '#00695c',
  delivered: '#558b2f',
  rejected: '#c62828',
}
const FILTERS = ['all', 'new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery', 'delivered', 'rejected']

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [couriers, setCouriers] = useState([])
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [assigningId, setAssigningId] = useState(null)
  const [selectedCourier, setSelectedCourier] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = () => {
    setLoading(true)
    const params = filter !== 'all' ? { status: filter } : {}
    Promise.all([getOrders(params), getAdminCouriers()])
      .then(([o, c]) => { setOrders(o); setCouriers(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [filter])

  const doConfirm = async (orderId) => {
    setActionLoading(true)
    try {
      await confirmOrder(orderId)
      load()
    } catch { alert('Ошибка') } finally { setActionLoading(false) }
  }

  const doReject = async (orderId) => {
    if (!rejectReason.trim()) { alert('Введите причину'); return }
    setActionLoading(true)
    try {
      await rejectOrder(orderId, rejectReason)
      setRejectingId(null); setRejectReason(''); load()
    } catch { alert('Ошибка') } finally { setActionLoading(false) }
  }

  const doAssign = async (orderId) => {
    if (!selectedCourier) { alert('Выберите курьера'); return }
    setActionLoading(true)
    try {
      await assignCourier(orderId, selectedCourier)
      setAssigningId(null); setSelectedCourier(''); load()
    } catch { alert('Ошибка') } finally { setActionLoading(false) }
  }

  return (
    <AdminLayout title="Заказы">
      {/* Filters */}
      <div style={styles.filters}>
        {FILTERS.map(f => (
          <button
            key={f}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Все' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.center}>Загрузка...</div>
      ) : orders.length === 0 ? (
        <div style={styles.center}>Заказов нет</div>
      ) : (
        <div style={styles.list}>
          {orders.map(order => (
            <div key={order.id} style={styles.card}>
              {/* Header */}
              <div style={styles.cardTop} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
                <div>
                  <div style={styles.orderId}>Заказ #{order.id}</div>
                  <div style={styles.orderAddr}>{order.address}</div>
                  {order.delivery_time && <div style={styles.orderTime}>🕐 {order.delivery_time}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={styles.orderTotal}>{order.total} сум</div>
                  <span style={{ ...styles.statusChip, background: (STATUS_COLORS[order.status] || '#888') + '22', color: STATUS_COLORS[order.status] || '#888' }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <div style={styles.chevron}>{expanded === order.id ? '▲' : '▼'}</div>
                </div>
              </div>

              {/* Details */}
              {expanded === order.id && (
                <div style={styles.details}>
                  <div style={styles.infoGrid}>
                    <div><b>📱 Телефон:</b> {order.recipient_phone || '—'}</div>
                    <div><b>📍 Адрес:</b> {order.address}</div>
                    {order.extra_info && <div><b>🏠 Инфо:</b> {order.extra_info}</div>}
                    {order.return_bottles_count > 0 && (
                      <div><b>♻️ Возврат:</b> {order.return_bottles_count} бут. ({order.return_bottles_volume} л)</div>
                    )}
                    <div><b>💰 Итого:</b> {order.total} сум {order.bottle_discount > 0 ? `(скидка: −${order.bottle_discount} сум)` : ''}</div>
                    {order.rejection_reason && <div style={{ color: '#c62828' }}><b>Причина отказа:</b> {order.rejection_reason}</div>}
                  </div>

                  {/* Items */}
                  {order.items?.length > 0 && (
                    <div style={styles.itemsBlock}>
                      <b>Состав:</b>
                      {order.items.map(i => (
                        <div key={i.id} style={styles.itemRow}>
                          {i.product_name} × {i.quantity} — {i.price * i.quantity} сум
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={styles.actions}>
                    {order.status === 'awaiting_confirmation' && (
                      <>
                        <button style={styles.confirmBtn} disabled={actionLoading}
                          onClick={() => doConfirm(order.id)}>✅ Подтвердить</button>
                        <button style={styles.rejectBtn} disabled={actionLoading}
                          onClick={() => setRejectingId(order.id)}>❌ Отклонить</button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <button style={styles.assignBtn}
                        onClick={() => setAssigningId(order.id)}>🚴 Назначить курьера</button>
                    )}
                    {order.recipient_phone && (
                      <a href={`tel:${order.recipient_phone}`} style={styles.callBtn}>📞 Позвонить</a>
                    )}
                  </div>

                  {/* Reject modal */}
                  {rejectingId === order.id && (
                    <div style={styles.inlineModal}>
                      <b style={{ fontSize: 14 }}>Причина отказа:</b>
                      <input style={styles.input} value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Нет в наличии, неверный адрес..." />
                      <div style={styles.modalActions}>
                        <button style={styles.cancelBtn} onClick={() => setRejectingId(null)}>Отмена</button>
                        <button style={styles.rejectBtn} onClick={() => doReject(order.id)} disabled={actionLoading}>
                          Отклонить
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Assign courier modal */}
                  {assigningId === order.id && (
                    <div style={styles.inlineModal}>
                      <b style={{ fontSize: 14 }}>Выберите курьера:</b>
                      <select style={styles.select} value={selectedCourier}
                        onChange={e => setSelectedCourier(e.target.value)}>
                        <option value="">— Выберите —</option>
                        {couriers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.delivery_count} доставок)</option>
                        ))}
                      </select>
                      <div style={styles.modalActions}>
                        <button style={styles.cancelBtn} onClick={() => setAssigningId(null)}>Отмена</button>
                        <button style={styles.assignBtn} onClick={() => doAssign(order.id)} disabled={actionLoading}>
                          Назначить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const styles = {
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  filterBtn: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #c5cae9',
    background: '#fff', color: '#3949ab', fontSize: 13, cursor: 'pointer',
  },
  filterActive: { background: '#1a237e', color: '#fff', border: '1px solid #1a237e' },
  center: { textAlign: 'center', padding: 60, color: '#888', fontSize: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '16px 20px', cursor: 'pointer',
  },
  orderId: { fontWeight: 700, fontSize: 16, color: '#1a237e' },
  orderAddr: { fontSize: 13, color: '#555', marginTop: 3 },
  orderTime: { fontSize: 12, color: '#888', marginTop: 2 },
  orderTotal: { fontWeight: 800, fontSize: 18, color: '#1565c0' },
  statusChip: { fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, display: 'inline-block', marginTop: 4 },
  chevron: { color: '#888', fontSize: 12, marginTop: 4 },
  details: {
    borderTop: '1px solid #f0f0f0', padding: '14px 20px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#333' },
  itemsBlock: { fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4 },
  itemRow: { paddingLeft: 12, color: '#555' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  confirmBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  rejectBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#c62828', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  assignBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#4527a0', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  callBtn: {
    padding: '9px 18px', borderRadius: 8, border: '1px solid #1565c0',
    background: '#fff', color: '#1565c0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    textDecoration: 'none', display: 'inline-block',
  },
  inlineModal: {
    background: '#f5f5f5', borderRadius: 10, padding: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  input: {
    border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px',
    fontSize: 14, outline: 'none', background: '#fff',
  },
  select: {
    border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px',
    fontSize: 14, outline: 'none', background: '#fff',
  },
  modalActions: { display: 'flex', gap: 8 },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd',
    background: '#fff', color: '#333', fontSize: 14, cursor: 'pointer',
  },
}
