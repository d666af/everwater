import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers } from '../../api'

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

const STATUS_LABELS = {
  new: 'Новый', awaiting_confirmation: 'Ожидает', confirmed: 'Подтверждён',
  assigned_to_courier: 'У курьера', in_delivery: 'В доставке',
  delivered: 'Доставлен', rejected: 'Отклонён',
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
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = filter !== 'all' ? { status: filter } : {}
    Promise.all([getOrders(params), getAdminCouriers()])
      .then(([o, c]) => { setOrders(o); setCouriers(c) })
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

  const displayed = search
    ? orders.filter(o =>
        String(o.id).includes(search) ||
        o.address?.toLowerCase().includes(search.toLowerCase()) ||
        o.recipient_phone?.includes(search)
      )
    : orders

  const urgent = orders.filter(o => ['new', 'awaiting_confirmation'].includes(o.status)).length

  return (
    <AdminLayout title="Заказы">
      {/* New order alert banner */}
      {urgent > 0 && filter === 'all' && (
        <div style={s.newOrderBanner} onClick={() => setFilter('awaiting_confirmation')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={s.newOrderPulse} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {urgent === 1 ? 'Новый заказ!' : `${urgent} новых заказа!`}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
                Ожидают подтверждения — нажмите чтобы просмотреть
              </div>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      {/* Summary */}
      <div style={s.summary}>
        <div style={s.sumCard}>
          <div style={{ ...s.sumVal, color: '#E67700' }}>{urgent}</div>
          <div style={s.sumLbl}>Ждут</div>
        </div>
        <div style={s.sumCard}>
          <div style={{ ...s.sumVal, color: '#6741D9' }}>
            {orders.filter(o => ['confirmed','assigned_to_courier','in_delivery'].includes(o.status)).length}
          </div>
          <div style={s.sumLbl}>В работе</div>
        </div>
        <div style={s.sumCard}>
          <div style={{ ...s.sumVal, color: C }}>{orders.length}</div>
          <div style={s.sumLbl}>Всего</div>
        </div>
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 3v5h5" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={TEXT2} strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input style={s.searchInput} placeholder="Поиск по номеру, адресу, телефону..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button style={s.clearBtn} onClick={() => setSearch('')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/></svg>
        </button>}
      </div>

      {/* Filters */}
      <div style={s.filterScroll}>
        {FILTERS.map(f => (
          <button key={f.key}
            style={{ ...s.pill, ...(filter === f.key ? s.pillActive : {}) }}
            onClick={() => { setFilter(f.key); setSearch('') }}>
            {f.label}
            {f.key === 'awaiting_confirmation' && urgent > 0 && (
              <span style={s.pillBadge}>{urgent}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : displayed.length === 0 ? (
        <div style={s.empty}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}>
            <rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M7 9h10M7 13h6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyText}>Заказов нет</div>
        </div>
      ) : (
        <div style={s.list}>
          {displayed.map(order => {
            const ss = STATUS_STYLE[order.status] || { bg: '#F2F2F7', color: TEXT2 }
            const isExp = expanded === order.id
            const isUrgent = ['new', 'awaiting_confirmation'].includes(order.status)
            return (
              <div key={order.id} style={{ ...s.card, ...(isUrgent ? s.cardUrgent : {}) }}>
                <div style={s.cardHead} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
                  <div style={s.cardLeft}>
                    {isUrgent && <div style={s.urgentDot} />}
                    <div>
                      <div style={s.cardTopRow}>
                        <span style={s.orderId}>#{order.id}</span>
                        <span style={{ ...s.badge, background: ss.bg, color: ss.color }}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <div style={s.cardAddr}>{order.address}</div>
                      {order.delivery_time && <div style={s.cardTime}>{order.delivery_time}</div>}
                    </div>
                  </div>
                  <div style={s.cardRight}>
                    <div style={s.cardTotal}>{(order.total || 0).toLocaleString()} сум</div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      style={{ transition: 'transform 0.2s', transform: isExp ? 'rotate(180deg)' : 'none', marginTop: 6 }}>
                      <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {isExp && (
                  <div style={s.details}>
                    <div style={s.infoBlock}>
                      {order.recipient_phone && (
                        <div style={s.infoRow}><span style={s.infoKey}>Телефон</span><span style={s.infoVal}>{order.recipient_phone}</span></div>
                      )}
                      <div style={s.infoRow}><span style={s.infoKey}>Адрес</span><span style={s.infoVal}>{order.address}</span></div>
                      {order.extra_info && (
                        <div style={s.infoRow}><span style={s.infoKey}>Доп. инфо</span><span style={s.infoVal}>{order.extra_info}</span></div>
                      )}
                      {order.return_bottles_count > 0 && (
                        <div style={s.infoRow}><span style={s.infoKey}>Возврат</span><span style={s.infoVal}>{order.return_bottles_count} бут.</span></div>
                      )}
                      {order.rejection_reason && (
                        <div style={s.infoRow}><span style={s.infoKey}>Отказ</span><span style={{ ...s.infoVal, color: '#E03131' }}>{order.rejection_reason}</span></div>
                      )}
                      <div style={{ ...s.infoRow, borderTop: `1px solid ${BORDER}`, marginTop: 4, paddingTop: 8 }}>
                        <span style={{ ...s.infoKey, fontWeight: 700, color: TEXT }}>Итого</span>
                        <span style={{ ...s.infoVal, fontWeight: 800, fontSize: 17 }}>{(order.total || 0).toLocaleString()} сум</span>
                      </div>
                    </div>

                    {order.items?.length > 0 && (
                      <div style={s.itemsBlock}>
                        <div style={s.sectionLbl}>Состав</div>
                        {order.items.map(i => (
                          <div key={i.id} style={s.itemRow}>
                            <div style={s.itemDot} />
                            <span style={{ flex: 1, color: TEXT, fontSize: 14 }}>{i.product_name}</span>
                            <span style={{ color: TEXT2, fontSize: 13 }}>× {i.quantity}</span>
                            <span style={{ fontWeight: 700, color: TEXT, fontSize: 14, marginLeft: 8 }}>{((i.price || 0) * i.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={s.actionsRow}>
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          <button style={s.btnGreen} disabled={actionLoading}
                            onClick={() => act(() => confirmOrder(order.id))}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Подтвердить
                          </button>
                          <button style={s.btnRed} disabled={actionLoading}
                            onClick={() => { setRejectingId(order.id); setRejectReason('') }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                            Отклонить
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button style={s.btnPurple}
                          onClick={() => { setAssigningId(order.id); setSelectedCourier('') }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          Курьер
                        </button>
                      )}
                      {order.recipient_phone && (
                        <a href={`tel:${order.recipient_phone}`} style={s.btnOutline}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill={TEXT}/></svg>
                          Позвонить
                        </a>
                      )}
                      {order.client_telegram_id && (
                        <a href={`tg://user?id=${order.client_telegram_id}`} style={{ ...s.btnOutline, background: '#E8F4FD', border: '1.5px solid rgba(25,113,194,0.2)', color: '#1971C2' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M21.6 12.3C21.6 17.4 17.4 21.6 12 21.6C9.8 21.6 7.7 20.9 6 19.7L2.4 20.4 3.1 17C1.9 15.2 1.2 13.1 1.2 10.9 1.2 5.8 5.4 1.6 10.8 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <path d="M17.5 5.5l-7 4 3 1 1 3 3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Написать
                        </a>
                      )}
                    </div>

                    {rejectingId === order.id && (
                      <div style={s.inlineForm}>
                        <div style={s.formLabel}>Причина отказа</div>
                        <input style={s.formInput} value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Нет в наличии, неверный адрес..." autoFocus />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={s.btnGhost} onClick={() => setRejectingId(null)}>Отмена</button>
                          <button style={s.btnRed} disabled={actionLoading || !rejectReason.trim()}
                            onClick={() => act(() => rejectOrder(order.id, rejectReason).then(() => setRejectingId(null)))}>
                            Отклонить
                          </button>
                        </div>
                      </div>
                    )}

                    {assigningId === order.id && (
                      <div style={s.inlineForm}>
                        <div style={s.formLabel}>Выберите курьера</div>
                        <select style={s.formInput} value={selectedCourier}
                          onChange={e => setSelectedCourier(e.target.value)}>
                          <option value="">— Выберите —</option>
                          {couriers.filter(c => c.is_active !== false).map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.total_deliveries || 0} доставок)</option>
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
    </AdminLayout>
  )
}

const s = {
  newOrderBanner: {
    background: 'linear-gradient(135deg, #E67700, #D06200)',
    borderRadius: 14, padding: '14px 18px', marginBottom: 16,
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 4px 16px rgba(230,119,0,0.35)',
    WebkitTapHighlightColor: 'transparent',
  },
  newOrderPulse: {
    width: 14, height: 14, borderRadius: '50%', background: '#fff',
    flexShrink: 0, boxShadow: '0 0 0 4px rgba(255,255,255,0.3)',
    animation: 'pulse 1.5s infinite',
  },

  summary: { display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' },
  sumCard: {
    flex: 1, background: '#fff', borderRadius: 14, padding: '14px 10px',
    textAlign: 'center', border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  sumVal: { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  sumLbl: { fontSize: 11, color: TEXT2, marginTop: 3, fontWeight: 500 },
  refreshBtn: {
    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
    background: '#fff', border: `1px solid ${BORDER}`, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2,
  },

  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14,
    padding: '11px 14px', marginBottom: 14,
  },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: TEXT },
  clearBtn: { border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 },

  filterScroll: {
    display: 'flex', gap: 8, overflowX: 'auto',
    scrollbarWidth: 'none', paddingBottom: 2, marginBottom: 16,
  },
  pill: {
    padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${BORDER}`,
    background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, color: TEXT2,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
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
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 20px' },
  emptyText: { fontSize: 16, fontWeight: 700, color: TEXT2 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardUrgent: { border: '1.5px solid rgba(230,119,0,0.3)', boxShadow: '0 2px 12px rgba(230,119,0,0.08)' },
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
  urgentDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#E67700',
    flexShrink: 0, marginTop: 6, boxShadow: '0 0 0 2px rgba(230,119,0,0.25)',
  },

  details: {
    borderTop: `1px solid ${BORDER}`, padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  infoBlock: { background: '#F8F9FA', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  infoRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  infoKey: { fontSize: 13, color: TEXT2, minWidth: 80, flexShrink: 0, paddingTop: 1 },
  infoVal: { fontSize: 14, color: TEXT, flex: 1, lineHeight: 1.4 },

  itemsBlock: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLbl: { fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` },
  itemDot: { width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 },

  actionsRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnGreen: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
    borderRadius: 12, border: 'none', background: C, color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  btnRed: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
    borderRadius: 12, border: 'none', background: '#E03131', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  btnPurple: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
    borderRadius: 12, border: 'none', background: '#6741D9', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  btnOutline: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
    borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
  },
  btnGhost: {
    padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer',
  },

  inlineForm: {
    background: '#F8F9FA', borderRadius: 12, padding: 14,
    display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${BORDER}`,
  },
  formLabel: { fontSize: 13, fontWeight: 700, color: TEXT },
  formInput: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10,
    padding: '11px 13px', fontSize: 15, outline: 'none',
    background: '#fff', color: TEXT,
  },
}
