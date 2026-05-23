import { useEffect, useState, useCallback, useRef } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers, markInDelivery, markDelivered, confirmSubscription, rejectSubscription, courierCreateOrder, lookupClientByPhone, getProducts, deleteOrder } from '../../api'
import PhonePopup from '../../components/PhonePopup'
import { useAuthStore } from '../../store/auth'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const STAGES = [
  { key: 'all', label: 'Все заказы' },
  { key: 'new', label: 'Новые' },
  { key: 'delivery', label: 'Не доставленные' },
  { key: 'done', label: 'Доставленные' },
]

function getStage(order) {
  if (order.status === 'rejected') return 'cancelled'
  if (order.type === 'subscription') {
    if (!order.payment_confirmed) return 'new'
    if (!order.courier_id) return 'new'
    if (order.status === 'in_delivery' || order.status === 'assigned_to_courier') return 'delivery'
    return 'done'
  }
  if (order.status === 'awaiting_confirmation' || order.status === 'confirmed') return 'new'
  if (order.status === 'assigned_to_courier' || order.status === 'in_delivery') return 'delivery'
  if (order.status === 'delivered') return 'done'
  return 'new'
}

function stageCounts(orders) {
  const c = { new: 0, delivery: 0, done: 0 }
  orders.forEach(o => { const s = getStage(o); if (c[s] !== undefined) c[s]++ })
  return c
}

const REJECT_SCRIPTS = [
  'Не удалось подтвердить оплату',
  'Нет в наличии',
  'Неверный адрес доставки',
  'Клиент не выходит на связь',
]

function matchesTime(order, timeFilter, customDate, customDateTo) {
  const created = order.created_at ? new Date(order.created_at) : null
  if (!created) return true
  if (timeFilter === 'today') {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return created >= startOfToday
  }
  if (timeFilter === 'custom' && customDate) {
    const [y, m, d] = String(customDate).split('-').map(Number)
    const start = new Date(y, m - 1, d)
    const endStr = customDateTo || customDate
    const [y2, m2, d2] = String(endStr).split('-').map(Number)
    const end = new Date(y2, m2 - 1, d2 + 1)
    return created >= start && created < end
  }
  return true
}

function fmtDateStr(s) {
  if (!s) return ''
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function ManagerOrders({ Layout = ManagerLayout, title = 'Панель' }) {
  const { user: currentUser } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [stage, setStage] = useState('all')
  const [timeFilter, setTimeFilter] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [couriers, setCouriers] = useState([])
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [assigningId, setAssigningId] = useState(null)
  const [selectedCourier, setSelectedCourier] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getOrders(), getAdminCouriers()])
      .then(([o, c]) => { setOrders(o); setCouriers(c) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (fn) => {
    setActionLoading(true)
    try { await fn(); load() }
    catch (e) {
      const status = e?.response?.status
      if (status === 409) alert('Уже обработано другим администратором')
      else alert('Ошибка операции')
    }
    finally { setActionLoading(false) }
  }

  const periodLabel = timeFilter === 'custom'
    ? (customDate
        ? (customDateTo && customDateTo !== customDate
            ? `${fmtDateStr(customDate)} – ${fmtDateStr(customDateTo)}`
            : fmtDateStr(customDate))
        : 'Дата')
    : 'Сегодня'

  const timeFiltered = orders
    .filter(o => matchesTime(o, timeFilter, customDate, customDateTo))
    .filter(o => getStage(o) !== 'cancelled')
  const counts = stageCounts(timeFiltered)
  const displayed = stage === 'all' ? timeFiltered : timeFiltered.filter(o => getStage(o) === stage)

  const handleCreateOrder = async (data) => {
    await courierCreateOrder({
      ...data,
      manager_name: currentUser?.name || '',
      manager_phone: currentUser?.phone || '',
      creator_name: currentUser?.name || null,
    })
    load()
  }

  return (
    <Layout title={title}>
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate}
          initialDateTo={customDateTo}
          onApply={(start, end) => { setCustomDate(start); setCustomDateTo(end); setTimeFilter('custom') }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {showCreate && (
        <CreateOrderModal onClose={() => setShowCreate(false)} onSave={handleCreateOrder} couriers={couriers} />
      )}

      {/* Create order button */}
      <button onClick={() => setShowCreate(true)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', marginBottom: 14, padding: '12px 16px', borderRadius: 14,
        border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(141,198,63,0.3)', WebkitTapHighlightColor: 'transparent',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        Создать заказ
      </button>

      {/* Stage filter cards — equal width grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        {STAGES.map(s => {
          const active = stage === s.key
          const count = s.key === 'all' ? timeFiltered.length : (counts[s.key] || 0)
          const newCount = s.key === 'new' || s.key === 'delivery' ? count : 0
          return (
            <button key={s.key} onClick={() => setStage(s.key)} style={{
              padding: '14px 4px 12px', borderRadius: 16,
              background: active ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
              border: active ? 'none' : `1.5px solid ${C}40`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              boxShadow: active ? '0 4px 14px rgba(141,198,63,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
              WebkitTapHighlightColor: 'transparent', position: 'relative',
            }}>
              {newCount > 0 && !active && (
                <span style={{
                  position: 'absolute', top: -6, right: -4,
                  background: '#fff', border: '1.5px solid #FF3B30', color: '#FF3B30',
                  borderRadius: 999, fontSize: 10, fontWeight: 800,
                  minWidth: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  +{newCount}
                </span>
              )}
              <div style={{ fontSize: 22, fontWeight: 800, color: active ? '#fff' : TEXT, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: active ? 'rgba(255,255,255,0.85)' : CD, lineHeight: 1.2, textAlign: 'center' }}>{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* Time sub-filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
        <button onClick={() => { setTimeFilter('today'); setCustomDate(null); setCustomDateTo(null) }} style={{
          flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
          background: timeFilter === 'today' ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
          color: timeFilter === 'today' ? '#fff' : TEXT2,
          border: timeFilter === 'today' ? 'none' : `1.5px solid ${BORDER}`,
          fontSize: 12, fontWeight: 700, WebkitTapHighlightColor: 'transparent',
        }}>Сегодня</button>
        <button onClick={() => setPickerOpen(true)} style={{
          flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
          background: timeFilter === 'custom' ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
          color: timeFilter === 'custom' ? '#fff' : TEXT2,
          border: timeFilter === 'custom' ? 'none' : `1.5px solid ${BORDER}`,
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {timeFilter === 'custom' ? periodLabel : 'Дата'}
        </button>
        <button style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT2, flexShrink: 0 }} onClick={load} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 10 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}><rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT} strokeWidth="1.5"/><path d="M7 9h10M7 13h6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Нет заказов</div>
          <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>По выбранному фильтру ничего не найдено</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expanded === order.id}
              onToggle={() => setExpanded(e => e === order.id ? null : order.id)}
              couriers={couriers}
              rejectingId={rejectingId}
              setRejectingId={setRejectingId}
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              assigningId={assigningId}
              setAssigningId={setAssigningId}
              selectedCourier={selectedCourier}
              setSelectedCourier={setSelectedCourier}
              actionLoading={actionLoading}
              act={act}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}

/* ─── Order card ─────────────────────────────────────────────────────────────── */

function OrderCard({
  order, expanded, onToggle, couriers,
  rejectingId, setRejectingId, rejectReason, setRejectReason,
  assigningId, setAssigningId, selectedCourier, setSelectedCourier,
  actionLoading, act,
}) {
  const { user: currentUser } = useAuthStore()
  const orderStage = getStage(order)
  const [showMore, setShowMore] = useState(false)
  const [phoneModal, setPhoneModal] = useState(null)

  const stageLabel = {
    new: order.type === 'subscription' && !order.payment_confirmed
      ? 'Проверка оплаты'
      : 'Новый',
    delivery: order.status === 'in_delivery' ? 'В пути' : 'Курьер назначен',
    done: 'Доставлен',
    cancelled: 'Отменён',
  }[orderStage] || order.status

  const stageBg = {
    new: `${C}15`,
    delivery: `${C}15`,
    done: '#EBFBEE',
    cancelled: '#FFF5F5',
  }[orderStage] || '#F2F2F7'

  const stageClr = {
    new: CD,
    delivery: CD,
    done: '#2B8A3E',
    cancelled: '#E03131',
  }[orderStage] || TEXT2

  const typeLabel = order.type === 'subscription' ? 'Подписка' : 'Заказ'

  return (
    <div style={{
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      borderLeft: orderStage === 'new' ? `3px solid ${C}` : 'none',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={onToggle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>#{order.id}</span>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: stageBg, color: stageClr }}>{stageLabel}</span>
              {order.type && order.type !== 'order' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, background: '#F8F9FA', color: TEXT2 }}>{typeLabel}</span>
              )}
              {order.payment_method === 'card' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, background: '#F8F9FA', color: TEXT2 }}>Карта</span>
              )}
              {order.is_items_edited && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, background: '#FFF3BF', color: '#E67700' }}>
                  ✏️{order.items_edited_by ? ` Изм. ${order.items_edited_by}` : ' Изменено'}
                </span>
              )}
            </div>
            {order.client_name && <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginTop: 4 }}>{order.client_name}</div>}
            {order.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2, lineHeight: 1.3 }}>{order.address}</div>}
            {order.delivery_date && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{order.delivery_date}{order.delivery_period ? ` · ${order.delivery_period}` : ''}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 6, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ─── NEW STAGE (merged payment + assign) ─── */}
          {orderStage === 'new' && (<>
            {order.type === 'subscription' && !order.payment_confirmed ? (<>
              <PaymentBlock order={order} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: `${C}10`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke={CD} strokeWidth="1.8"/><path d="M2 10h20" stroke={CD} strokeWidth="1.5"/></svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Подтвердите оплату</div>
                    <div style={{ fontSize: 12, color: TEXT2 }}>Проверьте поступление средств</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={st.btnPrimary} disabled={actionLoading} onClick={() => act(() => confirmSubscription(order.id))}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Оплата получена
                  </button>
                  <button style={st.btnDanger} disabled={actionLoading} onClick={() => act(() => rejectSubscription(order.id))}>
                    Отклонить
                  </button>
                </div>
              </div>
              <Collapsible label="Доставка и состав" open={showMore} onToggle={() => setShowMore(v => !v)}>
                <ItemsBlock order={order} />
                <DeliveryBlock order={order} />
                <BottlesBlock order={order} />
              </Collapsible>
            </>) : (<>
              <ItemsBlock order={order} />
              <DeliveryBlock order={order} />
              <BottlesBlock order={order} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: `${C}10`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={CD} strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={CD} strokeWidth="1.8" strokeLinecap="round"/></svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Назначьте курьера</div>
                    <div style={{ fontSize: 12, color: TEXT2 }}>Выберите свободного курьера</div>
                  </div>
                </div>
                {assigningId === order.id ? (
                  <div style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${BORDER}` }}>
                    <select style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, outline: 'none', background: '#fff', color: TEXT }} value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)}>
                      <option value="">-- Выберите курьера --</option>
                      {couriers.filter(c => c.is_active !== false).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer' }} onClick={() => setAssigningId(null)}>Отмена</button>
                      <button style={{ ...st.btnPrimary, opacity: !selectedCourier ? 0.5 : 1 }} disabled={actionLoading || !selectedCourier} onClick={() => act(() => {
                        const doAssign = () => assignCourier(order.id, selectedCourier, currentUser?.name, currentUser?.role).then(() => setAssigningId(null))
                        return order.status === 'awaiting_confirmation' ? confirmOrder(order.id).then(doAssign) : doAssign()
                      })}>
                        Назначить
                      </button>
                    </div>
                  </div>
                ) : (
                  <button style={st.btnSecondary} onClick={() => { setAssigningId(order.id); setSelectedCourier('') }}>
                    Выбрать курьера
                  </button>
                )}
              </div>
              <Collapsible label="Оплата" open={showMore} onToggle={() => setShowMore(v => !v)}>
                <PaymentBlock order={order} />
              </Collapsible>
            </>)}
          </>)}

          {/* ─── DELIVERY STAGE ─── */}
          {orderStage === 'delivery' && (<>
            <DeliveryBlock order={order} />
            <ItemsBlock order={order} />
            {(order.courier_name || order.courier_id) && (
              <Section title="Курьер">
                <Row k="Имя" v={order.courier_name || `ID: ${order.courier_id}`} />
                {order.courier_phone && <Row k="Телефон" v={order.courier_phone} />}
              </Section>
            )}
            <BottlesBlock order={order} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {order.status === 'assigned_to_courier' && (<>
                <div style={{ background: `${C}10`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke={CD} strokeWidth="1.8"/><path d="M8 12h8M12 8v8" stroke={CD} strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Курьер назначен</div>
                    <div style={{ fontSize: 12, color: TEXT2 }}>Ожидание забора</div>
                  </div>
                </div>
                <button style={st.btnSecondary} disabled={actionLoading} onClick={() => act(() => markInDelivery(order.id))}>Отметить "В пути"</button>
              </>)}
              {order.status === 'in_delivery' && (<>
                <div style={{ background: `${C}10`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke={CD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>В пути</div>
                    <div style={{ fontSize: 12, color: TEXT2 }}>Курьер доставляет заказ</div>
                  </div>
                </div>
                <button style={st.btnPrimary} disabled={actionLoading} onClick={() => act(() => markDelivered(order.id))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Отметить "Доставлен"
                </button>
              </>)}
            </div>
            <Collapsible label="Оплата" open={showMore} onToggle={() => setShowMore(v => !v)}>
              <PaymentBlock order={order} />
            </Collapsible>
          </>)}

          {/* ─── DONE: show all ─── */}
          {orderStage === 'done' && (<>
            <ItemsBlock order={order} />
            <DeliveryBlock order={order} />
            <PaymentBlock order={order} />
            <BottlesBlock order={order} />
            {(order.courier_name || order.courier_id) && (
              <Section title="Курьер">
                <Row k="Имя" v={order.courier_name || `ID: ${order.courier_id}`} />
                {order.courier_phone && <Row k="Телефон" v={order.courier_phone} />}
              </Section>
            )}
          </>)}

          {/* Reject form */}
          {rejectingId === order.id && (
            <div style={{ background: '#FFF5F5', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid #FFC9C9' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Причина отказа</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REJECT_SCRIPTS.map(s => (
                  <button key={s} onClick={() => setRejectReason(s)} style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: rejectReason === s ? '1.5px solid #E03131' : `1.5px solid ${BORDER}`,
                    background: rejectReason === s ? '#FFF5F5' : '#fff',
                    color: rejectReason === s ? '#E03131' : TEXT2,
                  }}>{s}</button>
                ))}
              </div>
              <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, outline: 'none', background: '#fff', color: TEXT }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Или введите причину..." />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer' }} onClick={() => setRejectingId(null)}>Отмена</button>
                <button style={{ ...st.btnDanger, opacity: !rejectReason.trim() ? 0.5 : 1 }} disabled={actionLoading || !rejectReason.trim()} onClick={() => act(() => rejectOrder(order.id, rejectReason, currentUser?.name, currentUser?.role).then(() => setRejectingId(null)))}>Отклонить</button>
              </div>
            </div>
          )}

          <CreatorBlock order={order} />

          {/* Always visible: cancel + contact client */}
          {phoneModal && <PhonePopup number={phoneModal.number} label={phoneModal.label} onClose={() => setPhoneModal(null)} />}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
            {order.recipient_phone && (<>
              <button onClick={() => setPhoneModal({ number: order.recipient_phone, label: 'Телефон клиента' })} style={st.btnOutline}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
                Позвонить
              </button>
              <a href={`tg://user?id=${order.client_telegram_id}`} style={st.btnOutline}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                Написать
              </a>
            </>)}
            {order.courier_phone && (
              <button onClick={() => setPhoneModal({ number: order.courier_phone, label: 'Телефон курьера' })} style={st.btnOutline}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
                Курьер
              </button>
            )}
            {orderStage !== 'done' && orderStage !== 'cancelled' && rejectingId !== order.id && (
              <button style={{ ...st.btnOutline, color: '#E03131', borderColor: 'rgba(224,49,49,0.3)' }} onClick={() => { setRejectingId(order.id); setRejectReason('') }}>
                Отменить заказ
              </button>
            )}
            {order.status === 'delivered' && (
              <button style={{ ...st.btnOutline, color: '#E03131', borderColor: 'rgba(224,49,49,0.3)' }} disabled={actionLoading}
                onClick={() => { if (window.confirm('Удалить заказ? Это действие необратимо.')) act(() => deleteOrder(order.id, currentUser?.name, currentUser?.role).then(() => setOrders(prev => prev.filter(o => o.id !== order.id)))) }}>
                Удалить заказ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Block components for stage-aware cards ───────────────────────────────── */

function ItemsBlock({ order }) {
  if (!order.items?.length) return null
  const surcharge = order.bottle_surcharge || 0
  return (
    <Section title="Состав">
      {order.items.map(i => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 }} />
          <span style={{ flex: 1, color: TEXT }}>{i.product_name}</span>
          <span style={{ color: TEXT2, flexShrink: 0 }}>× {i.quantity} шт.</span>
          <span style={{ fontWeight: 700, color: TEXT, flexShrink: 0 }}>{((i.price || 0) * i.quantity).toLocaleString()} сум</span>
        </div>
      ))}
      {surcharge > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E67700', flexShrink: 0 }} />
          <span style={{ flex: 1, color: '#E67700' }}>Невозвращённые бутылки</span>
          <span style={{ fontWeight: 700, color: '#E67700', flexShrink: 0 }}>+{Math.round(surcharge).toLocaleString()} сум</span>
        </div>
      )}
    </Section>
  )
}

function DeliveryBlock({ order }) {
  if (!order.address) return null
  return (
    <Section title="Доставка">
      <Row k="Адрес" v={order.address} />
      {order.extra_info && <Row k="Доп. инфо" v={order.extra_info} />}
      {order.delivery_date && <Row k="Дата" v={order.delivery_date} />}
      {order.delivery_period && <Row k="Время" v={order.delivery_period} />}
      {order.recipient_phone && <Row k="Телефон" v={order.recipient_phone} />}
      {order.latitude && (
        <div style={{ marginTop: 4 }}>
          <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: CD, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
            Открыть на карте
          </a>
        </div>
      )}
    </Section>
  )
}

const PAY_LABEL = { cash: 'Наличными курьеру', card: 'Карта' }

function PaymentBlock({ order }) {
  return (
    <Section title="Оплата">
      <Row k="Способ" v={PAY_LABEL[order.payment_method] || order.payment_method} />
      {order.payment_method === 'card' && order.payment_details && (<>
        <Row k="Карта" v={`**** ${order.payment_details.card_last4}`} />
        <Row k="Время" v={new Date(order.payment_details.paid_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })} />
        <Row k="Сумма" v={`${(order.payment_details.amount || 0).toLocaleString()} сум`} />
        <Row k="Статус" v={order.payment_confirmed ? 'Подтверждена' : 'Ожидает проверки'} accent={order.payment_confirmed ? '#2B8A3E' : CD} />
      </>)}
      {order.bonus_used > 0 && <Row k="Бонусы" v={`-${order.bonus_used} бон.`} />}
      {order.bottle_discount > 0 && <Row k="Скидка" v={`-${(order.bottle_discount).toLocaleString()} сум`} />}
      {(order.delivery_fee || 0) > 0 && <Row k="Доставка" v={`+${(order.delivery_fee).toLocaleString()} сум`} accent="#1971C2" />}
      <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, minWidth: 90 }}>Итого</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</span>
      </div>
    </Section>
  )
}

const CREATOR_LABEL = { manager: 'Менеджер', admin: 'Администратор', courier: 'Курьер', agent: 'Агент' }

function CreatorBlock({ order }) {
  const role = order.creator_role
  const effectiveName = order.creator_name || (role === 'courier' ? order.courier_name : null)
  const creatorStr = role
    ? `${CREATOR_LABEL[role] || role}${effectiveName ? ': ' + effectiveName : ''}`
    : `Клиент${order.client_name ? ': ' + order.client_name : ''}`
  const autoAssigned = role === 'courier' && order.assigner_role === 'courier'
  const assignerDisplay = autoAssigned ? 'Автоматически' : order.assigner_name
  const hasInfo = role || order.assigner_name
  if (!hasInfo && !order.client_name) return null
  return (
    <Section title="Источник">
      <Row k="Создал" v={creatorStr} />
      {assignerDisplay && <Row k="Назначил курьера" v={assignerDisplay} />}
    </Section>
  )
}

function BottlesBlock({ order }) {
  if (!order.client_bottles_owed && !order.return_bottles_count && !order.bottles_lent) return null
  const pending = order.client_bottles_pending || 0
  const available = order.client_bottles_owed != null ? Math.max(0, order.client_bottles_owed - pending) : null
  return (
    <Section title="Бутылки">
      {order.client_bottles_owed > 0 && <Row k="Долг клиента" v={`${order.client_bottles_owed} бут.`} accent="#E03131" />}
      {pending > 0 && <Row k="В процессе возврата" v={`${pending} бут.`} accent="#E67700" />}
      {available != null && pending > 0 && <Row k="Доступно к возврату" v={`${available} бут.`} />}
      {order.return_bottles_count > 0 && <Row k="Возврат в этом заказе" v={`${order.return_bottles_count} бут.`} accent={CD} />}
      {order.bottles_lent > 0 && <Row k="Одолжено" v={`${order.bottles_lent} бут.`} accent="#E67700" />}
    </Section>
  )
}

function Collapsible({ label, open, onToggle, children }) {
  return (
    <div>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
        color: CD, fontSize: 13, fontWeight: 700, WebkitTapHighlightColor: 'transparent',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {open ? 'Скрыть' : label}
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>}
    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
      <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
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

/* ─── Create order modal (manager) ─────────────────────────────────────────── */

function Stepper({ value, onDec, onInc, onChange, min = 0, max = Infinity }) {
  const canDec = value > min
  const canInc = value < max
  const handleInput = (e) => {
    const v = parseInt(e.target.value.replace(/\D/g, ''))
    const clamped = Math.max(min, Math.min(max === Infinity ? (isNaN(v) ? 0 : v) : max, isNaN(v) ? 0 : v))
    onChange?.(clamped)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={canDec ? onDec : undefined} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${canDec ? C : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: canDec ? C : TEXT2, cursor: canDec ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={value} onChange={handleInput} style={{ width: 44, textAlign: 'center', fontSize: 16, fontWeight: 800, border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '4px 0', color: TEXT, background: '#fff', fontFamily: 'inherit', outline: 'none' }} />
      <button onClick={canInc ? onInc : undefined} style={{ width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${canInc ? C : BORDER}`, background: canInc ? `${C}15` : '#F2F2F7', fontSize: 16, fontWeight: 700, color: canInc ? CD : TEXT2, cursor: canInc ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
    </div>
  )
}

function CreateOrderModal({ onClose, onSave, couriers = [] }) {
  const [phone, setPhone] = useState('')
  const [client, setClient] = useState(null)
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [address, setAddress] = useState('')
  const [extraInfo, setExtraInfo] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState({})
  const [returnBottles, setReturnBottles] = useState(0)
  const [lentBottles, setLentBottles] = useState(0)
  const [courierId, setCourierId] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    getProducts().then(p => setProducts((p || []).filter(x => x.is_active !== false))).catch(() => {})
  }, [])

  const handlePhoneChange = (val) => {
    setPhone(val)
    setClient(null)
    setNotFound(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const digits = val.replace(/\D/g, '')
    if (digits.length >= 9) {
      debounceRef.current = setTimeout(async () => {
        setLooking(true)
        try {
          const result = await lookupClientByPhone(val)
          setClient(result)
          setNotFound(false)
          // Pre-fill most recent order address
          const firstAddr = result?.order_addresses?.[0] || result?.addresses?.[0]
          if (firstAddr) {
            setAddress(firstAddr.address || '')
            setExtraInfo(firstAddr.extra_info || '')
          }
        } catch {
          setClient(null)
          setNotFound(true)
        }
        finally { setLooking(false) }
      }, 500)
    }
  }

  const add = (id) => setSelected(p => ({ ...p, [id]: (p[id] || 0) + 1 }))
  const rem = (id) => setSelected(p => {
    const n = { ...p }
    if (n[id] > 1) n[id]--; else delete n[id]
    return n
  })

  const deposit19L = products.filter(p => p.has_bottle_deposit)
  const qty19L = deposit19L.reduce((s, p) => s + (selected[p.id] || 0), 0)

  // Auto-set return to match 19L qty when products change
  useEffect(() => { setReturnBottles(qty19L); setLentBottles(0) }, [qty19L])

  const availReturn = client?.available_bottles ?? 0
  const surchargePerBottle = deposit19L.find(p => p.bottle_surcharge > 0)?.bottle_surcharge || 0
  const maxLent = Math.max(0, qty19L - returnBottles)
  const missingBottles = Math.max(0, qty19L - returnBottles - lentBottles)
  const bottleSurcharge = missingBottles > 0 ? missingBottles * surchargePerBottle : 0

  const subtotal = Object.entries(selected).reduce((sum, [id, qty]) => {
    const p = products.find(p => p.id === Number(id))
    return sum + (p ? p.price * qty : 0)
  }, 0)
  const grandTotal = subtotal + bottleSurcharge

  const items = Object.entries(selected)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = products.find(p => p.id === Number(id))
      return p ? { product_id: p.id, quantity: qty, price: p.price } : null
    }).filter(Boolean)

  const canSave = phone.replace(/\D/g, '').length >= 9 && address.trim() && (items.length > 0 || returnBottles > 0) && !!courierId

  const handle = async () => {
    if (!canSave) return
    setLoading(true)
    try {
      await onSave({
        phone: phone.trim(),
        address: address.trim(),
        note: extraInfo.trim() || null,
        total: grandTotal,
        items,
        user_id: client?.id || null,
        return_bottles_count: returnBottles,
        bottles_lent: lentBottles,
        bottle_surcharge: bottleSurcharge,
        latitude: lat,
        longitude: lng,
        creator_role: currentUser?.role || 'manager',
        courier_id: courierId ? Number(courierId) : null,
      })
      onClose()
    } catch (err) { alert(err?.response?.data?.detail || 'Ошибка при создании заказа') }
    finally { setLoading(false) }
  }

  const phoneDigits = phone.replace(/\D/g, '')
  const allAddresses = client?.order_addresses?.length
    ? client.order_addresses
    : (client?.addresses || []).map(a => ({ address: a.address, extra_info: '', lat: null, lng: null }))

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...s.sheet, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={s.sheetHandle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Новый заказ</div>
          <button onClick={onClose} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#F2F2F7', color: TEXT2, fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
        </div>

        {/* ── Phone ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Телефон клиента</Label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...s.inp, paddingRight: looking ? 36 : undefined }}
              placeholder="+998 90 123-45-67"
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              inputMode="tel"
            />
            {looking && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', border: `2px solid rgba(141,198,63,0.25)`, borderTop: `2px solid ${C}`, animation: 'spin 0.7s linear infinite' }} />
            )}
          </div>

          {/* Client card */}
          {client && (
            <div style={{ background: '#F8FFED', borderRadius: 14, border: `1px solid ${C}33`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{client.name || client.order_addresses?.[0]?.address || 'Клиент'}</div>
                <div style={{ fontSize: 12, color: TEXT2 }}>{client.phone}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip label="Доставок" value={client.order_count ?? 0} />
                {client.bottles_owed > 0 && (
                  <Chip label="Долг бутылок" value={client.available_bottles ?? client.bottles_owed} accent="#E03131" />
                )}
                {client.pending_return > 0 && (
                  <Chip label="В возврате" value={client.pending_return} accent={TEXT2} />
                )}
              </div>
            </div>
          )}
          {notFound && phoneDigits.length >= 9 && (
            <div style={{ fontSize: 12, color: TEXT2, padding: '6px 10px', background: '#F8F9FA', borderRadius: 10 }}>Клиент не найден — заказ сохранится по номеру телефона</div>
          )}
        </div>

        {/* ── Everything below only after lookup ── */}
        {(client || notFound) && <>

        {/* ── Address ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Адрес доставки</Label>

          {/* Past order addresses */}
          {allAddresses.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {allAddresses.map((a, i) => {
                const active = address === a.address
                return (
                  <button key={i} onClick={() => { setAddress(a.address); setExtraInfo(a.extra_info || ''); setLat(a.lat || null); setLng(a.lng || null) }} style={{
                    flexShrink: 0, padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: active ? `${C}18` : '#F2F2F7',
                    color: active ? CD : TEXT2,
                    border: active ? `1.5px solid ${C}` : '1.5px solid transparent',
                    maxWidth: 200, textAlign: 'left',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={[a.address, a.extra_info].filter(Boolean).join(' — ')}>
                    {a.address}
                    {a.extra_info && <span style={{ opacity: 0.65 }}> · {a.extra_info}</span>}
                  </button>
                )
              })}
            </div>
          )}

          <input style={s.inp} placeholder="Улица, дом, квартира" value={address} onChange={e => { setAddress(e.target.value); setLat(null); setLng(null) }} />
          <input style={s.inp} placeholder="Ориентир (необязательно)" value={extraInfo} onChange={e => setExtraInfo(e.target.value)} />
        </div>

        {/* ── Products ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Состав заказа</Label>
          {products.length === 0 ? (
            <div style={{ color: TEXT2, fontSize: 13, padding: 8 }}>Загрузка...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#fff', borderRadius: 14, border: `1.5px solid ${BORDER}`, overflow: 'hidden' }}>
              {products.map((p, i) => {
                const qty = selected[p.id] || 0
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px',
                    borderBottom: i < products.length - 1 ? `1px solid ${BORDER}` : 'none',
                    background: qty > 0 ? `${C}07` : 'transparent',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: TEXT2 }}>
                        {Number(p.price).toLocaleString()} сум
                      </div>
                    </div>
                    {qty > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: CD, whiteSpace: 'nowrap' }}>
                        {(p.price * qty).toLocaleString()} сум
                      </div>
                    )}
                    <Stepper value={qty} onDec={() => rem(p.id)} onInc={() => add(p.id)} onChange={v => setSelected(prev => v === 0 ? (({ [p.id]: _, ...rest }) => rest)(prev) : { ...prev, [p.id]: v })} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Bottle return ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${BORDER}`, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label>Возврат бутылок 19л</Label>
            {client && availReturn > 0 && (
              <span style={{ fontSize: 11, color: TEXT2 }}>Долг: {availReturn} шт.</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Stepper value={returnBottles} onDec={() => setReturnBottles(Math.max(0, returnBottles - 1))} onInc={() => setReturnBottles(returnBottles + 1)} onChange={v => setReturnBottles(v)} />
            {qty19L > 0 && <span style={{ fontSize: 13, color: TEXT2 }}>из {qty19L} заказанных</span>}
          </div>
          {missingBottles > 0 && surchargePerBottle > 0 && (
            <div style={{ fontSize: 12, color: '#E03131', background: '#FFF0F0', borderRadius: 8, padding: '6px 10px', fontWeight: 600 }}>
              {missingBottles} бут. не возвращается — надбавка +{Number(bottleSurcharge).toLocaleString()} сум
            </div>
          )}
        </div>

        {/* ── Lent bottles ── */}
        <div style={{ background: '#FFF8E7', borderRadius: 14, border: '1.5px solid #FFD87A', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Label style={{ color: '#E67700' }}>Одолжить бутылки</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Stepper value={lentBottles}
              onDec={() => setLentBottles(Math.max(0, lentBottles - 1))}
              onInc={() => setLentBottles(lentBottles + 1)}
              onChange={v => setLentBottles(Math.max(0, v))} />
            {lentBottles > 0 && <span style={{ fontSize: 12, color: '#E67700' }}>клиент вернёт позже, без надбавки</span>}
          </div>
        </div>

        {/* ── Total ── */}
        {(items.length > 0 || bottleSurcharge > 0) && (
          <div style={{ background: '#F8FFED', borderRadius: 12, padding: '12px 14px', border: `1px solid ${C}33`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT2 }}>
              <span>Товары</span>
              <span>{Number(subtotal).toLocaleString()} сум</span>
            </div>
            {bottleSurcharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#E03131' }}>
                <span>Надбавка за бутылки</span>
                <span>+{Number(bottleSurcharge).toLocaleString()} сум</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: TEXT, borderTop: `1px solid ${C}22`, paddingTop: 6, marginTop: 2 }}>
              <span>Итого</span>
              <span style={{ color: CD }}>{Number(grandTotal).toLocaleString()} сум</span>
            </div>
          </div>
        )}

        {/* ── Courier selection ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Курьер</Label>
          <select
            style={{ ...s.inp, appearance: 'none', WebkitAppearance: 'none' }}
            value={courierId}
            onChange={e => setCourierId(e.target.value)}
          >
            <option value="">-- Выберите курьера --</option>
            {couriers.filter(c => c.is_active !== false).map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
            ))}
          </select>
        </div>

        <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(141,198,63,0.35)', opacity: canSave ? 1 : 0.45 }} disabled={!canSave || loading} onClick={handle}>
          {loading ? 'Создаю...' : `Создать заказ · ${Number(grandTotal).toLocaleString()} сум`}
        </button>

        </> /* end lookup guard */}
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{children}</div>
}

function Chip({ label, value, accent }) {
  const clr = accent || CD
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: `${clr}12`, borderRadius: 8, padding: '4px 10px', minWidth: 56 }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: clr }}>{value}</span>
      <span style={{ fontSize: 10, color: clr, opacity: 0.8, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  inp: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
}

const st = {
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
    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
    padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${C}`,
    background: '#fff', color: CD, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  btnOutline: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
  },
}
