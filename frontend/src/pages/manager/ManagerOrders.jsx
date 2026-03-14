import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers, getNotifications } from '../../api'

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
  new: { bg: '#E3F2FD', color: '#1565c0' },
  awaiting_confirmation: { bg: '#FFF8E1', color: '#e65100' },
  confirmed: { bg: '#E8F5E9', color: '#2d6a4f' },
  assigned_to_courier: { bg: '#EDE7F6', color: '#4527a0' },
  in_delivery: { bg: '#E0F2F1', color: '#00695c' },
  delivered: { bg: '#F1F8E9', color: '#558b2f' },
  rejected: { bg: '#FFEBEE', color: '#c62828' },
}

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'awaiting_confirmation', label: '⏳ Ожидают' },
  { key: 'confirmed', label: '✅ Подтверждены' },
  { key: 'assigned_to_courier', label: '🚴 У курьера' },
  { key: 'in_delivery', label: '🚚 В доставке' },
  { key: 'delivered', label: '✔️ Доставлены' },
  { key: 'rejected', label: '❌ Отклонены' },
]

export default function ManagerOrders() {
  const navigate = useNavigate()
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
  const [paymentNotifs, setPaymentNotifs] = useState([])
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = filter !== 'all' ? { status: filter } : {}
    Promise.all([getOrders(params), getAdminCouriers(), getNotifications()])
      .then(([o, c, notifs]) => {
        setOrders(o)
        setCouriers(c)
        setPaymentNotifs(notifs.filter(n => !n.read && (n.type === 'payment' || n.type === 'topup')))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const act = async (fn) => {
    setActionLoading(true)
    try { await fn(); load() }
    catch { alert('Ошибка операции') }
    finally { setActionLoading(false) }
  }

  const pending = orders.filter(o => ['new', 'awaiting_confirmation'].includes(o.status))
  const active  = orders.filter(o => ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))

  const displayed = search
    ? orders.filter(o =>
        String(o.id).includes(search) ||
        o.address?.toLowerCase().includes(search.toLowerCase()) ||
        o.recipient_phone?.includes(search)
      )
    : orders

  return (
    <ManagerLayout title="Управление заказами">
      {/* Payment notifications banner */}
      {paymentNotifs.length > 0 && (
        <div style={s.notifBanner} onClick={() => navigate('/manager/notifications')}>
          <span style={{ fontSize: 20 }}>💰</span>
          <div style={{ flex: 1 }}>
            <div style={s.notifBannerTitle}>
              {paymentNotifs.length === 1
                ? `${paymentNotifs[0].title}`
                : `${paymentNotifs.length} новых уведомлений об оплате`}
            </div>
            <div style={s.notifBannerDesc}>Нажмите, чтобы посмотреть</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {/* Summary chips */}
      <div style={s.summary}>
        <div style={s.chip}>
          <span style={{ ...s.chipVal, color: '#e65100' }}>{pending.length}</span>
          <span style={s.chipLbl}>Ждут подтв.</span>
        </div>
        <div style={s.chip}>
          <span style={{ ...s.chipVal, color: '#4527a0' }}>{active.length}</span>
          <span style={s.chipLbl}>В работе</span>
        </div>
        <div style={s.chip}>
          <span style={s.chipVal}>{orders.length}</span>
          <span style={s.chipLbl}>Всего</span>
        </div>
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="#888" strokeWidth="1.8"/>
          <path d="m21 21-4.35-4.35" stroke="#888" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <input
          style={s.searchInput}
          placeholder="Поиск по номеру, адресу, телефону..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={s.clearSearch} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Filters */}
      <div style={s.filters}>
        {FILTERS.map(f => (
          <button key={f.key}
            style={{ ...s.filterBtn, ...(filter === f.key ? s.filterActive : {}) }}
            onClick={() => { setFilter(f.key); setSearch('') }}>
            {f.label}
            {f.key === 'awaiting_confirmation' && pending.length > 0 && (
              <span style={s.filterCount}>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : displayed.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 40 }}>📭</div>
          <div style={{ fontWeight: 600, color: '#555' }}>Заказов нет</div>
        </div>
      ) : (
        <div style={s.list}>
          {displayed.map(order => {
            const sc = STATUS_COLORS[order.status] || { bg: '#F5F5F5', color: '#555' }
            const isExpanded = expanded === order.id
            const isUrgent = ['new', 'awaiting_confirmation'].includes(order.status)
            return (
              <div key={order.id} style={{ ...s.card, ...(isUrgent ? s.cardUrgent : {}) }}>
                {/* Card header */}
                <div style={s.cardTop} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    {isUrgent && <div style={s.urgentDot} title="Требует подтверждения" />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={s.orderId}>#{order.id}</span>
                        <span style={{ ...s.statusBadge, background: sc.bg, color: sc.color }}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <div style={s.addr}>{order.address}</div>
                      {order.delivery_time && (
                        <div style={s.time}>🕐 {order.delivery_time}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={s.total}>{(order.total || 0).toLocaleString()} сум</div>
                    {order.bonus_used > 0 && (
                      <div style={s.bonusNote}>🎁 −{order.bonus_used} бон.</div>
                    )}
                    <div style={s.expandIcon}>{isExpanded ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={s.details}>
                    <div style={s.infoGrid}>
                      <div style={s.infoRow}>
                        <span style={s.infoKey}>📱 Телефон</span>
                        <span style={s.infoVal}>{order.recipient_phone || '—'}</span>
                      </div>
                      <div style={s.infoRow}>
                        <span style={s.infoKey}>📍 Адрес</span>
                        <span style={s.infoVal}>{order.address}</span>
                      </div>
                      {order.extra_info && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>🏠 Доп. инфо</span>
                          <span style={s.infoVal}>{order.extra_info}</span>
                        </div>
                      )}
                      {order.return_bottles_count > 0 && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>♻️ Возврат</span>
                          <span style={s.infoVal}>{order.return_bottles_count} бут.</span>
                        </div>
                      )}
                      {order.bottle_discount > 0 && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>💚 Скидка</span>
                          <span style={{ ...s.infoVal, color: '#2d6a4f', fontWeight: 600 }}>
                            −{(order.bottle_discount || 0).toLocaleString()} сум
                          </span>
                        </div>
                      )}
                      <div style={{ ...s.infoRow, borderTop: '1px solid #f0f7f0', paddingTop: 8, marginTop: 4 }}>
                        <span style={{ ...s.infoKey, fontWeight: 700 }}>💰 Итого</span>
                        <span style={{ ...s.infoVal, fontWeight: 800, fontSize: 16 }}>
                          {(order.total || 0).toLocaleString()} сум
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    {order.items?.length > 0 && (
                      <div style={s.itemsWrap}>
                        <div style={s.itemsTitle}>Состав заказа</div>
                        {order.items.map(i => (
                          <div key={i.id} style={s.itemRow}>
                            <span style={s.itemName}>🔹 {i.product_name}</span>
                            <span style={s.itemQty}>× {i.quantity}</span>
                            <span style={s.itemPrice}>{((i.price || 0) * i.quantity).toLocaleString()} сум</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={s.actions}>
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          <button style={s.btnGreen} disabled={actionLoading}
                            onClick={() => act(() => confirmOrder(order.id))}>
                            ✅ Подтвердить
                          </button>
                          <button style={s.btnRed} disabled={actionLoading}
                            onClick={() => { setRejectingId(order.id); setRejectReason('') }}>
                            ❌ Отклонить
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button style={s.btnPurple}
                          onClick={() => { setAssigningId(order.id); setSelectedCourier('') }}>
                          🚴 Назначить курьера
                        </button>
                      )}
                      {order.recipient_phone && (
                        <a href={`tel:${order.recipient_phone}`} style={s.btnCall}>
                          📞 Позвонить
                        </a>
                      )}
                      {order.latitude && (
                        <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                          target="_blank" rel="noopener noreferrer" style={s.btnMap}>
                          🗺️ Карта
                        </a>
                      )}
                    </div>

                    {/* Reject form */}
                    {rejectingId === order.id && (
                      <div style={s.inlineForm}>
                        <div style={s.formLabel}>Причина отказа:</div>
                        <input style={s.inp}
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Нет в наличии, неверный адрес..."
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={s.btnGhost} onClick={() => setRejectingId(null)}>Отмена</button>
                          <button style={s.btnRed} disabled={actionLoading || !rejectReason.trim()}
                            onClick={() => act(() => rejectOrder(order.id, rejectReason).then(() => setRejectingId(null)))}>
                            Отклонить
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Assign courier form */}
                    {assigningId === order.id && (
                      <div style={s.inlineForm}>
                        <div style={s.formLabel}>Выберите курьера:</div>
                        <select style={s.inp} value={selectedCourier}
                          onChange={e => setSelectedCourier(e.target.value)}>
                          <option value="">— Выберите курьера —</option>
                          {couriers.filter(c => c.is_active !== false).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={s.btnGhost} onClick={() => setAssigningId(null)}>Отмена</button>
                          <button style={s.btnPurple} disabled={actionLoading || !selectedCourier}
                            onClick={() => act(() => assignCourier(order.id, selectedCourier).then(() => setAssigningId(null)))}>
                            Назначить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ManagerLayout>
  )
}

const G = '#2d6a4f'
const s = {
  notifBanner: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#E8F5E9', borderRadius: 12, padding: '12px 16px',
    marginBottom: 12, cursor: 'pointer',
    border: '1px solid #b7e4c7',
    boxShadow: '0 2px 8px rgba(141,198,63,0.15)',
    WebkitTapHighlightColor: 'transparent',
  },
  notifBannerTitle: { fontWeight: 700, fontSize: 14, color: '#1b4332' },
  notifBannerDesc: { fontSize: 12, color: '#2d6a4f' },
  summary: { display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' },
  chip: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '12px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #e8f5e9',
  },
  chipVal: { fontSize: 24, fontWeight: 800, color: G, lineHeight: 1 },
  chipLbl: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 10,
    background: '#fff', border: '1px solid #e8f5e9',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: G, flexShrink: 0,
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1px solid #e0f0e8', borderRadius: 12,
    padding: '10px 14px', marginBottom: 12,
  },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: '#1C1C1E' },
  clearSearch: { border: 'none', background: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: '0 2px' },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  filterBtn: {
    padding: '6px 12px', borderRadius: 20, border: '1px solid #b7e4c7',
    background: '#fff', color: G, fontSize: 12, cursor: 'pointer', fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
  filterActive: { background: G, color: '#fff', border: `1px solid ${G}` },
  filterCount: {
    background: '#FF3B30', color: '#fff',
    borderRadius: 999, fontSize: 10, fontWeight: 800,
    minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
  },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 30, height: 30, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: '3px solid #8DC63F',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: { textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background: '#fff', borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #e8f5e9',
  },
  cardUrgent: {
    border: '1.5px solid #b7e4c7',
    boxShadow: '0 2px 8px rgba(141,198,63,0.12)',
  },
  cardTop: {
    display: 'flex', justifyContent: 'space-between', gap: 10,
    padding: '12px 14px', cursor: 'pointer', alignItems: 'flex-start',
    WebkitTapHighlightColor: 'transparent',
  },
  urgentDot: { width: 9, height: 9, borderRadius: '50%', background: '#e65100', flexShrink: 0, marginTop: 6 },
  orderId: { fontWeight: 700, fontSize: 15, color: G },
  statusBadge: { fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700 },
  addr: { fontSize: 12, color: '#555', marginTop: 3 },
  time: { fontSize: 11, color: '#888', marginTop: 2 },
  total: { fontWeight: 800, fontSize: 16, color: G },
  bonusNote: { fontSize: 10, color: '#888', textAlign: 'right' },
  expandIcon: { fontSize: 10, color: '#aaa', marginTop: 4, textAlign: 'right' },
  details: { borderTop: '1px solid #f0f7f0', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  infoRow: { display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' },
  infoKey: { fontSize: 12, color: '#888', minWidth: 100, flexShrink: 0 },
  infoVal: { fontSize: 13, color: '#333', flex: 1 },
  itemsWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  itemsTitle: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  itemRow: { display: 'flex', gap: 8, fontSize: 13, alignItems: 'center', borderBottom: '1px solid #f5f5f5', paddingBottom: 4 },
  itemName: { flex: 1, color: '#333' },
  itemQty: { color: '#888', flexShrink: 0 },
  itemPrice: { fontWeight: 600, color: G, flexShrink: 0 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnGreen: { padding: '8px 14px', borderRadius: 8, border: 'none', background: G, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  btnRed: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#c62828', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  btnPurple: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4527a0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  btnCall: { padding: '8px 12px', borderRadius: 8, border: `1px solid ${G}`, background: '#fff', color: G, fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' },
  btnMap: { padding: '8px 12px', borderRadius: 8, border: '1px solid #1565c0', background: '#fff', color: '#1565c0', fontSize: 13, fontWeight: 600, textDecoration: 'none' },
  btnGhost: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  inlineForm: { background: '#f5faf7', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  formLabel: { fontSize: 12, fontWeight: 700, color: '#333' },
  inp: { border: '1px solid #b7e4c7', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', color: '#1C1C1E' },
}
