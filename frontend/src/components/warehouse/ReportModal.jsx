import { useEffect, useState } from 'react'
import DateTimePickerModal from './DateTimePickerModal'
import { getWarehouseHistory, getWarehouseCourierStats, getCancelledBatches, getWarehouseDebtAdjustments, getFactoryStats } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PERIODS = [
  { key: 'today', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

/**
 * Report modal showing production, issues, bottle returns and debt.
 * Props:
 *  - onClose()
 *  - courierId: number | null   — if set, filters for one courier only
 *  - courierName: string | null
 */
export default function ReportModal({ onClose, courierId = null, courierName = null, factoryId = null }) {
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [couriers, setCouriers] = useState([])
  const [cancelledBatches, setCancelledBatches] = useState([])
  const [debtAdj, setDebtAdj] = useState([])
  const [factoryStatsList, setFactoryStatsList] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    const cd = period === 'custom' ? customDate : null
    const cdTo = period === 'custom' ? customDateTo : null
    const filters = { period, customDate: cd, customDateTo: cdTo }
    if (courierId) filters.courier_id = courierId
    if (factoryId) filters.factory_id = factoryId
    const isSpecific = !!(courierId || factoryId)
    const calls = [
      getWarehouseHistory(filters),
      getWarehouseCourierStats('today', null, null),
    ]
    if (!isSpecific) {
      calls.push(getCancelledBatches())
      calls.push(getWarehouseDebtAdjustments({ limit: 200 }))
      calls.push(getFactoryStats('all'))
    } else if (factoryId) {
      calls.push(Promise.resolve(null))
      calls.push(Promise.resolve(null))
      calls.push(getFactoryStats('all'))
    }
    Promise.all(calls)
      .then(([hist, cs, cb, da, fs]) => {
        setHistory(hist)
        setCouriers(cs)
        if (!isSpecific) {
          setCancelledBatches(Array.isArray(cb) ? cb : [])
          setDebtAdj(Array.isArray(da) ? da : [])
          setFactoryStatsList(Array.isArray(fs) ? fs : [])
        } else if (factoryId) {
          setFactoryStatsList(Array.isArray(fs) ? fs : [])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [period, customDate, customDateTo]) // eslint-disable-line

  const applyCustom = (start, end) => {
    setCustomDate(start); setCustomDateTo(end); setPeriod('custom')
  }

  const fmtDate = s => {
    if (!s) return ''
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }
  const periodLabel = period === 'custom'
    ? (customDate ? (customDateTo && customDateTo !== customDate ? `${fmtDate(customDate)} – ${fmtDate(customDateTo)}` : fmtDate(customDate)) : 'Дата')
    : PERIODS.find(p => p.key === period)?.label || ''

  // Helper: check if ISO timestamp falls in selected period (Tashkent UTC+5)
  const inPeriod = (isoStr) => {
    if (!isoStr) return false
    const tzNow = new Date(Date.now() + 5 * 60 * 60 * 1000)
    const todayStr = tzNow.toISOString().slice(0, 10)
    const itemDate = new Date(isoStr + (isoStr.endsWith('Z') || isoStr.includes('+') ? '' : 'Z'))
    const itemDateTZ = new Date(itemDate.getTime() + 5 * 60 * 60 * 1000)
    const itemStr = itemDateTZ.toISOString().slice(0, 10)
    if (period === 'custom') {
      if (!customDate) return true
      const to = customDateTo || customDate
      return itemStr >= customDate && itemStr <= to
    }
    if (period === 'today') return itemStr === todayStr
    if (period === 'week') {
      const weekAgoStr = new Date(tzNow.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      return itemStr >= weekAgoStr
    }
    if (period === 'month') {
      const monthAgoStr = new Date(tzNow.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      return itemStr >= monthAgoStr
    }
    return true
  }

  // Derive sections from history
  const production = history.filter(h => h.type === 'production')
  const issues = history.filter(h => h.type === 'issue' || h.type === 'issued')
  const returns = history.filter(h => h.type === 'bottle_return')
  const factoryIssues = history.filter(h => h.type === 'factory_issue')
  const factoryReturns = history.filter(h => h.type === 'factory_return')

  // Aggregate production by product
  const prodByProduct = {}
  production.forEach(h => {
    const name = h.product_name || h.product_short || '—'
    prodByProduct[name] = (prodByProduct[name] || 0) + h.quantity
  })

  // Issues grouped: courierName → { productName → qty }
  const issuesByCourier = {}
  issues.forEach(h => {
    const cn = h.courier_name || '—'
    if (!issuesByCourier[cn]) issuesByCourier[cn] = {}
    const pn = h.product_name || h.product_short || '—'
    issuesByCourier[cn][pn] = (issuesByCourier[cn][pn] || 0) + h.quantity
  })

  // Returns: courierName → qty
  const returnsByCourier = {}
  returns.forEach(h => {
    const cn = h.courier_name || '—'
    returnsByCourier[cn] = (returnsByCourier[cn] || 0) + h.quantity
  })
  const totalReturns = Object.values(returnsByCourier).reduce((s, v) => s + v, 0)

  // Factory issues grouped: factoryName → { productName → qty }
  const factoryIssuesByFactory = {}
  factoryIssues.forEach(h => {
    const fn = h.factory_name || '—'
    if (!factoryIssuesByFactory[fn]) factoryIssuesByFactory[fn] = {}
    const pn = h.product_name || h.product_short || '—'
    factoryIssuesByFactory[fn][pn] = (factoryIssuesByFactory[fn][pn] || 0) + h.quantity
  })

  // Factory returns: factoryName → qty
  const factoryReturnsByFactory = {}
  factoryReturns.forEach(h => {
    const fn = h.factory_name || '—'
    factoryReturnsByFactory[fn] = (factoryReturnsByFactory[fn] || 0) + h.quantity
  })
  const totalFactoryReturns = Object.values(factoryReturnsByFactory).reduce((s, v) => s + v, 0)

  // Cancelled batches filtered by period
  const filteredCancelled = cancelledBatches.filter(b => inPeriod(b.cancelled_at))

  // Debt adjustments filtered by period
  const filteredDebtAdj = debtAdj.filter(a => inPeriod(a.created_at))

  // Debt from couriers data (current state, not period-filtered)
  const debtCouriers = courierId
    ? couriers.filter(c => c.id === courierId)
    : factoryId
    ? []
    : couriers.filter(c => (c.bottles_must_return || 0) > 0)
  const debtFactories = factoryId
    ? factoryStatsList.filter(f => f.id === factoryId)
    : courierId
    ? []
    : factoryStatsList.filter(f => (f.bottles_must_return || 0) > 0)
  const totalDebt = debtCouriers.reduce((s, c) => s + (c.bottles_must_return || 0), 0)
    + debtFactories.reduce((s, f) => s + (f.bottles_must_return || 0), 0)
  const hasDebt = totalDebt > 0 || debtCouriers.length > 0 || debtFactories.length > 0

  const isEmpty = production.length === 0 && issues.length === 0 && returns.length === 0
    && factoryIssues.length === 0 && factoryReturns.length === 0
    && filteredCancelled.length === 0 && filteredDebtAdj.length === 0

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        {pickerOpen && (
          <DateTimePickerModal
            initialDate={customDate}
            initialDateTo={customDateTo}
            onApply={applyCustom}
            onClose={() => setPickerOpen(false)}
          />
        )}
        <div style={s.handle} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>
              {(courierId || factoryId) ? `Отчёт · ${courierName}` : 'Отчёт по складу'}
            </div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{periodLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: TEXT2, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Period filter */}
        <div style={{ display: 'flex', gap: 5 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setCustomDate(null); setCustomDateTo(null) }} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: period === p.key ? GRAD : '#F8F9FA',
              color: period === p.key ? '#fff' : TEXT2,
              border: period === p.key ? 'none' : `1px solid ${BORDER}`,
            }}>{p.label}</button>
          ))}
          <button onClick={() => setPickerOpen(true)} style={{
            flex: 1.2, padding: '8px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: period === 'custom' ? GRAD : '#F8F9FA',
            color: period === 'custom' ? '#fff' : TEXT2,
            border: period === 'custom' ? 'none' : `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {period === 'custom' ? (customDate ? fmtDate(customDate) : 'Дата') : 'Дата'}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : isEmpty && !hasDebt ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: TEXT2, fontSize: 13 }}>Нет данных за период</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Production — main page only */}
            {!courierId && !factoryId && Object.keys(prodByProduct).length > 0 && (
              <Section title="Производство" color="#2B8A3E" bg="#EBFBEE">
                {Object.entries(prodByProduct).map(([name, qty]) => (
                  <Row key={name} label={name} value={`+${qty} шт.`} valueColor="#2B8A3E" />
                ))}
              </Section>
            )}

            {/* Issues by courier — not shown for factory-specific report */}
            {!factoryId && Object.keys(issuesByCourier).length > 0 && (
              <Section title="Выдача курьерам" color="#E67700" bg="#FFF3D9">
                {Object.entries(issuesByCourier).map(([cn, prods], ci) => (
                  <div key={cn}>
                    {ci > 0 && <div style={{ height: 1, background: BORDER, margin: '6px 0' }} />}
                    <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{cn}</div>
                    {Object.entries(prods).map(([pn, qty]) => (
                      <Row key={pn} label={pn} value={`${qty} шт.`} indent />
                    ))}
                  </div>
                ))}
              </Section>
            )}

            {/* Factory issues */}
            {!courierId && Object.keys(factoryIssuesByFactory).length > 0 && (
              <Section title="Выдача заводам / другим" color="#9C36B5" bg="#F8EBFC">
                {Object.entries(factoryIssuesByFactory).map(([fn, prods], fi) => (
                  <div key={fn}>
                    {fi > 0 && <div style={{ height: 1, background: BORDER, margin: '6px 0' }} />}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#9C36B5', marginBottom: 4 }}>{fn}</div>
                    {Object.entries(prods).map(([pn, qty]) => (
                      <Row key={pn} label={pn} value={`${qty} шт.`} indent />
                    ))}
                  </div>
                ))}
              </Section>
            )}

            {/* Bottle returns received (couriers) — not shown for factory-specific report */}
            {!factoryId && Object.keys(returnsByCourier).length > 0 && (
              <Section title="Возврат бутылок 19л" color="#1971C2" bg="#E8F4FD">
                {Object.entries(returnsByCourier).map(([cn, qty]) => (
                  <Row key={cn} label={cn} value={`${qty} бут.`} valueColor="#1971C2" />
                ))}
                {Object.keys(returnsByCourier).length > 1 && (
                  <Row label="Итого" value={`${totalReturns} бут.`} valueColor="#1971C2" bold />
                )}
              </Section>
            )}

            {/* Factory returns */}
            {(factoryId || !courierId) && Object.keys(factoryReturnsByFactory).length > 0 && (
              <Section title="Возврат от заводов / других" color="#1971C2" bg="#E8F4FD">
                {Object.entries(factoryReturnsByFactory).map(([fn, qty]) => (
                  <Row key={fn} label={fn} value={`${qty} бут.`} valueColor="#1971C2" />
                ))}
                {Object.keys(factoryReturnsByFactory).length > 1 && (
                  <Row label="Итого" value={`${totalFactoryReturns} бут.`} valueColor="#1971C2" bold />
                )}
              </Section>
            )}

            {/* Cancelled issue batches */}
            {!courierId && !factoryId && filteredCancelled.length > 0 && (
              <Section title="Отменённые выдачи" color="#C92A2A" bg="#FFE8E8">
                {filteredCancelled.map((b, i) => {
                  const recipient = b.courier_name || b.factory_name || '—'
                  const dt = b.cancelled_at
                    ? new Date(b.cancelled_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—'
                  return (
                    <div key={b.batch_id || i} style={{ padding: '6px 0', borderBottom: i < filteredCancelled.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{recipient}</div>
                          {b.product_name && <div style={{ fontSize: 11, color: TEXT2 }}>{b.product_name}</div>}
                          <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>{dt} · {b.cancelled_by || '—'}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#C92A2A', flexShrink: 0 }}>−{b.total_quantity} шт.</div>
                      </div>
                    </div>
                  )
                })}
              </Section>
            )}

            {/* Debt adjustments */}
            {!courierId && !factoryId && filteredDebtAdj.length > 0 && (
              <Section title="Изменения долга бутылок" color="#0077B6" bg="#E8F4FD">
                {filteredDebtAdj.map((a, i) => {
                  const typeLabel = a.target_type === 'courier' ? 'Курьер' : a.target_type === 'factory' ? 'Завод' : 'Клиент'
                  const dt = a.created_at
                    ? new Date(a.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—'
                  return (
                    <div key={a.id} style={{ padding: '6px 0', borderBottom: i < filteredDebtAdj.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: TEXT2, fontSize: 11 }}>{typeLabel}: </span>{a.target_name || '—'}
                          </div>
                          {a.note && <div style={{ fontSize: 11, color: TEXT2 }}>{a.note}</div>}
                          <div style={{ fontSize: 10, color: TEXT2, marginTop: 1 }}>{dt} · {a.performed_by || '—'}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: a.delta > 0 ? '#C92A2A' : '#2B8A3E', flexShrink: 0 }}>
                          {a.delta > 0 ? `+${a.delta}` : a.delta} бут.
                        </div>
                      </div>
                    </div>
                  )
                })}
              </Section>
            )}

            {/* Bottle debt */}
            {hasDebt && (
              <Section title="Долг по бутылкам 19л" color="#C92A2A" bg="#FFE8E8">
                {debtCouriers.length === 0 && debtFactories.length === 0 ? (
                  <Row label="Долгов нет" value="" />
                ) : (
                  <>
                    {debtCouriers.map(c => (
                      <Row key={`c_${c.id}`} label={c.name} value={`${c.bottles_must_return || 0} бут.`} valueColor={c.bottles_must_return > 0 ? '#C92A2A' : TEXT2} />
                    ))}
                    {debtFactories.map(f => (
                      <Row key={`f_${f.id}`} label={f.name} value={`${f.bottles_must_return || 0} бут.`} valueColor="#9C36B5" />
                    ))}
                  </>
                )}
                {!courierId && !factoryId && (debtCouriers.length + debtFactories.length) > 1 && (
                  <Row label="Итого" value={`${totalDebt} бут.`} valueColor="#C92A2A" bold />
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, color, bg, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <div style={{ background: bg, padding: '8px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      </div>
      <div style={{ padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, indent, valueColor, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: bold ? TEXT : TEXT, fontWeight: bold ? 700 : 500, paddingLeft: indent ? 10 : 0, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 700, color: valueColor || TEXT, flexShrink: 0 }}>{value}</span>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9200, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '10px 18px 34px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92vh', overflowY: 'auto', animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
}
