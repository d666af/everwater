import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { getWarehouseOverview, addProduction, getProductionPlan } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PRODUCTS = ['Вода 20л', 'Вода 10л', 'Вода 5л', 'Вода 1.5л', 'Вода 1л', 'Вода 0.5л', 'Газ. вода 1.5л', 'Газ. вода 1л', 'Газ. вода 0.5л']

export default function WarehouseStock() {
  const [overview, setOverview] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getWarehouseOverview(), getProductionPlan()])
      .then(([ov, pl]) => { setOverview(ov); setPlan(pl) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading || !overview) {
    return (
      <WarehouseLayout title="Склад">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      </WarehouseLayout>
    )
  }

  const { products, totals } = overview
  const hasShortfall = totals.shortfall > 0
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.stock > 0)

  return (
    <WarehouseLayout title="Склад">
      {showAdd && <AddProductionModal onClose={() => setShowAdd(false)} onSave={async (name, qty, note) => { await addProduction(name, qty, note); load() }} />}

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Kpi label="На складе" value={totals.stock} color={C} />
        <Kpi label="У курьеров" value={totals.on_couriers} color="#1971C2" />
        <Kpi label="В заказах" value={totals.reserved} color="#E67700" />
        <Kpi label="Нужно сегодня" value={totals.needed_today} color="#7048E8" />
      </div>

      {/* Shortfall alert */}
      {hasShortfall && (
        <div style={{ background: 'linear-gradient(135deg, #FFE8E8, #FFF5F5)', border: '1.5px solid #FFB4B4', borderRadius: 16, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 2L2 20h20L12 2z" fill="#E03131" />
            <path d="M12 9v5M12 17v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#C92A2A' }}>Недостаток: {totals.shortfall} шт.</div>
            <div style={{ fontSize: 11, color: '#862020', marginTop: 2 }}>Заказано больше, чем есть. Проверьте производство.</div>
          </div>
        </div>
      )}

      {/* Today's summary */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Сегодня</div>
          <div style={{ fontSize: 11, color: TEXT2 }}>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Mini bg="#EBFBEE" color="#2B8A3E" label="Произведено" value={`+${totals.produced_today}`} />
          <Mini bg="#FFF8E6" color="#E67700" label="Выдано курьерам" value={`−${totals.issued_today}`} />
          <Mini bg="#E8F4FD" color="#1971C2" label="Возвраты" value={`+${totals.returned_today}`} />
          <Mini bg="#F3F0FF" color="#7048E8" label="Доставлено" value={totals.delivered_today_orders} sub={`${totals.delivered_today} шт.`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 10px', background: '#F8F9FA', borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: TEXT2 }}>Бутылей возвращено</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#1971C2' }}>{totals.bottles_returned_today} шт.</span>
        </div>
      </div>

      {/* Add production button */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '13px 14px', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 15, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)', WebkitTapHighlightColor: 'transparent',
        marginBottom: 16,
      }} onClick={() => setShowAdd(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        Записать производство
      </button>

      {/* Current stock — 2-column grid */}
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Остатки по продуктам</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {products.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 30, color: TEXT2, fontSize: 14 }}>Нет товаров на складе</div>
        ) : products.map(p => <ProductCard key={p.product_name} p={p} />)}
      </div>

      {/* Production recommendations */}
      {plan?.recommendations?.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Рекомендуется произвести</div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            {plan.recommendations.map((r, i) => (
              <div key={r.product_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < plan.recommendations.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: r.priority === 'high' ? '#FFE8E8' : '#FFF8E6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M2 12h20" stroke={r.priority === 'high' ? '#E03131' : '#E67700'} strokeWidth="2.2" strokeLinecap="round"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{r.product_name}</div>
                  <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>
                    Есть {r.current} · нужно {r.needed}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: r.priority === 'high' ? '#E03131' : '#E67700' }}>+{r.produce}</div>
                  <div style={{ fontSize: 10, color: TEXT2 }}>шт.</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Low stock warning */}
      {lowStockProducts.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Мало на складе</div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            {lowStockProducts.map((p, i) => (
              <div key={p.product_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < lowStockProducts.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E03131', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{p.product_name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#E03131' }}>{p.stock}</span>
                <span style={{ fontSize: 11, color: TEXT2 }}>шт.</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Subscription demand */}
      {plan?.subscriptions?.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Подписки клиентов</div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: TEXT2 }}>Активных подписок</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C }}>{plan.subscriptions.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(plan.subscription_demand || {}).map(([product, qty]) => (
                <div key={product} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#F8F9FA', borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{product}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CD }}>{qty} шт.</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 8 }}>Плановая отгрузка по подпискам</div>
          </div>
        </>
      )}
    </WarehouseLayout>
  )
}

function Kpi({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: TEXT2, marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function Mini({ bg, color, label, value, sub }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '10px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color, marginTop: 3, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color, opacity: 0.7, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function ProductCard({ p }) {
  const isShort = p.shortfall > 0
  const isLow = p.stock <= 10
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: isShort ? '1.5px solid #FFB4B4' : '1.5px solid transparent' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6, minHeight: 30, lineHeight: 1.2 }}>{p.product_name}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: isLow ? '#E03131' : (isShort ? '#E03131' : C), lineHeight: 1 }}>{p.stock}</div>
      <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>на складе</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
        <Row label="У курьеров" value={p.on_couriers} color="#1971C2" />
        <Row label="В заказах" value={p.reserved} color="#E67700" />
        {p.needed_today > 0 && <Row label="Нужно сегодня" value={p.needed_today} color="#7048E8" />}
        {p.delivered_today > 0 && <Row label="Доставлено" value={p.delivered_today} color="#2B8A3E" />}
      </div>

      {isShort && (
        <div style={{ marginTop: 8, padding: '5px 8px', background: '#FFE8E8', borderRadius: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: '#C92A2A', fontWeight: 700 }}>Нехватка: {p.shortfall}</span>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, color: TEXT2 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function AddProductionModal({ onClose, onSave }) {
  const [name, setName] = useState('Вода 20л')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    if (!qty || Number(qty) <= 0) return
    setLoading(true)
    try { await onSave(name, Number(qty), note.trim()); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Записать производство</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Продукт</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRODUCTS.map(p => (
              <button key={p} onClick={() => setName(p)} style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: name === p ? `linear-gradient(135deg, ${C}, ${CD})` : '#F8F9FA',
                color: name === p ? '#fff' : TEXT,
                border: name === p ? 'none' : `1px solid ${BORDER}`,
              }}>{p}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Количество</div>
          <input style={st.input} type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Заметка</div>
          <input style={st.input} placeholder="Необязательно" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <button style={{ ...st.primaryBtn, ...(!qty || Number(qty) <= 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={!qty || Number(qty) <= 0 || loading} onClick={handle}>
          {loading ? 'Записываю...' : `Добавить ${qty || 0} шт.`}
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
