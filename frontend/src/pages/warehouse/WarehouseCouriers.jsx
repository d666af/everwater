import { useEffect, useMemo, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import {
  getWarehouseCourierStats, getWarehouseStock, getCatalogProducts,
  issueWaterToCourier, returnWaterFromCourier, issueOrderToCourier,
} from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

export default function WarehouseCouriers() {
  const [couriers, setCouriers] = useState([])
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [showManual, setShowManual] = useState(null)   // { courier, mode: 'issue'|'return' }
  const [expanded, setExpanded] = useState(null)

  const catalog = useMemo(() => getCatalogProducts(), [])

  const load = () => {
    setLoading(true)
    Promise.all([getWarehouseCourierStats(), getWarehouseStock()])
      .then(([cs, wh]) => { setCouriers(cs); setStock(wh.stock || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const stockMap = {}
  stock.forEach(s => { stockMap[s.product_name] = s.quantity })

  const issueBatch = async (courierId, courierName, items) => {
    for (const [product, qty] of Object.entries(items)) {
      await issueWaterToCourier(courierId, courierName, product, qty)
    }
    load()
  }
  const returnBatch = async (courierId, courierName, items) => {
    for (const [product, qty] of Object.entries(items)) {
      await returnWaterFromCourier(courierId, courierName, product, qty)
    }
    load()
  }
  const issueOrder = async (orderId, courierId, courierName) => {
    await issueOrderToCourier(orderId, courierId, courierName)
    load()
  }

  // Aggregates
  const totalActiveOrders = couriers.reduce((s, c) => s + (c.active_orders_count || 0), 0)
  const totalPickupItems = couriers.reduce((s, c) => s + Object.values(c.to_pickup || {}).reduce((a, b) => a + b, 0), 0)
  const totalBottlesMust = couriers.reduce((s, c) => s + (c.bottles_must_return || 0), 0)
  const totalBottlesRet = couriers.reduce((s, c) => s + (c.bottles_returned_today || 0), 0)

  return (
    <WarehouseLayout title="Курьеры">
      {showManual && (
        <BatchModal
          mode={showManual.mode}
          courier={showManual.courier}
          catalog={catalog}
          stockMap={stockMap}
          courierWater={showManual.courier.water || {}}
          onClose={() => setShowManual(null)}
          onSave={(items) => (showManual.mode === 'issue'
            ? issueBatch(showManual.courier.id, showManual.courier.name, items)
            : returnBatch(showManual.courier.id, showManual.courier.name, items))}
        />
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: TEXT2 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Нет активных курьеров</div>
        </div>
      ) : (
        <>
          {/* Top summary — clear, non-ambiguous labels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <SumCard label="Активных заказов" sub="у курьеров" value={totalActiveOrders} color="#E67700" />
            <SumCard label="К выдаче со склада" sub="бут./бут. воды" value={totalPickupItems} color={C} />
          </div>

          {/* 20L bottles — must/already returned today */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Бутыли 20л</div>
                <div style={{ fontSize: 11, color: TEXT2 }}>возврат на склад сегодня</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#1971C2', lineHeight: 1 }}>{totalBottlesRet}</span>
                <span style={{ fontSize: 14, color: TEXT2 }}>/ {totalBottlesMust}</span>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: '#E8F4FD', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalBottlesMust ? Math.min(100, (totalBottlesRet / totalBottlesMust) * 100) : 0}%`, background: 'linear-gradient(90deg, #1971C2, #4DABF7)', transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* Courier list */}
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Курьеры</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {couriers.map(c => (
              <CourierCard
                key={c.id}
                c={c}
                expanded={expanded === c.id}
                onToggle={() => setExpanded(e => e === c.id ? null : c.id)}
                onIssueOrder={issueOrder}
                onManualIssue={() => setShowManual({ courier: c, mode: 'issue' })}
                onManualReturn={() => setShowManual({ courier: c, mode: 'return' })}
              />
            ))}
          </div>
        </>
      )}
    </WarehouseLayout>
  )
}

function SumCard({ label, sub, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '12px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: TEXT, marginTop: 5, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: TEXT2, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function CourierCard({ c, expanded, onToggle, onIssueOrder, onManualIssue, onManualReturn }) {
  const pickupEntries = Object.entries(c.to_pickup || {}).filter(([, q]) => q > 0)
  const waterEntries = Object.entries(c.water || {}).filter(([, q]) => q > 0)
  const deliveredEntries = Object.entries(c.delivered_products || {}).filter(([, q]) => q > 0)
  const pickupTotal = pickupEntries.reduce((s, [, q]) => s + q, 0)
  const waterTotal = waterEntries.reduce((s, [, q]) => s + q, 0)
  const deliveredTotal = deliveredEntries.reduce((s, [, q]) => s + q, 0)

  const activeOrders = c.active_orders || []
  const mustBottles = c.bottles_must_return || 0
  const retBottles = c.bottles_returned_today || 0

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          <div style={{ fontSize: 11, color: TEXT2, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>Заказов: <b style={{ color: activeOrders.length > 0 ? '#E67700' : TEXT2 }}>{activeOrders.length}</b></span>
            <span>На руках: <b style={{ color: waterTotal > 0 ? CD : TEXT2 }}>{waterTotal}</b></span>
            {mustBottles > 0 && <span>Бутыли: <b style={{ color: '#1971C2' }}>{retBottles}/{mustBottles}</b></span>}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Assigned orders → per-order Issue button */}
          {activeOrders.length > 0 && (
            <Section title={`Назначенные заказы · ${activeOrders.length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeOrders.map(o => (
                  <AssignedOrderRow
                    key={o.id}
                    order={o}
                    onIssue={() => onIssueOrder(o.id, c.id, c.name)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Pickup summary across all active orders */}
          {pickupEntries.length > 0 && (
            <Section title={`Забрать со склада · ${pickupTotal} шт.`}>
              <TagList items={pickupEntries} fg="#E67700" bg="#FFF3D9" />
            </Section>
          )}

          {/* Current on-hand */}
          {waterEntries.length > 0 && (
            <Section title={`На руках · ${waterTotal} шт.`}>
              <TagList items={waterEntries} fg={CD} bg={`${C}15`} />
            </Section>
          )}

          {/* Delivered today — per product */}
          {deliveredEntries.length > 0 && (
            <Section title={`Доставил сегодня · ${deliveredTotal} шт.`}>
              <TagList items={deliveredEntries} fg="#2B8A3E" bg="#EBFBEE" />
            </Section>
          )}

          {/* 20L bottle tracking line */}
          {mustBottles > 0 && (
            <Section title="Бутыли 20л — возврат на склад">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: '#E8F4FD', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (retBottles / mustBottles) * 100)}%`, background: 'linear-gradient(90deg, #1971C2, #4DABF7)', transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1971C2' }}>
                  {retBottles}<span style={{ color: TEXT2, fontWeight: 600 }}> / {mustBottles}</span>
                </span>
              </div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 4 }}>
                Вернул сегодня · должен вернуть по активным и доставленным
              </div>
            </Section>
          )}

          {/* Manual ops (if an unplanned issue/return is ever needed) */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: 'none', background: GRAD, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={onManualIssue}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Доп. выдача
            </button>
            {waterTotal > 0 && (
              <button style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={onManualReturn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Возврат на склад
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

function TagList({ items, fg, bg }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(([name, qty]) => (
        <span key={name} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: bg, color: fg, fontWeight: 600 }}>
          {name} · {qty}
        </span>
      ))}
    </div>
  )
}

function AssignedOrderRow({ order, onIssue }) {
  const [loading, setLoading] = useState(false)
  const issued = !!order.water_issued
  const handle = async () => { setLoading(true); try { await onIssue() } finally { setLoading(false) } }

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '10px 12px', background: issued ? '#FAFBF6' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: TEXT2, background: '#F2F2F7', padding: '3px 8px', borderRadius: 6 }}>#{order.id}</span>
        {order.delivery_date && (
          <span style={{ fontSize: 11, color: TEXT2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {order.delivery_date}{order.delivery_period ? ` · ${order.delivery_period}` : ''}
          </span>
        )}
        {issued && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#EBFBEE', color: '#2B8A3E', fontWeight: 700 }}>Выдано</span>
        )}
      </div>
      {(order.client_name || order.address) && (
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
          {order.client_name ? `${order.client_name} · ` : ''}{order.address}
        </div>
      )}
      {(order.items || []).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: issued ? 0 : 8 }}>
          {order.items.map(it => (
            <span key={it.key || it.short_name} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#F2F2F7', color: TEXT, fontWeight: 600 }}>
              {it.short_name} × {it.quantity}
            </span>
          ))}
          {order.return_bottles_count > 0 && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#E8F4FD', color: '#1971C2', fontWeight: 700 }}>
              вернуть 20л: {order.return_bottles_count}
            </span>
          )}
        </div>
      )}
      {!issued && (
        <button
          onClick={handle}
          disabled={loading || (order.items || []).length === 0}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none',
            background: GRAD, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: '0 3px 10px rgba(141,198,63,0.3)',
            opacity: (order.items || []).length === 0 ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {loading ? 'Выдаю...' : 'Выдать по заказу'}
        </button>
      )}
    </div>
  )
}

/* Manual multi-product issue / return */
function BatchModal({ mode, courier, catalog, stockMap, courierWater, onClose, onSave }) {
  const [items, setItems] = useState({})
  const [loading, setLoading] = useState(false)
  const isReturn = mode === 'return'

  const available = isReturn
    ? Object.entries(courierWater || {}).filter(([, v]) => v > 0).map(([p]) => p)
    : catalog.map(c => c.short_name)

  const toggle = (p) => setItems(prev => {
    if (prev[p] !== undefined) { const n = { ...prev }; delete n[p]; return n }
    return { ...prev, [p]: 1 }
  })
  const setQty = (p, q) => {
    const max = isReturn ? (courierWater?.[p] || 99) : (stockMap?.[p] || 999)
    setItems(prev => ({ ...prev, [p]: Math.max(1, Math.min(q, max)) }))
  }

  const totalQty = Object.values(items).reduce((s, v) => s + v, 0)

  const handle = async () => {
    if (totalQty <= 0) return
    setLoading(true)
    try { await onSave(items); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>
          {isReturn ? 'Возврат на склад' : 'Доп. выдача воды'}
        </div>
        <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>Курьер: <b style={{ color: TEXT }}>{courier.name}</b></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {isReturn ? 'Принять от курьера' : 'Выбрать продукты'}
          </div>

          {available.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: TEXT2, fontSize: 14 }}>
              {isReturn ? 'У курьера нет воды для возврата' : 'Каталог пуст'}
            </div>
          ) : available.map(p => {
            const sel = items[p] !== undefined
            const max = isReturn ? (courierWater?.[p] || 0) : (stockMap?.[p] || 0)
            return (
              <div key={p} style={{
                borderRadius: 12, border: sel ? `1.5px solid ${C}` : `1.5px solid #e5e5ea`,
                background: sel ? `${C}06` : '#fff', padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => toggle(p)}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: sel ? GRAD : '#fff',
                    border: sel ? 'none' : '2px solid #ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{p}</span>
                  <span style={{ fontSize: 11, color: !isReturn && max <= 5 ? '#E03131' : TEXT2, fontWeight: 600 }}>
                    {isReturn ? `у курьера: ${max}` : `на складе: ${max}`}
                  </span>
                </div>
                {sel && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 30 }}>
                    <button style={st.qtyBtn} onClick={() => setQty(p, items[p] - 1)}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{items[p]}</span>
                    <button style={st.qtyBtn} onClick={() => setQty(p, items[p] + 1)}>+</button>
                    <span style={{ fontSize: 12, color: TEXT2, marginLeft: 'auto' }}>макс: {max}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {totalQty > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isReturn ? '#F0F4FF' : '#F0FFF0', borderRadius: 12, padding: '12px 14px' }}>
            <span style={{ fontSize: 13, color: TEXT2 }}>Итого</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: isReturn ? '#1971C2' : C }}>{totalQty} шт.</span>
          </div>
        )}

        <button
          disabled={totalQty <= 0 || loading}
          onClick={handle}
          style={{
            padding: 16, borderRadius: 14, border: 'none',
            background: isReturn ? '#111827' : GRAD,
            color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: totalQty <= 0 || loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
            opacity: totalQty <= 0 ? 0.45 : 1,
          }}>
          {loading ? 'Обработка...' : isReturn ? `Принять ${totalQty} шт.` : `Выдать ${totalQty} шт.`}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C}`, background: '#fff', fontSize: 14, fontWeight: 700, color: C, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
