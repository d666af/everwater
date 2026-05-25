import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getAgentOrders, updateOrderItems, getProducts } from '../../api'
import { useAuthStore } from '../../store/auth'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const todayUTC = () => new Date().toISOString().slice(0, 10)

function fmtDateStr(s) {
  if (!s) return ''
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const STATUS_CFG = {
  new:                   { label: 'Новый',             bg: '#F2F2F7', color: TEXT2 },
  awaiting_confirmation: { label: 'Ожидает',           bg: '#FFF3BF', color: '#E67700' },
  confirmed:             { label: 'Подтверждён',       bg: '#FFF3BF', color: '#E67700' },
  assigned_to_courier:   { label: 'Назначен курьеру',  bg: `${C}15`,  color: CD },
  in_delivery:           { label: 'В пути',            bg: '#E7F5FF', color: '#1971C2' },
  delivered:             { label: 'Доставлен',         bg: '#EBFBEE', color: '#2B8A3E' },
  rejected:              { label: 'Отклонён',          bg: '#FFF5F5', color: '#E03131' },
  cancellation_requested:{ label: 'Отмена',            bg: '#FFF5F5', color: '#E03131' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, bg: '#F2F2F7', color: TEXT2 }
  return (
    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function CStepper({ value, onDec, onInc, onChange, min = 0, max = Infinity }) {
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

function EditItemsModal({ order, agentName, onClose, onSave }) {
  const [items, setItems] = useState({})
  const [products, setProducts] = useState([])
  const [returnBottles, setReturnBottles] = useState(order.return_bottles_count || 0)
  const [lentBottles, setLentBottles] = useState(order.bottles_lent || 0)
  const [productsLoading, setProductsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const initial = {}
    for (const item of order.items || []) {
      const pid = String(item.product_id ?? item.id)
      if (pid) initial[pid] = item.quantity
    }
    setItems(initial)
    setProductsLoading(true)
    getProducts()
      .then(p => setProducts(p || []))
      .catch(() => {})
      .finally(() => setProductsLoading(false))
  }, [])

  const allProducts = useMemo(() => {
    const activeIds = new Set(products.map(p => String(p.id)))
    const extras = []
    for (const item of order.items || []) {
      const pid = String(item.product_id ?? item.id)
      if (pid && !activeIds.has(pid)) {
        extras.push({ id: parseInt(pid), name: item.product_name, is_active: false })
      }
    }
    return [...products, ...extras]
  }, [products, order.items])

  const setQty = (pid, qty) => {
    setItems(prev => {
      const n = { ...prev }
      if (qty <= 0) delete n[pid]
      else n[pid] = qty
      return n
    })
  }

  const handleSave = async () => {
    const payload = Object.entries(items)
      .filter(([, qty]) => qty > 0)
      .map(([pid, qty]) => ({ product_id: parseInt(pid), quantity: qty }))
    if (payload.length === 0) { alert('Добавьте хотя бы один товар'); return }
    setSaving(true)
    try {
      await updateOrderItems(order.id, payload, returnBottles, lentBottles, agentName)
      onSave()
      onClose()
    } catch {
      alert('Ошибка при сохранении состава')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9100, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={CD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={CD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, lineHeight: 1.2 }}>Изменить состав</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{order.address}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Товары</div>
          {productsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C}30`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allProducts.map(p => {
                const pid = String(p.id)
                const qty = items[pid] || 0
                const inOrder = qty > 0
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: inOrder ? `${C}0D` : '#F8F9FA', borderRadius: 14, padding: '11px 14px', border: inOrder ? `1.5px solid ${C}35` : '1.5px solid transparent', transition: 'all 0.15s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: inOrder ? 700 : 500, color: inOrder ? TEXT : TEXT2, lineHeight: 1.2 }}>{p.name}</div>
                      {!p.is_active && <div style={{ fontSize: 11, color: '#E67700', marginTop: 1 }}>недоступен</div>}
                    </div>
                    <CStepper value={qty} onDec={() => setQty(pid, qty - 1)} onInc={() => setQty(pid, qty + 1)} onChange={v => setQty(pid, v)} min={0} />
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, margin: '18px 0 10px' }}>Бутылки</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#E6FCF5', borderRadius: 14, padding: '11px 14px', border: '1.5px solid rgba(18,184,134,0.2)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0A7A5C' }}>♻️ Забрать пустых</div>
              </div>
              <CStepper value={returnBottles} onDec={() => setReturnBottles(v => Math.max(0, v - 1))} onInc={() => setReturnBottles(v => v + 1)} onChange={v => setReturnBottles(Math.max(0, v))} min={0} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFF8ED', borderRadius: 14, padding: '11px 14px', border: '1.5px solid rgba(230,119,0,0.2)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#E67700' }}>📦 Одолжить</div>
              </div>
              <CStepper value={lentBottles} onDec={() => setLentBottles(v => Math.max(0, v - 1))} onInc={() => setLentBottles(v => v + 1)} onChange={v => setLentBottles(Math.max(0, v))} min={0} />
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px 40px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, background: '#fff' }}>
          <button
            disabled={saving}
            onClick={handleSave}
            style={{ padding: '15px 0', borderRadius: 14, border: 'none', background: saving ? '#C8D6BC' : `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 4px 14px rgba(141,198,63,0.35)', transition: 'all 0.2s' }}
          >
            {saving ? 'Сохранение…' : '✅ Сохранить'}
          </button>
          <button onClick={onClose} style={{ padding: '14px 0', borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const EDIT_STATUSES = new Set(['confirmed', 'assigned_to_courier', 'in_delivery'])

function OrderCard({ order, onEditItems }) {
  const [open, setOpen] = useState(false)
  const date = new Date(order.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <StatusBadge status={order.status} />
              <span style={{ fontSize: 11, color: TEXT2 }}>{date}</span>
              {order.is_items_edited && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600, background: '#FFF3BF', color: '#E67700' }}>
                  ✏️{order.items_edited_by ? ` Изм. ${order.items_edited_by}` : ' Изменено'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{order.recipient_phone}</div>
            {order.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.address}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>{(order.total || 0).toLocaleString()} сум</div>
            {(order.agent_earning || 0) > 0 && (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2B8A3E' }}>+{(order.agent_earning || 0).toLocaleString()} зар.</div>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 4, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
              <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.items?.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Состав</div>
              {order.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: TEXT, fontWeight: 500 }}>{item.product_name}</span>
                  <span style={{ fontWeight: 700, color: TEXT2 }}>× {item.quantity} шт.</span>
                </div>
              ))}
            </>
          )}
          {(order.return_bottles_count > 0 || order.bottles_lent > 0 || order.bottle_surcharge > 0) && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {order.return_bottles_count > 0 && (
                <div style={{ fontSize: 12, color: TEXT2 }}>
                  ♻️ Возврат бутылок: <strong>{order.return_bottles_count} шт.</strong>
                </div>
              )}
              {order.bottles_lent > 0 && (
                <div style={{ fontSize: 12, color: '#E67700' }}>
                  🔄 Одолжено: <strong>{order.bottles_lent} шт.</strong>
                </div>
              )}
              {order.bottle_surcharge > 0 && (
                <div style={{ fontSize: 12, color: '#E67700' }}>
                  🫙 Надбавка за невозврат: <strong>+{order.bottle_surcharge.toLocaleString()} сум</strong>
                </div>
              )}
            </div>
          )}
          {order.client_name && (
            <div style={{ marginTop: 4, fontSize: 12, color: TEXT2 }}>Клиент: <strong>{order.client_name}</strong></div>
          )}
          {EDIT_STATUSES.has(order.status) && onEditItems && (
            <button
              onClick={e => { e.stopPropagation(); onEditItems(order) }}
              style={{ marginTop: 6, padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${C}`, background: `${C}12`, color: CD, fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              ✏️ Изменить состав
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
}

export default function AgentOrders() {
  const { user } = useAuthStore()
  const agentId = user?.agent_id
  const agentName = user?.name || ''

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allTimeOrders, setAllTimeOrders] = useState(null)
  const [editOrder, setEditOrder] = useState(null)

  const { dateFrom, dateTo } = (() => {
    if (period === 'today') {
      const t = todayUTC()
      return { dateFrom: t, dateTo: t }
    }
    return { dateFrom: customDate || todayUTC(), dateTo: customDateTo || customDate || todayUTC() }
  })()

  const periodLabel = period === 'custom'
    ? (customDate
        ? (customDateTo && customDateTo !== customDate
            ? `${fmtDateStr(customDate)} – ${fmtDateStr(customDateTo)}`
            : fmtDateStr(customDate))
        : 'Дата')
    : 'Сегодня'

  const load = useCallback(() => {
    if (!agentId) { setLoading(false); return }
    setLoading(true)
    getAgentOrders(agentId, { date_from: dateFrom, date_to: dateTo })
      .then(data => setOrders(data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [agentId, dateFrom, dateTo])

  useEffect(() => {
    tg?.ready?.()
    tg?.expand?.()
    if (agentId) {
      getAgentOrders(agentId).then(data => setAllTimeOrders(data || [])).catch(() => setAllTimeOrders([]))
    }
  }, [agentId]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const applyCustom = (start, end) => {
    setCustomDate(start)
    setCustomDateTo(end)
    setPeriod('custom')
  }

  const deliveredOrders = orders.filter(o => o.status === 'delivered')
  const deliveredCount = deliveredOrders.length
  const totalSum = deliveredOrders.reduce((s, o) => s + (o.total || 0), 0)
  const totalEarned = deliveredOrders.reduce((s, o) => s + (o.agent_earning || 0), 0)

  const lentOrdersAll = orders.filter(o => (o.bottles_lent || 0) > 0)
  const totalLent = lentOrdersAll.reduce((s, o) => s + (o.bottles_lent || 0), 0)
  const lentByCourierMap = {}
  lentOrdersAll.forEach(o => {
    const name = o.courier_name || 'Не назначен'
    lentByCourierMap[name] = (lentByCourierMap[name] || 0) + (o.bottles_lent || 0)
  })
  const lentByCourier = Object.entries(lentByCourierMap).sort((a, b) => b[1] - a[1])
  const allTimeCount = allTimeOrders ? allTimeOrders.length : null
  const allTimeEarned = allTimeOrders ? allTimeOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.agent_earning || 0), 0) : null

  return (
    <div style={{ minHeight: '100vh', background: '#e4e4e8', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {editOrder && (
        <EditItemsModal
          order={editOrder}
          agentName={agentName}
          onClose={() => setEditOrder(null)}
          onSave={load}
        />
      )}

      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate}
          initialDateTo={customDateTo}
          onApply={applyCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Header */}
      <div style={{ background: '#e4e4e8', padding: '16px 20px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 800, color: TEXT }}>История заказов</div>
      </div>

      {/* All-time summary card (above filter) */}
      {allTimeCount !== null && (
        <div style={{ padding: '8px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Всего заказов</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: CD }}>{allTimeCount}</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>за всё время</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Всего заработано</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: CD }}>{(allTimeEarned || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>сум</div>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div style={{ padding: '12px 16px', background: '#e4e4e8' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPeriod('today')}
            style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: period === 'today' ? `linear-gradient(135deg, ${C}, ${CD})` : '#F2F2F7', color: period === 'today' ? '#fff' : TEXT2, transition: 'all 0.15s' }}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: period === 'custom' ? `linear-gradient(135deg, ${C}, ${CD})` : '#F2F2F7', color: period === 'custom' ? '#fff' : TEXT2, transition: 'all 0.15s' }}
          >
            {period === 'custom' ? periodLabel : 'Дата'}
          </button>
        </div>
      </div>

      {/* Period summary (below filter) */}
      {!loading && (
        <div style={{ padding: '0 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Заказов</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: CD }}>{orders.length}</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>доставлено: {deliveredCount}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Заработано</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: CD }}>{totalEarned.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>сум</div>
          </div>
        </div>
      )}

      {/* Lent bottles summary */}
      {!loading && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ background: '#FFF8ED', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(230,119,0,0.18)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#E67700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Одолжено бутылок</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#E67700', lineHeight: 1, marginBottom: 8 }}>{totalLent}</div>
            {lentByCourier.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#E67700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>Кто доставил</div>
                {lentByCourier.map(([name, cnt]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT }}>
                    <span>{name}</span>
                    <span style={{ fontWeight: 700, color: '#E67700' }}>{cnt} шт.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders list */}
      <div style={{ flex: 1, padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spinner />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, opacity: 0.3 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT2 }}>Нет заказов за этот период</div>
          </div>
        ) : (
          orders.map(o => <OrderCard key={o.id} order={o} onEditItems={setEditOrder} />)
        )}
      </div>
    </div>
  )
}
