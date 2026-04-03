import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers, getNotifications } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

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
        setOrders(o); setCouriers(c)
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
  const active = orders.filter(o => ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))

  const displayed = search
    ? orders.filter(o =>
        String(o.id).includes(search) ||
        o.address?.toLowerCase().includes(search.toLowerCase()) ||
        o.recipient_phone?.includes(search)
      )
    : orders

  return (
    <ManagerLayout title="Заказы">
      {paymentNotifs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF8E6', borderRadius: 18, padding: '13px 16px', marginBottom: 16, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => navigate('/manager/notifications')}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF3BF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#E67700" strokeWidth="1.8"/><path d="M2 10h20M8 15h3m5 0h-2" stroke="#E67700" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>{paymentNotifs.length === 1 ? paymentNotifs[0].title : `${paymentNotifs.length} новых уведомлений об оплате`}</div>
            <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>Нажмите, чтобы посмотреть</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#E67700" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {[[pending.length, 'Ждут', '#E67700'], [active.length, 'В работе', '#6741D9'], [orders.length, 'Всего', C]].map(([v, l, c]) => (
          <div key={l} style={{ flex: 1, background: '#fff', borderRadius: 18, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 3, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
        <button style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#fff', border: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT2, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }} onClick={load} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 18, padding: '11px 14px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={TEXT2} strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: TEXT }} placeholder="Номер, адрес, телефон..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', display: 'flex' }} onClick={() => setSearch('')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/></svg></button>}
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.key} style={{ padding: '7px 16px', borderRadius: 999, border: filter === f.key ? 'none' : `1.5px solid ${BORDER}`, background: filter === f.key ? GRAD : '#fff', color: filter === f.key ? '#fff' : TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, WebkitTapHighlightColor: 'transparent', boxShadow: filter === f.key ? '0 2px 8px rgba(141,198,63,0.3)' : 'none' }} onClick={() => { setFilter(f.key); setSearch('') }}>
            {f.label}
            {f.key === 'awaiting_confirmation' && pending.length > 0 && (
              <span style={{ background: '#FF3B30', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 10 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}><rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT} strokeWidth="1.5"/><path d="M7 9h10M7 13h6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Заказов нет</div>
          <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>По выбранному фильтру ничего не найдено</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(order => {
            const ss = STATUS_STYLE[order.status] || { bg: '#F2F2F7', color: TEXT2 }
            const isExp = expanded === order.id
            const isUrgent = ['new', 'awaiting_confirmation'].includes(order.status)
            return (
              <div key={order.id} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', ...(isUrgent ? { borderLeft: '3px solid #E67700' } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 16px', cursor: 'pointer', alignItems: 'flex-start', WebkitTapHighlightColor: 'transparent' }} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>#{order.id}</span>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: ss.bg, color: ss.color }}>{STATUS_LABELS[order.status] || order.status}</span>
                      </div>
                      <div style={{ fontSize: 13, color: TEXT2, marginTop: 4, lineHeight: 1.3 }}>{order.address}</div>
                      {order.delivery_time && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{order.delivery_time}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</div>
                    {order.bonus_used > 0 && <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>−{order.bonus_used} бон.</div>}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 4, transition: 'transform 0.2s', transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)' }}><path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>

                {isExp && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {order.recipient_phone && <Row k="Телефон" v={order.recipient_phone} />}
                      <Row k="Адрес" v={order.address} />
                      {order.extra_info && <Row k="Доп. инфо" v={order.extra_info} />}
                      {order.return_bottles_count > 0 && <Row k="Возврат" v={`${order.return_bottles_count} бут.`} />}
                      {order.bottle_discount > 0 && <Row k="Скидка" v={`−${(order.bottle_discount).toLocaleString()} сум`} accent={CD} />}
                      <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, minWidth: 90 }}>Итого</span>
                        <span style={{ fontSize: 17, fontWeight: 800, color: TEXT, flex: 1 }}>{(order.total || 0).toLocaleString()} сум</span>
                      </div>
                    </div>

                    {order.items?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Состав заказа</div>
                        {order.items.map(i => (
                          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 }} />
                            <span style={{ flex: 1, color: TEXT }}>{i.product_name}</span>
                            <span style={{ color: TEXT2, flexShrink: 0 }}>× {i.quantity}</span>
                            <span style={{ fontWeight: 700, color: TEXT, flexShrink: 0 }}>{((i.price || 0) * i.quantity).toLocaleString()} сум</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {order.status === 'awaiting_confirmation' && (
                        <>
                          <button style={s.btnPrimary} disabled={actionLoading} onClick={() => act(() => confirmOrder(order.id))}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg> Подтвердить
                          </button>
                          <button style={s.btnDanger} disabled={actionLoading} onClick={() => { setRejectingId(order.id); setRejectReason('') }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Отклонить
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button style={s.btnSecondary} onClick={() => { setAssigningId(order.id); setSelectedCourier('') }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> Назначить курьера
                        </button>
                      )}
                      {order.recipient_phone && (
                        <a href={`tel:${order.recipient_phone}`} style={s.btnOutline}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg> Позвонить
                        </a>
                      )}
                      {order.latitude && (
                        <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`} target="_blank" rel="noopener noreferrer" style={s.btnOutline}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg> Карта
                        </a>
                      )}
                    </div>

                    {rejectingId === order.id && (
                      <div style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Причина отказа</div>
                        <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, outline: 'none', background: '#fff', color: TEXT }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Нет в наличии, неверный адрес..." autoFocus />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer' }} onClick={() => setRejectingId(null)}>Отмена</button>
                          <button style={{ ...s.btnDanger, opacity: !rejectReason.trim() ? 0.5 : 1 }} disabled={actionLoading || !rejectReason.trim()} onClick={() => act(() => rejectOrder(order.id, rejectReason).then(() => setRejectingId(null)))}>Отклонить</button>
                        </div>
                      </div>
                    )}

                    {assigningId === order.id && (
                      <div style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Выберите курьера</div>
                        <select style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, outline: 'none', background: '#fff', color: TEXT }} value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)}>
                          <option value="">— Выберите —</option>
                          {couriers.filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer' }} onClick={() => setAssigningId(null)}>Отмена</button>
                          <button style={{ ...s.btnSecondary, opacity: !selectedCourier ? 0.5 : 1 }} disabled={actionLoading || !selectedCourier} onClick={() => act(() => assignCourier(order.id, selectedCourier).then(() => setAssigningId(null)))}>Назначить</button>
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

function Row({ k, v, accent }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 13, color: TEXT2, minWidth: 90, flexShrink: 0, paddingTop: 1 }}>{k}</span>
      <span style={{ fontSize: 14, color: accent || TEXT, fontWeight: accent ? 700 : 400, flex: 1, lineHeight: 1.4 }}>{v}</span>
    </div>
  )
}

const s = {
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
}
