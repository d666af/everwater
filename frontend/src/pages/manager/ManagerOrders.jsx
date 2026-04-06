import { useEffect, useState, useCallback } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getOrders, confirmOrder, rejectOrder, assignCourier, getAdminCouriers, markInDelivery, markDelivered } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const STAGES = [
  { key: 'all', label: 'Все', icon: '📋' },
  { key: 'payment', label: 'Проверка оплаты', icon: '💳' },
  { key: 'assign', label: 'Назначение курьера', icon: '🚚' },
  { key: 'delivery', label: 'В доставке', icon: '📦' },
  { key: 'done', label: 'Завершённые', icon: '✅' },
]

function getStage(order) {
  if (order.status === 'awaiting_confirmation') {
    if (order.payment_method === 'card' && !order.payment_confirmed) return 'payment'
    return 'assign'
  }
  if (order.status === 'confirmed') return 'assign'
  if (order.status === 'assigned_to_courier' || order.status === 'in_delivery') return 'delivery'
  if (order.status === 'delivered') return 'done'
  if (order.status === 'rejected') return 'done'
  return 'payment'
}

function stageCounts(orders) {
  const c = { payment: 0, assign: 0, delivery: 0, done: 0 }
  orders.forEach(o => { const s = getStage(o); if (c[s] !== undefined) c[s]++ })
  return c
}

const REJECT_SCRIPTS = [
  'Не удалось подтвердить оплату',
  'Нет в наличии',
  'Неверный адрес доставки',
  'Клиент не выходит на связь',
]

export default function ManagerOrders() {
  const [orders, setOrders] = useState([])
  const [stage, setStage] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [couriers, setCouriers] = useState([])
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [assigningId, setAssigningId] = useState(null)
  const [selectedCourier, setSelectedCourier] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

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
    catch { alert('Ошибка операции') }
    finally { setActionLoading(false) }
  }

  const counts = stageCounts(orders)
  const displayed = stage === 'all' ? orders : orders.filter(o => getStage(o) === stage)

  return (
    <ManagerLayout title="Панель">
      {/* Stage filter cards */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4, marginBottom: 16 }}>
        {STAGES.map(s => {
          const active = stage === s.key
          const count = s.key === 'all' ? orders.length : (counts[s.key] || 0)
          const urgent = s.key === 'payment' && counts.payment > 0
          return (
            <button key={s.key} onClick={() => setStage(s.key)} style={{
              flexShrink: 0, minWidth: 100, padding: '12px 14px', borderRadius: 16,
              background: active ? '#fff' : 'rgba(255,255,255,0.6)',
              border: active ? `2px solid ${C}` : `1.5px solid ${BORDER}`,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
              boxShadow: active ? `0 2px 12px rgba(141,198,63,0.15)` : '0 1px 4px rgba(0,0,0,0.04)',
              WebkitTapHighlightColor: 'transparent', position: 'relative',
            }}>
              {urgent && !active && (
                <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#FF3B30' }} />
              )}
              <div style={{ fontSize: 22, lineHeight: 1 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: active ? CD : TEXT2, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT2 }} onClick={load} disabled={loading}>
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
    </ManagerLayout>
  )
}

/* ─── Order card ─────────────────────────────────────────────────────────────── */

function OrderCard({
  order, expanded, onToggle, couriers,
  rejectingId, setRejectingId, rejectReason, setRejectReason,
  assigningId, setAssigningId, selectedCourier, setSelectedCourier,
  actionLoading, act,
}) {
  const orderStage = getStage(order)
  const stageColor = {
    payment: '#E67700',
    assign: '#1971C2',
    delivery: '#9C36B5',
    done: '#2B8A3E',
  }[orderStage] || TEXT2

  const stageLabel = {
    payment: 'Проверка оплаты',
    assign: 'Назначение курьера',
    delivery: order.status === 'in_delivery' ? 'В пути' : 'Курьер назначен',
    done: order.status === 'rejected' ? 'Отклонён' : 'Доставлен',
  }[orderStage] || order.status

  return (
    <div style={{
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      borderLeft: orderStage === 'payment' ? '3px solid #E67700' : orderStage === 'assign' ? '3px solid #1971C2' : 'none',
    }}>
      {/* Header — always visible */}
      <div style={{ padding: '14px 16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={onToggle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>#{order.id}</span>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: stageColor + '18', color: stageColor }}>{stageLabel}</span>
              {order.payment_method === 'card' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, background: '#F8F9FA', color: TEXT2 }}>💳 Карта</span>
              )}
              {order.payment_method === 'balance' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, background: '#F8F9FA', color: TEXT2 }}>💰 Баланс</span>
              )}
            </div>
            {order.client_name && <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginTop: 4 }}>{order.client_name}</div>}
            <div style={{ fontSize: 12, color: TEXT2, marginTop: 2, lineHeight: 1.3 }}>{order.address}</div>
            {order.delivery_time && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>🕐 {order.delivery_time}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 6, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Items */}
          {order.items?.length > 0 && (
            <Section title="Состав заказа">
              {order.items.map(i => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: TEXT }}>{i.product_name}</span>
                  <span style={{ color: TEXT2, flexShrink: 0 }}>× {i.quantity}</span>
                  <span style={{ fontWeight: 700, color: TEXT, flexShrink: 0 }}>{((i.price || 0) * i.quantity).toLocaleString()} сум</span>
                </div>
              ))}
            </Section>
          )}

          {/* Delivery info */}
          <Section title="Доставка">
            <Row k="Адрес" v={order.address} />
            {order.extra_info && <Row k="Доп. инфо" v={order.extra_info} />}
            {order.delivery_time && <Row k="Время" v={order.delivery_time} />}
            {order.recipient_phone && <Row k="Телефон" v={order.recipient_phone} />}
            {order.latitude && (
              <div style={{ marginTop: 4 }}>
                <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1971C2', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
                  Открыть на карте
                </a>
              </div>
            )}
          </Section>

          {/* Payment info */}
          <Section title="Оплата">
            <Row k="Способ" v={order.payment_method === 'card' ? 'Карта' : 'Баланс'} />
            {order.payment_method === 'card' && order.payment_details && (
              <>
                <Row k="Карта" v={`•••• ${order.payment_details.card_last4}`} />
                <Row k="Время оплаты" v={new Date(order.payment_details.paid_at).toLocaleString('ru')} />
                <Row k="Сумма" v={`${(order.payment_details.amount || 0).toLocaleString()} сум`} />
                <Row k="Статус" v={order.payment_confirmed ? '✅ Подтверждена' : '⏳ Ожидает проверки'} accent={order.payment_confirmed ? '#2B8A3E' : '#E67700'} />
              </>
            )}
            {order.payment_method === 'balance' && (
              <Row k="Статус" v="✅ Списано с баланса" accent="#2B8A3E" />
            )}
            {order.bonus_used > 0 && <Row k="Бонусы" v={`−${order.bonus_used} бон.`} accent="#E67700" />}
            {order.bottle_discount > 0 && <Row k="Скидка" v={`−${(order.bottle_discount).toLocaleString()} сум`} accent={CD} />}
            <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, minWidth: 90 }}>Итого</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</span>
            </div>
          </Section>

          {/* Bottles */}
          {(order.bottles_owed > 0 || order.return_bottles_count > 0) && (
            <Section title="Бутылки">
              {order.bottles_owed > 0 && <Row k="Долг" v={`${order.bottles_owed} бут.`} accent="#E03131" />}
              {order.return_bottles_count > 0 && <Row k="Возврат" v={`${order.return_bottles_count} бут.`} accent={CD} />}
            </Section>
          )}

          {/* Courier info — visible when assigned */}
          {(order.courier_name || order.courier_id) && (
            <Section title="Курьер">
              <Row k="Имя" v={order.courier_name || `ID: ${order.courier_id}`} />
              {order.courier_phone && <Row k="Телефон" v={order.courier_phone} />}
            </Section>
          )}

          {/* ─── ACTION BUTTONS by stage ─── */}

          {/* Stage: Payment verification (card orders) */}
          {orderStage === 'payment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#FFF8E6', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>💳</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Подтвердите оплату</div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>Проверьте поступление средств на карту</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={st.btnPrimary} disabled={actionLoading} onClick={() => act(() => confirmOrder(order.id))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Оплата получена
                </button>
                <button style={st.btnDanger} disabled={actionLoading} onClick={() => { setRejectingId(order.id); setRejectReason('') }}>
                  Отклонить
                </button>
              </div>
            </div>
          )}

          {/* Stage: Assign courier */}
          {orderStage === 'assign' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#E7F5FF', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🚚</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Назначьте курьера</div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>Выберите свободного курьера на дату доставки</div>
                </div>
              </div>
              {assigningId === order.id ? (
                <div style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${BORDER}` }}>
                  <select style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, outline: 'none', background: '#fff', color: TEXT }} value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)}>
                    <option value="">— Выберите курьера —</option>
                    {couriers.filter(c => c.is_active !== false).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.delivery_count} дост.)</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer' }} onClick={() => setAssigningId(null)}>Отмена</button>
                    <button style={{ ...st.btnPrimary, opacity: !selectedCourier ? 0.5 : 1 }} disabled={actionLoading || !selectedCourier} onClick={() => act(() => assignCourier(order.id, selectedCourier).then(() => setAssigningId(null)))}>
                      Назначить
                    </button>
                  </div>
                </div>
              ) : (
                <button style={st.btnSecondary} onClick={() => { setAssigningId(order.id); setSelectedCourier('') }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  Выбрать курьера
                </button>
              )}
            </div>
          )}

          {/* Stage: In delivery */}
          {orderStage === 'delivery' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {order.status === 'assigned_to_courier' && (
                <>
                  <div style={{ background: '#F3F0FF', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>📦</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Курьер назначен</div>
                      <div style={{ fontSize: 12, color: TEXT2 }}>Ожидание забора заказа курьером</div>
                    </div>
                  </div>
                  <button style={st.btnSecondary} disabled={actionLoading} onClick={() => act(() => markInDelivery(order.id))}>
                    Отметить «В пути» вручную
                  </button>
                </>
              )}
              {order.status === 'in_delivery' && (
                <>
                  <div style={{ background: '#F3F0FF', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🏃</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>В пути</div>
                      <div style={{ fontSize: 12, color: TEXT2 }}>Курьер доставляет заказ</div>
                    </div>
                  </div>
                  <button style={st.btnPrimary} disabled={actionLoading} onClick={() => act(() => markDelivered(order.id))}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Отметить «Доставлен»
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reject form (shared) */}
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
              <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px', fontSize: 15, outline: 'none', background: '#fff', color: TEXT }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Или введите свою причину..." />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer' }} onClick={() => setRejectingId(null)}>Отмена</button>
                <button style={{ ...st.btnDanger, opacity: !rejectReason.trim() ? 0.5 : 1 }} disabled={actionLoading || !rejectReason.trim()} onClick={() => act(() => rejectOrder(order.id, rejectReason).then(() => setRejectingId(null)))}>Отклонить заказ</button>
              </div>
            </div>
          )}

          {/* Quick actions row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {order.recipient_phone && (
              <a href={`tel:${order.recipient_phone}`} style={st.btnOutline}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
                Клиент
              </a>
            )}
            {order.courier_phone && (
              <a href={`tel:${order.courier_phone}`} style={st.btnOutline}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
                Курьер
              </a>
            )}
          </div>
        </div>
      )}
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
    display: 'flex', alignItems: 'center', gap: 6,
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
