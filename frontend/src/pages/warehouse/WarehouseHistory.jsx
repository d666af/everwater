import { useEffect, useMemo, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { getWarehouseHistory, getAdminCouriers, getWarehouseStock } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PERIODS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'week', label: 'Неделя' },
  { key: 'all', label: 'Всё' },
  { key: 'custom', label: 'Дата' },
]

const TYPES = [
  { key: 'all', label: 'Все', color: TEXT2 },
  { key: 'production', label: 'Производство', color: '#2B8A3E' },
  { key: 'issue', label: 'Выдача', color: '#E67700' },
  { key: 'return', label: 'Возврат', color: '#1971C2' },
]

export default function WarehouseHistory() {
  const [period, setPeriod] = useState('today')
  const [type, setType] = useState('all')
  const [product, setProduct] = useState('all')
  const [courierId, setCourierId] = useState(null)
  const [customDate, setCustomDate] = useState('')
  const [products, setProducts] = useState([])
  const [couriers, setCouriers] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Load dropdowns once
  useEffect(() => {
    Promise.all([getWarehouseStock(), getAdminCouriers()])
      .then(([wh, cs]) => {
        setProducts(wh.stock || [])
        setCouriers(cs.filter(c => c.is_active))
      })
      .catch(console.error)
  }, [])

  // Load history when filters change
  useEffect(() => {
    setLoading(true)
    const filters = { period, type, product, courier_id: courierId }
    if (period === 'custom' && customDate) filters.from = customDate
    getWarehouseHistory(filters)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period, type, product, courierId, customDate])

  // Aggregate
  const summary = useMemo(() => {
    const s = { production: 0, issue: 0, return: 0 }
    history.forEach(h => {
      if (h.type === 'production') s.production += h.quantity
      if (h.type === 'issued' || h.type === 'issue') s.issue += h.quantity
      if (h.type === 'returned' || h.type === 'return') s.return += h.quantity
    })
    return s
  }, [history])

  return (
    <WarehouseLayout title="История">
      {/* Period filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: period === p.key ? `linear-gradient(135deg, ${C}, ${CD})` : '#fff',
            color: period === p.key ? '#fff' : TEXT2,
            border: period === p.key ? 'none' : `1.5px solid ${BORDER}`,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>{p.label}</button>
        ))}
      </div>

      {period === 'custom' && (
        <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} style={{
          width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
          fontSize: 14, marginBottom: 10, outline: 'none', background: '#fff', color: TEXT, boxSizing: 'border-box',
        }} />
      )}

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TYPES.map(t => (
          <button key={t.key} onClick={() => setType(t.key)} style={{
            padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: type === t.key ? t.color : '#fff',
            color: type === t.key ? '#fff' : TEXT2,
            border: type === t.key ? 'none' : `1.5px solid ${BORDER}`,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Product + Courier filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={product} onChange={e => setProduct(e.target.value)} style={st.select}>
          <option value="all">Все продукты</option>
          {products.map(p => <option key={p.product_name} value={p.product_name}>{p.product_name}</option>)}
        </select>
        <select value={courierId || ''} onChange={e => setCourierId(e.target.value ? Number(e.target.value) : null)} style={st.select}>
          <option value="">Все курьеры</option>
          {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <SumCard bg="#EBFBEE" color="#2B8A3E" label="Произведено" value={summary.production} />
        <SumCard bg="#FFF8E6" color="#E67700" label="Выдано" value={summary.issue} />
        <SumCard bg="#E8F4FD" color="#1971C2" label="Возвращено" value={summary.return} />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: TEXT2 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
            <path d="M12 8v4l3 3" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="9" stroke={TEXT} strokeWidth="1.5"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>Нет операций по фильтрам</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, padding: '4px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {history.map((h, i) => {
            const isProd = h.type === 'production'
            const isIssue = h.type === 'issued' || h.type === 'issue'
            const isRet = h.type === 'returned' || h.type === 'return'
            const color = isProd ? '#2B8A3E' : isIssue ? '#E67700' : '#1971C2'
            const bg = isProd ? '#EBFBEE' : isIssue ? '#FFF8E6' : '#E8F4FD'
            const sign = isProd ? '+' : isIssue ? '−' : '+'
            const label = isProd ? 'Производство' : isIssue ? `Выдано · ${h.courier_name || '—'}` : `Возврат · ${h.courier_name || '—'}`
            return (
              <div key={h.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: i < history.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isProd && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>}
                  {isIssue && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {isRet && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{h.product_name}</div>
                  <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>
                    {label}{h.note ? ` · ${h.note}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color }}>{sign}{h.quantity}</div>
                  <div style={{ fontSize: 10, color: TEXT2 }}>
                    {new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {new Date(h.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </WarehouseLayout>
  )
}

function SumCard({ bg, color, label, value }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color, marginTop: 3, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

const st = {
  select: {
    flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT, fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    backgroundImage: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="%238E8E93" stroke-width="2" stroke-linecap="round"/></svg>\')',
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28,
  },
}
