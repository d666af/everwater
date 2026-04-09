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
  const [loading, setLoading] = useState(true)
  const [showIssue, setShowIssue] = useState(null) // courier obj or null
  const [showReturn, setShowReturn] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getAdminCouriers(), getWarehouseStock()])
      .then(([c, wh]) => {
        setCouriers(c.filter(x => x.is_active))
        setCourierWater(wh.courier_water || {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleIssue = async (courierId, courierName, product, qty) => {
    await issueWaterToCourier(courierId, courierName, product, qty)
    load()
  }

  const handleReturn = async (courierId, courierName, product, qty) => {
    await returnWaterFromCourier(courierId, courierName, product, qty)
    load()
  }

  return (
    <WarehouseLayout title="Выдача">
      {showIssue && <ActionModal title="Выдать воду" courier={showIssue} onClose={() => setShowIssue(null)} onSave={handleIssue} />}
      {showReturn && <ActionModal title="Возврат воды" courier={showReturn} onClose={() => setShowReturn(null)} onSave={handleReturn} isReturn />}

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
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(c.name || 'К')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{c.name}</div>
                    {totalWater > 0 && <div style={{ fontSize: 12, color: CD, fontWeight: 600, marginTop: 2 }}>На руках: {totalWater} шт.</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={() => setShowIssue(c)}>Выдать</button>
                    {totalWater > 0 && <button style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={() => setShowReturn(c)}>Возврат</button>}
                  </div>
                </div>

                {/* Water on hand details */}
                {totalWater > 0 && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(water).filter(([, v]) => v > 0).map(([product, qty]) => (
                      <span key={product} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: `${C}15`, color: CD, fontWeight: 600 }}>
                        {product}: {qty}
                      </span>
                    ))}
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

function ActionModal({ title, courier, onClose, onSave, isReturn }) {
  const [product, setProduct] = useState(PRODUCTS[0])
  const [qty, setQty] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    if (!qty || Number(qty) <= 0) return
    setLoading(true)
    try { await onSave(courier.id, courier.name, product, Number(qty)); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>{title}</div>
        <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>Курьер: <b style={{ color: TEXT }}>{courier.name}</b></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Продукт</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRODUCTS.map(p => (
              <button key={p} onClick={() => setProduct(p)} style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: product === p ? `linear-gradient(135deg, ${C}, ${CD})` : '#F8F9FA',
                color: product === p ? '#fff' : TEXT,
                border: product === p ? 'none' : `1px solid ${BORDER}`,
              }}>{p}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Количество</div>
          <input style={st.input} type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
        </div>

        <button style={{ ...st.primaryBtn, ...(isReturn ? { background: '#111827' } : {}), ...(!qty || Number(qty) <= 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={!qty || Number(qty) <= 0 || loading} onClick={handle}>
          {loading ? 'Обработка...' : isReturn ? `Принять ${qty || 0} шт.` : `Выдать ${qty || 0} шт.`}
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
  input: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
}
