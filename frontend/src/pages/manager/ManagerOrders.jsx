import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers, getNotifications } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#e4e4e8'
const BORDER = 'rgba(60,60,67,0.12)'

const STATUS_LABELS = {
  new: 'Новый',
  awaiting_confirmation: 'Ожидает',
  confirmed: 'Подтверждён',
  assigned_to_courier: 'У курьера',
  in_delivery: 'В доставке',
  delivered: 'Доставлен',
  rejected: 'Отклонён',
}

const STATUS_STYLE = {
  new:                   { bg: '#EDF3FF', color: '#3B5BDB' },
  awaiting_confirmation: { bg: '#FFF8E6', color: '#E67700' },
  confirmed:             { bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier:   { bg: '#F3F0FF', color: '#6741D9' },
  in_delivery:           { bg: '#E8F4FD', color: '#1971C2' },
  delivered:             { bg: '#EBFBEE', color: '#2B8A3E' },
  rejected:              { bg: '#FFF5F5', color: '#E03131' },
}

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'awaiting_confirmation', label: 'Ожидают' },
  { key: 'confirmed', label: 'Подтверждены' },
  { key: 'assigned_to_courier', label: 'У курьера' },
  { key: 'in_delivery', label: 'В доставке' },
  { key: 'delivered', label: 'Доставлены' },
  { key: 'rejected', label: 'Отклонены' },
]

// SVG Icons
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/>
  </svg>
)
const IconMap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
  </svg>
)
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IconRefresh = ({ spin }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: spin ? 'spin 0.8s linear infinite' : 'none' }}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke={TEXT2} strokeWidth="1.8"/>
    <path d="m21 21-4.35-4.35" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IconChevron = ({ up }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: up ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={TEXT} strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={TEXT} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
)


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
    <ManagerLayout title="Заказы">
      {/* Payment notification banner */}
      {paymentNotifs.length > 0 && (
        <div style={s.notifBanner} onClick={() => navigate('/manager/notifications')}>
          <div style={s.notifBannerIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="#E67700" strokeWidth="1.8"/>
              <path d="M2 10h20M8 15h3m5 0h-2" stroke="#E67700" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.notifBannerTitle}>
              {paymentNotifs.length === 1
                ? paymentNotifs[0].title
                : `${paymentNotifs.length} новых уведомлений об оплате`}
            </div>
            <div style={s.notifBannerDesc}>Нажмите, чтобы посмотреть</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#E67700" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {/* Summary row */}
      <div style={s.summary}>
        <div style={s.summaryCard}>
          <div style={{ ...s.summaryVal, color: '#E67700' }}>{pending.length}</div>
          <div style={s.summaryLbl}>Ждут</div>
        </div>
        <div style={s.summaryCard}>
          <div style={{ ...s.summaryVal, color: '#6741D9' }}>{active.length}</div>
          <div style={s.summaryLbl}>В работе</div>
        </div>
        <div style={s.summaryCard}>
          <div style={{ ...s.summaryVal, color: C }}>{orders.length}</div>
          <div style={s.summaryLbl}>Всего</div>
        </div>
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          <IconRefresh spin={loading} />
        </button>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <IconSearch />
        <input
          style={s.searchInput}
          placeholder="Номер, адрес, телефон..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={s.clearBtn} onClick={() => setSearch('')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={s.filterScroll}>
        {FILTERS.map(f => (
          <button key={f.key}
            style={{ ...s.pill, ...(filter === f.key ? s.pillActive : {}) }}
            onClick={() => { setFilter(f.key); setSearch('') }}>
            {f.label}
            {f.key === 'awaiting_confirmation' && pending.length > 0 && (
              <span style={s.pillBadge}>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : displayed.length === 0 ? (
        <div style={s.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
            <rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M7 9h10M7 13h6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyTitle}>Заказов нет</div>
          <div style={s.emptyDesc}>По выбранному фильтру ничего не найдено</div>
        </div>
      ) : (
        <div style={s.list}>
          {displayed.map(order => {
            const ss = STATUS_STYLE[order.status] || { bg: BG, color: TEXT2 }
            const isExp = expanded === order.id
            const isUrgent = ['new', 'awaiting_confirmation'].includes(order.status)
            return (
              <div key={order.id} style={{ ...s.card, ...(isUrgent ? s.cardUrgent : {}) }}>
                {/* Header */}
                <div style={s.cardHead} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
                  <div style={s.cardLeft}>
                    {isUrgent && <div style={s.urgentPulse} />}
                    <div>
                      <div style={s.cardTopRow}>
                        <span style={s.orderId}>#{order.id}</span>
                        <span style={{ ...s.badge, background: ss.bg, color: ss.color }}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <div style={s.cardAddr}>{order.address}</div>
                      {order.delivery_time && (
                        <div style={s.cardTime}>{order.delivery_time}</div>
                      )}
                    </div>
                  </div>
                  <div style={s.cardRight}>
                    <div style={s.cardTotal}>{(order.total || 0).toLocaleString()} сум</div>
                    {order.bonus_used > 0 && (
                      <div style={s.cardBonus}>−{order.bonus_used} бон.</div>
                    )}
                    <div style={{ marginTop: 4 }}><IconChevron up={isExp} /></div>
                  </div>
                </div>

                {/* Expanded */}
                {isExp && (
                  <div style={s.details}>
                    {/* Info */}
                    <div style={s.infoBlock}>
                      {order.recipient_phone && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>Телефон</span>
                          <span style={s.infoVal}>{order.recipient_phone}</span>
                        </div>
                      )}
                      <div style={s.infoRow}>
                        <span style={s.infoKey}>Адрес</span>
                        <span style={s.infoVal}>{order.address}</span>
                      </div>
                      {order.extra_info && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>Доп. инфо</span>
                          <span style={s.infoVal}>{order.extra_info}</span>
                        </div>
                      )}
                      {order.return_bottles_count > 0 && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>Возврат</span>
                          <span style={s.infoVal}>{order.return_bottles_count} бут.</span>
                        </div>
                      )}
                      {order.bottle_discount > 0 && (
                        <div style={s.infoRow}>
                          <span style={s.infoKey}>Скидка</span>
                          <span style={{ ...s.infoVal, color: CD, fontWeight: 700 }}>
                            −{(order.bottle_discount || 0).toLocaleString()} сум
                          </span>
                        </div>
                      )}
                      <div style={{ ...s.infoRow, borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 10 }}>
                        <span style={{ ...s.infoKey, fontWeight: 700, color: TEXT }}>Итого</span>
                        <span style={{ ...s.infoVal, fontWeight: 800, fontSize: 17, color: TEXT }}>
                          {(order.total || 0).toLocaleString()} сум
                        </span>
                      </div>
                    </div>

                    {/* Items */}
                    {order.items?.length > 0 && (
                      <div style={s.itemsBlock}>
                        <div style={s.sectionLabel}>Состав заказа</div>
                        {order.items.map(i => (
                          <div key={i.id} style={s.itemRow}>
                            <div style={s.itemDot} />
                            <span style={s.itemName}>{i.product_name}</span>
                            <span style={s.itemQty}>× {i.quantity}</span>
                            <span style={s.itemPrice}>{((i.price || 0) * i.quantity).toLocaleString()} сум</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={s.actionsRow}>
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          <button style={s.btnPrimary} disabled={actionLoading}
                            onClick={() => act(() => confirmOrder(order.id))}>
                            <IconCheck /> Подтвердить
                          </button>
                          <button style={s.btnDanger} disabled={actionLoading}
                            onClick={() => { setRejectingId(order.id); setRejectReason('') }}>
                            <IconX /> Отклонить
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button style={s.btnSecondary}
                          onClick={() => { setAssigningId(order.id); setSelectedCourier('') }}>
                          <IconUser /> Назначить курьера
                        </button>
                      )}
                      {order.recipient_phone && (
                        <a href={`tel:${order.recipient_phone}`} style={s.btnOutline}>
                          <IconPhone /> Позвонить
                        </a>
                      )}
                      {order.latitude && (
                        <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                          target="_blank" rel="noopener noreferrer" style={s.btnOutline}>
                          <IconMap /> Карта
                        </a>
                      )}
                    </div>

                    {/* Reject form */}
                    {rejectingId === order.id && (
                      <div style={s.inlineForm}>
                        <div style={s.formLabel}>Причина отказа</div>
                        <input style={s.formInput}
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Нет в наличии, неверный адрес..."
                          autoFocus
                        />
                        <div style={s.formActions}>
                          <button style={s.btnGhost} onClick={() => setRejectingId(null)}>Отмена</button>
                          <button style={s.btnDanger} disabled={actionLoading || !rejectReason.trim()}
                            onClick={() => act(() => rejectOrder(order.id, rejectReason).then(() => setRejectingId(null)))}>
                            <IconX /> Отклонить
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Assign courier form */}
                    {assigningId === order.id && (
                      <div style={s.inlineForm}>
                        <div style={s.formLabel}>Выберите курьера</div>
                        <select style={s.formSelect} value={selectedCourier}
                          onChange={e => setSelectedCourier(e.target.value)}>
                          <option value="">— Выберите —</option>
                          {couriers.filter(c => c.is_active !== false).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div style={s.formActions}>
                          <button style={s.btnGhost} onClick={() => setAssigningId(null)}>Отмена</button>
                          <button style={s.btnSecondary} disabled={actionLoading || !selectedCourier}
                            onClick={() => act(() => assignCourier(order.id, selectedCourier).then(() => setAssigningId(null)))}>
                            <IconUser /> Назначить
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

const s = {
  notifBanner: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#FFF8E6', borderRadius: 14, padding: '13px 16px',
    marginBottom: 16, cursor: 'pointer', border: '1px solid #FFD43B40',
    WebkitTapHighlightColor: 'transparent',
  },
  notifBannerIcon: {
    width: 38, height: 38, borderRadius: 10,
    background: '#FFF3BF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifBannerTitle: { fontWeight: 700, fontSize: 14, color: TEXT },
  notifBannerDesc: { fontSize: 12, color: TEXT2, marginTop: 2 },

  summary: { display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' },
  summaryCard: {
    flex: 1, background: '#fff', borderRadius: 18, padding: '14px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  summaryVal: { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  summaryLbl: { fontSize: 11, color: TEXT2, marginTop: 3, fontWeight: 500 },
  refreshBtn: {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    background: '#fff', border: `1px solid ${BORDER}`,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: TEXT2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },

  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', borderRadius: 18,
    padding: '11px 14px', marginBottom: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  searchInput: {
    border: 'none', outline: 'none', flex: 1,
    fontSize: 15, background: 'transparent', color: TEXT,
  },
  clearBtn: {
    border: 'none', background: 'none', padding: 2,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
  },

  filterScroll: {
    display: 'flex', gap: 8, overflowX: 'auto',
    scrollbarWidth: 'none', paddingBottom: 2, marginBottom: 16,
  },
  pill: {
    padding: '7px 16px', borderRadius: 999,
    border: `1.5px solid ${BORDER}`, background: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, color: TEXT2,
    display: 'flex', alignItems: 'center', gap: 5,
    transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
  },
  pillActive: { background: C, borderColor: C, color: '#fff' },
  pillBadge: {
    background: '#FF3B30', color: '#fff', borderRadius: 999,
    fontSize: 10, fontWeight: 800, minWidth: 16, height: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
  },

  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px', gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: 700, color: TEXT, marginTop: 4 },
  emptyDesc: { fontSize: 14, color: TEXT2, textAlign: 'center' },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },

  card: {
    background: '#fff', borderRadius: 18, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardUrgent: {
    border: '1.5px solid rgba(230,119,0,0.35)',
    boxShadow: '0 2px 12px rgba(230,119,0,0.08)',
  },

  cardHead: {
    display: 'flex', justifyContent: 'space-between', gap: 12,
    padding: '14px 16px', cursor: 'pointer', alignItems: 'flex-start',
    WebkitTapHighlightColor: 'transparent',
  },
  cardLeft: { display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  cardRight: { textAlign: 'right', flexShrink: 0 },
  cardTopRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  orderId: { fontWeight: 800, fontSize: 16, color: TEXT },
  badge: { fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 700 },
  cardAddr: { fontSize: 13, color: TEXT2, marginTop: 4, lineHeight: 1.3 },
  cardTime: { fontSize: 12, color: TEXT2, marginTop: 2 },
  cardTotal: { fontWeight: 800, fontSize: 17, color: TEXT },
  cardBonus: { fontSize: 11, color: TEXT2, marginTop: 1 },
  urgentPulse: {
    width: 8, height: 8, borderRadius: '50%', background: '#E67700',
    flexShrink: 0, marginTop: 6, boxShadow: '0 0 0 2px rgba(230,119,0,0.25)',
  },

  details: {
    borderTop: `1px solid ${BORDER}`, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  infoBlock: {
    background: '#F8F9FA', borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  infoRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  infoKey: { fontSize: 13, color: TEXT2, minWidth: 90, flexShrink: 0, paddingTop: 1 },
  infoVal: { fontSize: 14, color: TEXT, flex: 1, lineHeight: 1.4 },

  itemsBlock: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: TEXT2,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
    paddingBottom: 6, borderBottom: `1px solid ${BORDER}`,
  },
  itemDot: { width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 },
  itemName: { flex: 1, color: TEXT },
  itemQty: { color: TEXT2, flexShrink: 0 },
  itemPrice: { fontWeight: 700, color: TEXT, flexShrink: 0 },

  actionsRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 12, border: 'none',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 4px 14px rgba(141,198,63,0.3)',
  },
  btnDanger: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 12, border: 'none',
    background: '#E03131', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  btnSecondary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 16px', borderRadius: 12, border: 'none',
    background: '#6741D9', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  btnOutline: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
  },
  btnGhost: {
    padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },

  inlineForm: {
    background: '#F8F9FA', borderRadius: 12, padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 10,
    border: `1px solid ${BORDER}`,
  },
  formLabel: { fontSize: 13, fontWeight: 700, color: TEXT },
  formInput: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10,
    padding: '11px 13px', fontSize: 15, outline: 'none',
    background: '#fff', color: TEXT,
  },
  formSelect: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10,
    padding: '11px 13px', fontSize: 15, outline: 'none',
    background: '#fff', color: TEXT,
  },
  formActions: { display: 'flex', gap: 8 },
}
