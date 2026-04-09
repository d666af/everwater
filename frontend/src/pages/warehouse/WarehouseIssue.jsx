import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { getAdminCouriers, issueWaterToCourier, returnWaterFromCourier, getWarehouseStock } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PRODUCTS = ['Вода 20л', 'Вода 10л', 'Вода 5л', 'Вода 1.5л', 'Вода 1л', 'Вода 0.5л', 'Газ. вода 1.5л', 'Газ. вода 1л', 'Газ. вода 0.5л']

export default function WarehouseIssue() {
  const [couriers, setCouriers] = useState([])
  const [courierWater, setCourierWater] = useState({})
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [showIssue, setShowIssue] = useState(null)
  const [showReturn, setShowReturn] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getAdminCouriers(), getWarehouseStock()])
      .then(([c, wh]) => {
        setCouriers(c.filter(x => x.is_active))
        setCourierWater(wh.courier_water || {})
        setStock(wh.stock || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleIssue = async (courierId, courierName, items) => {
    for (const [product, qty] of Object.entries(items)) {
      await issueWaterToCourier(courierId, courierName, product, qty)
    }
    load()
  }

  const handleReturn = async (courierId, courierName, items) => {
    for (const [product, qty] of Object.entries(items)) {
      await returnWaterFromCourier(courierId, courierName, product, qty)
    }
    load()
  }

  const stockMap = {}
  stock.forEach(s => { stockMap[s.product_name] = s.quantity })

  return (
    <WarehouseLayout title="Выдача">
      {showIssue && <BatchModal title="Выдать воду" courier={showIssue} onClose={() => setShowIssue(null)} onSave={handleIssue} stockMap={stockMap} />}
      {showReturn && <BatchModal title="Возврат воды" courier={showReturn} onClose={() => setShowReturn(null)} onSave={handleReturn} isReturn courierWater={courierWater[showReturn.id] || {}} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: TEXT2 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Нет активных курьеров</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 4px' }}>Курьеры · {couriers.length}</div>
          {couriers.map(c => {
            const water = courierWater[c.id] || {}
            const totalWater = Object.values(water).reduce((s, v) => s + v, 0)
            const isExpanded = expanded === c.id
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(e => e === c.id ? null : c.id)}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(c.name || 'К')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: totalWater > 0 ? CD : TEXT2, fontWeight: 600, marginTop: 2 }}>
                      {totalWater > 0 ? `На руках: ${totalWater} шт.` : 'Нет воды на руках'}
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                    <path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Current inventory */}
                    {totalWater > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Сейчас на руках</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {Object.entries(water).filter(([, v]) => v > 0).map(([product, qty]) => (
                            <span key={product} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: `${C}15`, color: CD, fontWeight: 600 }}>
                              {product}: {qty}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setShowIssue(c)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Выдать
                      </button>
                      {totalWater > 0 && (
                        <button style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setShowReturn(c)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Возврат
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </WarehouseLayout>
  )
}

/* Multi-product batch modal */
function BatchModal({ title, courier, onClose, onSave, isReturn, stockMap, courierWater }) {
  const [items, setItems] = useState({}) // { productName: qty }
  const [loading, setLoading] = useState(false)

  // For return mode, only show products courier has
  const availableProducts = isReturn
    ? Object.entries(courierWater || {}).filter(([, v]) => v > 0).map(([p]) => p)
    : PRODUCTS

  const toggleProduct = (p) => {
    setItems(prev => {
      if (prev[p] !== undefined) { const n = { ...prev }; delete n[p]; return n }
      return { ...prev, [p]: 1 }
    })
  }
  const setQty = (p, q) => {
    const max = isReturn ? (courierWater?.[p] || 99) : (stockMap?.[p] || 999)
    setItems(prev => ({ ...prev, [p]: Math.max(1, Math.min(q, max)) }))
  }

  const totalQty = Object.values(items).reduce((s, v) => s + v, 0)

  const handle = async () => {
    if (totalQty <= 0) return
    setLoading(true)
    try { await onSave(courier.id, courier.name, items); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>{title}</div>
        <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>Курьер: <b style={{ color: TEXT }}>{courier.name}</b></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {isReturn ? 'Принять от курьера' : 'Выбрать продукты'}
          </div>

          {availableProducts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: TEXT2, fontSize: 14 }}>У курьера нет воды для возврата</div>
          ) : availableProducts.map(p => {
            const sel = items[p] !== undefined
            const available = isReturn ? (courierWater?.[p] || 0) : (stockMap?.[p] || 0)
            return (
              <div key={p} style={{
                borderRadius: 12, border: sel ? `1.5px solid ${C}` : `1.5px solid #e5e5ea`,
                background: sel ? `${C}06` : '#fff', padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => toggleProduct(p)}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: sel ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
                    border: sel ? 'none' : '2px solid #ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{p}</span>
                  <span style={{ fontSize: 11, color: available <= 5 && !isReturn ? '#E03131' : TEXT2, fontWeight: 600 }}>
                    {isReturn ? `у курьера: ${available}` : `на складе: ${available}`}
                  </span>
                </div>
                {sel && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 30 }}>
                    <button style={st.qtyBtn} onClick={() => setQty(p, items[p] - 1)}>-</button>
                    <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{items[p]}</span>
                    <button style={st.qtyBtn} onClick={() => setQty(p, items[p] + 1)}>+</button>
                    <span style={{ fontSize: 12, color: TEXT2, marginLeft: 'auto' }}>
                      макс: {isReturn ? (courierWater?.[p] || 0) : (stockMap?.[p] || 0)}
                    </span>
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

        <button style={{ ...st.primaryBtn, ...(isReturn ? { background: '#111827' } : {}), ...(totalQty <= 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={totalQty <= 0 || loading} onClick={handle}>
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
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C}`, background: '#fff', fontSize: 14, fontWeight: 700, color: C, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
