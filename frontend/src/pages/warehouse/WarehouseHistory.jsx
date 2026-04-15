import { useEffect, useMemo, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'
import { getWarehouseHistory, getAdminCouriers, getCatalogProducts } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

// Period filter groups — same pattern as WarehouseStock
const QUICK = [
  { key: 'yesterday', label: 'Вчера' },
  { key: 'today', label: 'Сегодня' },
  { key: 'all', label: 'Всё' },
]
const RANGES = [
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

const TYPES = [
  { key: 'all', label: 'Все', color: TEXT2 },
  { key: 'production', label: 'Производство', color: '#2B8A3E' },
  { key: 'issue', label: 'Выдача', color: '#E67700' },
  { key: 'return', label: 'Возврат', color: '#1971C2' },
]

export default function WarehouseHistory() {
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const [type, setType] = useState('all')
  const [product, setProduct] = useState('all')
  const [courierId, setCourierId] = useState(null)

  const [couriers, setCouriers] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const catalog = useMemo(() => getCatalogProducts(), [])

  // Load couriers dropdown once
  useEffect(() => {
    getAdminCouriers()
      .then(cs => setCouriers(cs.filter(c => c.is_active)))
      .catch(console.error)
  }, [])

  // Load history when filters change
  useEffect(() => {
    setLoading(true)
    const filters = { period, type, product, courier_id: courierId, customDate, timeFrom, timeTo }
    getWarehouseHistory(filters)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period, customDate, timeFrom, timeTo, type, product, courierId])

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

  const periodLabel = period === 'custom'
    ? (customDate ? `${customDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}${timeFrom || timeTo ? ` · ${timeFrom || '00:00'}–${timeTo || '23:59'}` : ''}` : 'Дата')
    : [...QUICK, ...RANGES].find(p => p.key === period)?.label || ''

  const applyCustom = (date, from, to) => {
    setCustomDate(date); setTimeFrom(from); setTimeTo(to); setPeriod('custom')
  }

  const activeFilterCount = (type !== 'all' ? 1 : 0) + (product !== 'all' ? 1 : 0) + (courierId ? 1 : 0)

  return (
    <WarehouseLayout title="История">
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate}
          initialFrom={timeFrom}
          initialTo={timeTo}
          onApply={applyCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Period filter — matching WarehouseStock layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <SegGroup options={QUICK} value={period} onChange={setPeriod} />
        <div style={{ display: 'flex', gap: 6 }}>
          <SegGroup options={RANGES} value={period} onChange={setPeriod} flex />
          <button
            onClick={() => setPickerOpen(true)}
            style={{
              flex: 1.2, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
              background: period === 'custom' ? GRAD : '#fff',
              color: period === 'custom' ? '#fff' : TEXT2,
              border: period === 'custom' ? 'none' : `1.5px solid ${BORDER}`,
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {period === 'custom' ? periodLabel : 'Дата'}
          </button>
        </div>
      </div>

      {/* Type chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TYPES.map(t => (
          <button key={t.key} onClick={() => setType(t.key)} style={{
            padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: type === t.key ? t.color : '#fff',
            color: type === t.key ? '#fff' : TEXT2,
            border: type === t.key ? 'none' : `1.5px solid ${BORDER}`,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Product + Courier filter as chips row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <FilterSelect label="Продукт" value={product} onChange={setProduct}
          options={[{ value: 'all', label: 'Все продукты' }, ...catalog.map(c => ({ value: c.short_name, label: c.short_name }))]} />
        <FilterSelect label="Курьер" value={courierId || 'all'}
          onChange={v => setCourierId(v === 'all' ? null : Number(v))}
          options={[{ value: 'all', label: 'Все курьеры' }, ...couriers.map(c => ({ value: String(c.id), label: c.name }))]} />
      </div>

      {/* Summary totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <SumCard bg="#EBFBEE" color="#2B8A3E" label="Произведено" value={summary.production} />
        <SumCard bg="#FFF3D9" color="#E67700" label="Выдано" value={summary.issue} />
        <SumCard bg="#E8F4FD" color="#1971C2" label="Возвращено" value={summary.return} />
      </div>

      {/* Section title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Операций · {history.length}{activeFilterCount > 0 ? ` · фильтров: ${activeFilterCount}` : ''}
        </span>
        <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
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
            const bg = isProd ? '#EBFBEE' : isIssue ? '#FFF3D9' : '#E8F4FD'
            const sign = isProd ? '+' : isIssue ? '−' : '+'
            const subline = isProd
              ? (h.note || 'Производство')
              : isIssue ? `Выдано · ${h.courier_name || '—'}` : `Возврат · ${h.courier_name || '—'}`
            return (
              <div key={h.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: i < history.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isProd && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>}
                  {isIssue && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {isRet && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.product_short || h.product_name}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subline}
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

function SegGroup({ options, value, onChange, flex }) {
  return (
    <div style={{ display: 'flex', gap: 6, flex: flex ? 1 : undefined }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
          background: value === o.key ? GRAD : '#fff',
          color: value === o.key ? '#fff' : TEXT2,
          border: value === o.key ? 'none' : `1.5px solid ${BORDER}`,
          fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
      background: '#fff', color: TEXT, fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer',
      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
      backgroundImage: 'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="%238E8E93" stroke-width="2" stroke-linecap="round"/></svg>\')',
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28,
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
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
