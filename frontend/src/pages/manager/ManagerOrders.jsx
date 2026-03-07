import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers } from '../../api'

const STATUS_LABELS = {
  new: 'Новый', awaiting_confirmation: 'Ожид. подтв.', confirmed: 'Подтверждён',
  assigned_to_courier: 'У курьера', in_delivery: 'В доставке',
  delivered: 'Доставлен', rejected: 'Отклонён',
}
const STATUS_COLORS = {
  new: '#1565c0', awaiting_confirmation: '#f57f17', confirmed: '#2d6a4f',
  assigned_to_courier: '#4527a0', in_delivery: '#00695c',
  delivered: '#33691e', rejected: '#c62828',
}
const FILTERS = ['all', 'new', 'awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery', 'delivered', 'rejected']

export default function ManagerOrders() {
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

  const act = async (fn) => {
    setActionLoading(true)
    try { await fn(); load() }
    catch { alert('Ошибка') }
    finally { setActionLoading(false) }
  }

  const pending = orders.filter(o => ['new', 'awaiting_confirmation'].includes(o.status))
  const active = orders.filter(o => ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))

  return (
    <ManagerLayout title="Управление заказами">
      {/* Summary chips */}
      <div style={s.summary}>
        <div style={s.chip}><span style={s.chipVal}>{pending.length}</span><span style={s.chipLbl}>Требуют внимания</span></div>
        <div style={s.chip}><span style={s.chipVal}>{active.length}</span><span style={s.chipLbl}>В работе</span></div>
        <div style={s.chip}><span style={s.chipVal}>{orders.length}</span><span style={s.chipLbl}>Всего</span></div>
      </div>

      {/* Filters */}
      <div style={s.filters}>
        {FILTERS.map(f => (
          <button key={f}
            style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'Все' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? <div style={s.center}>Загрузка...</div> : orders.length === 0 ? (
        <div style={s.center}>Заказов нет</div>
      ) : (
        <div style={s.list}>
          {orders.map(order => (
            <div key={order.id} style={s.card}>
              <div style={s.cardTop} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {['new', 'awaiting_confirmation'].includes(order.status) && (
                    <div style={s.urgentDot} title="Требует подтверждения" />
                  )}
                  <div>
                    <div style={s.orderId}>#{order.id}</div>
                    <div style={s.addr}>{order.address}</div>
                    {order.delivery_time && <div style={s.time}>🕐 {order.delivery_time}</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={s.total}>{order.total} сум</div>
                  <span style={{ ...s.statusBadge, background: (STATUS_COLORS[order.status] || '#888') + '20', color: STATUS_COLORS[order.status] || '#888' }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
              </div>

              {expanded === order.id && (
                <div style={s.details}>
                  <div style={s.infoGrid}>
                    <div>📱 <b>Тел:</b> {order.recipient_phone || '—'}</div>
                    <div>📍 <b>Адрес:</b> {order.address}</div>
                    {order.extra_info && <div>🏠 {order.extra_info}</div>}
                    {order.return_bottles_count > 0 && <div>♻️ Возврат: {order.return_bottles_count} бут.</div>}
                    {order.bottle_discount > 0 && <div style={{ color: '#2d6a4f' }}>💚 Скидка: −{order.bottle_discount} сум</div>}
                    <div>💰 <b>Итого:</b> {order.total} сум</div>
                  </div>

                  {order.items?.length > 0 && (
                    <div style={s.items}>
                      {order.items.map(i => (
                        <div key={i.id} style={s.itemRow}>
                          <span>🔹 {i.product_name}</span>
                          <span style={{ color: '#888' }}>× {i.quantity}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{i.price * i.quantity} сум</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={s.actions}>
                    {order.status === 'awaiting_confirmation' && (
                      <>
                        <button style={s.btnGreen} disabled={actionLoading}
                          onClick={() => act(() => confirmOrder(order.id))}>✅ Подтвердить</button>
                        <button style={s.btnRed} disabled={actionLoading}
                          onClick={() => setRejectingId(order.id)}>❌ Отклонить</button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <button style={s.btnPurple} onClick={() => setAssigningId(order.id)}>
                        🚴 Назначить курьера
                      </button>
                    )}
                    {order.recipient_phone && (
                      <a href={`tel:${order.recipient_phone}`} style={s.btnCall}>📞 Позвонить</a>
                    )}
                    {order.latitude && (
                      <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                        target="_blank" rel="noopener noreferrer" style={s.btnMap}>🗺️ Карта</a>
                    )}
                  </div>

                  {rejectingId === order.id && (
                    <div style={s.inline}>
                      <b style={{ fontSize: 13 }}>Причина отказа:</b>
                      <input style={s.inp} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Нет в наличии..." />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={s.btnGhost} onClick={() => setRejectingId(null)}>Отмена</button>
                        <button style={s.btnRed} disabled={actionLoading}
                          onClick={() => act(() => rejectOrder(order.id, rejectReason))}>
                          Отклонить
                        </button>
                      </div>
                    </div>
                  )}

                  {assigningId === order.id && (
                    <div style={s.inline}>
                      <b style={{ fontSize: 13 }}>Выберите курьера:</b>
                      <select style={s.inp} value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)}>
                        <option value="">— Выберите —</option>
                        {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={s.btnGhost} onClick={() => setAssigningId(null)}>Отмена</button>
                        <button style={s.btnPurple} disabled={actionLoading}
                          onClick={() => act(() => assignCourier(order.id, selectedCourier))}>
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
    </ManagerLayout>
  )
}

const GREEN = '#2d6a4f'
const s = {
  summary: { display: 'flex', gap: 12, marginBottom: 20 },
  chip: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e0f0e8',
  },
  chipVal: { fontSize: 26, fontWeight: 800, color: GREEN },
  chipLbl: { fontSize: 11, color: '#888', marginTop: 2 },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  filterBtn: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #b7e4c7',
    background: '#fff', color: GREEN, fontSize: 13, cursor: 'pointer',
  },
  filterActive: { background: GREEN, color: '#fff', border: `1px solid ${GREEN}` },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e8f5e9' },
  cardTop: { display: 'flex', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', alignItems: 'flex-start' },
  urgentDot: { width: 10, height: 10, borderRadius: '50%', background: '#f57f17', flexShrink: 0, marginTop: 6 },
  orderId: { fontWeight: 700, fontSize: 16, color: GREEN },
  addr: { fontSize: 13, color: '#555', marginTop: 2 },
  time: { fontSize: 12, color: '#888', marginTop: 2 },
  total: { fontWeight: 800, fontSize: 17, color: GREEN },
  statusBadge: { fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, display: 'inline-block', marginTop: 4 },
  details: { borderTop: '1px solid #f0f7f0', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#333' },
  items: { display: 'flex', flexDirection: 'column', gap: 4 },
  itemRow: { display: 'flex', gap: 8, fontSize: 13, borderBottom: '1px solid #f5f5f5', paddingBottom: 4 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnGreen: { padding: '8px 16px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnRed: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#c62828', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnPurple: { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4527a0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnCall: { padding: '8px 14px', borderRadius: 8, border: `1px solid ${GREEN}`, background: '#fff', color: GREEN, fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' },
  btnMap: { padding: '8px 14px', borderRadius: 8, border: '1px solid #1565c0', background: '#fff', color: '#1565c0', fontSize: 13, fontWeight: 600, textDecoration: 'none' },
  btnGhost: { padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer' },
  inline: { background: '#f5faf7', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  inp: { border: '1px solid #b7e4c7', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#fff' },
}
