import { useEffect, useMemo, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'
import { getWarehouseHistory, getAdminCouriers, getProducts, getWarehouseCourierStats, getInvoiceUrl, getFactories, cancelIssueBatch, getCancelledBatches } from '../../api'
import { useAuthStore } from '../../store/auth'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const TYPES = [
  { key: 'all', label: 'Все', color: TEXT2, bg: '#F2F2F7', activeBg: '#E5E5EA', activeBorder: BORDER },
  { key: 'production', label: 'Производство', color: '#2B8A3E', bg: '#EBFBEE', activeBorder: '#2B8A3E' },
  { key: 'issue', label: 'Выдача', color: '#E67700', bg: '#FFF3D9', activeBorder: '#E67700' },
  { key: 'factory_issue', label: 'Завод', color: '#9C36B5', bg: '#F8EBFC', activeBorder: '#9C36B5' },
  { key: 'bottle_return', label: 'Возврат тары', color: '#1971C2', bg: '#E8F4FD', activeBorder: '#1971C2' },
]

const fmtSum = v => v > 0 ? v.toLocaleString('ru-RU') + ' сум' : null

export default function WarehouseHistory({ Layout = WarehouseLayout, title = 'История' }) {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState('all')
  const [customDate, setCustomDate] = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [type, setType] = useState('all')
  const [productName, setProductName] = useState('all')
  const [courierId, setCourierId] = useState('all')
  const [factoryId, setFactoryId] = useState('all')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [courierPickerOpen, setCourierPickerOpen] = useState(false)
  const [factoryPickerOpen, setFactoryPickerOpen] = useState(false)

  const [couriers, setCouriers] = useState([])
  const [factories, setFactories] = useState([])
  const [catalog, setCatalog] = useState([])
  const [history, setHistory] = useState([])
  const [courierStats, setCourierStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelledBatches, setCancelledBatches] = useState([])
  const [cancelConfirm, setCancelConfirm] = useState(null) // batch_id being confirmed
  const [cancelling, setCancelling] = useState(null) // batch_id currently cancelling

  useEffect(() => {
    getAdminCouriers()
      .then(cs => setCouriers(cs.filter(c => c.is_active)))
      .catch(console.error)
    getProducts()
      .then(prods => {
        const list = (Array.isArray(prods) ? prods : [])
          .filter(p => p.is_active !== false)
          .map(p => ({ id: p.id, name: p.name }))
        setCatalog(list)
      })
      .catch(console.error)
    getWarehouseCourierStats('all')
      .then(cs => setCourierStats(cs || []))
      .catch(console.error)
    getFactories()
      .then(fs => setFactories(Array.isArray(fs) ? fs : []))
      .catch(console.error)
    getCancelledBatches().then(data => setCancelledBatches(Array.isArray(data) ? data : [])).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const cd = period === 'custom' ? customDate : null
    const cdTo = period === 'custom' ? customDateTo : null
    const filters = {
      period,
      customDate: cd,
      customDateTo: cdTo,
      type: type === 'all' ? undefined : type,
      product: productName === 'all' ? undefined : productName,
      courier_id: courierId === 'all' ? null : Number(courierId),
      factory_id: factoryId === 'all' ? null : Number(factoryId),
    }
    getWarehouseHistory(filters)
      .then(data => setHistory([...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period, customDate, customDateTo, type, productName, courierId, factoryId])

  // Group batch transactions: merge bottle_return into their parent issue row;
  // orphaned bottle_return entries (parent issue was deleted) are shown separately.
  const groupedHistory = useMemo(() => {
    const batchReturns = {}
    for (const h of history) {
      if (h.batch_id && (h.type === 'bottle_return' || h.type === 'return' || h.type === 'returned')) {
        if (!batchReturns[h.batch_id]) batchReturns[h.batch_id] = { qty: 0, note: null, _entry: h }
        batchReturns[h.batch_id].qty += h.quantity
        if (h.note) batchReturns[h.batch_id].note = h.note
      }
    }
    // Track which batch_ids have a parent issue/factory_issue row
    const parentBatchIds = new Set()
    for (const h of history) {
      if (h.batch_id && (h.type === 'issue' || h.type === 'issued' || h.type === 'factory_issue')) {
        parentBatchIds.add(h.batch_id)
      }
    }
    // Exclude bottle_returns only if their parent issue exists (they'll be merged in)
    const rows = history
      .filter(h => !(h.batch_id && (h.type === 'bottle_return' || h.type === 'return' || h.type === 'returned') && parentBatchIds.has(h.batch_id)))
      .map(h => {
        if (h.batch_id && (h.type === 'issue' || h.type === 'issued' || h.type === 'factory_issue')) {
          const ret = batchReturns[h.batch_id]
          if (ret) return { ...h, return_qty: ret.qty, return_note: ret.note }
        }
        return h
      })
    return rows
  }, [history])

  const summary = useMemo(() => {
    const prodByProduct = {}   // { name: { qty, cost } }
    const issueByProduct = {}  // { name: { qty, cost } }
    const returnByCourier = {} // { name: qty }
    const factoryByFactory = {} // { name: qty }
    history.forEach(h => {
      if (h.type === 'production') {
        const name = h.product_name || h.product_short || '—'
        if (!prodByProduct[name]) prodByProduct[name] = { qty: 0, cost: 0 }
        prodByProduct[name].qty += h.quantity
        if (h.cost_price) prodByProduct[name].cost += h.quantity * h.cost_price
      }
      if (h.type === 'issue' || h.type === 'issued' || h.type === 'factory_issue') {
        const name = h.product_name || h.product_short || '—'
        if (!issueByProduct[name]) issueByProduct[name] = { qty: 0, cost: 0 }
        issueByProduct[name].qty += h.quantity
        if (h.cost_price) issueByProduct[name].cost += h.quantity * h.cost_price
      }
      if (h.type === 'factory_issue') {
        const fn = h.factory_name || '—'
        factoryByFactory[fn] = (factoryByFactory[fn] || 0) + h.quantity
      }
      if (h.type === 'bottle_return' || h.type === 'return' || h.type === 'returned') {
        const cn = h.courier_name || '—'
        returnByCourier[cn] = (returnByCourier[cn] || 0) + h.quantity
      }
    })
    const totalReturned = Object.values(returnByCourier).reduce((s, v) => s + v, 0)
    const totalFactory = Object.values(factoryByFactory).reduce((s, v) => s + v, 0)
    return { prodByProduct, issueByProduct, returnByCourier, factoryByFactory, totalReturned, totalFactory }
  }, [history])

  const debtCouriers = courierId === 'all'
    ? courierStats.filter(c => (c.bottles_must_return || 0) > 0)
    : courierStats.filter(c => String(c.id) === courierId && (c.bottles_must_return || 0) > 0)

  const totalDebt = debtCouriers.reduce((s, c) => s + (c.bottles_must_return || 0), 0)

  const hasSummary = !loading && (
    Object.keys(summary.prodByProduct).length > 0 ||
    Object.keys(summary.issueByProduct).length > 0 ||
    Object.keys(summary.returnByCourier).length > 0 ||
    Object.keys(summary.factoryByFactory).length > 0 ||
    debtCouriers.length > 0
  )

  const fmtDateStr = s => {
    if (!s) return ''
    const [y, m, d] = String(s).split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }
  const periodLabel = period === 'custom'
    ? (customDate
        ? (customDateTo && customDateTo !== customDate
            ? `${fmtDateStr(customDate)} – ${fmtDateStr(customDateTo)}`
            : fmtDateStr(customDate))
        : 'Дата')
    : period === 'today' ? 'Сегодня' : ''

  const applyCustom = (start, end) => {
    setCustomDate(start); setCustomDateTo(end); setPeriod('custom')
  }

  const selectedProduct = catalog.find(p => p.name === productName)
  const selectedCourier = couriers.find(c => String(c.id) === courierId)
  const selectedFactory = factories.find(f => String(f.id) === factoryId)

  const handleCancelBatch = async (batchId) => {
    setCancelling(batchId)
    try {
      await cancelIssueBatch(batchId, user?.name || 'Завсклад', user?.role || 'warehouse')
      setHistory(prev => prev.filter(h => h.batch_id !== batchId))
      getCancelledBatches().then(data => setCancelledBatches(Array.isArray(data) ? data : [])).catch(() => {})
    } catch (e) {
      alert('Ошибка при отмене: ' + e.message)
    } finally {
      setCancelling(null)
      setCancelConfirm(null)
    }
  }

  const roleLabel = (role) => {
    if (!role) return ''
    if (role === 'admin') return 'Админ'
    if (role === 'warehouse' || role === 'warehouse_staff') return 'Завсклад'
    if (role === 'manager') return 'Менеджер'
    return role
  }

  return (
    <Layout title={title}>
      {cancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 20px', maxWidth: 360, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Отменить выдачу?</div>
            <div style={{ fontSize: 13, color: TEXT2, marginBottom: 20 }}>Это действие вернёт товар на склад и запишет отмену в историю. Отменить нельзя.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCancelConfirm(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#F2F2F7', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: TEXT }}>Назад</button>
              <button
                onClick={() => handleCancelBatch(cancelConfirm)}
                disabled={!!cancelling}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#FF3B30', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', opacity: cancelling ? 0.7 : 1 }}>
                {cancelling ? '...' : 'Отменить'}
              </button>
            </div>
          </div>
        </div>
      )}
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate}
          initialDateTo={customDateTo}
          onApply={applyCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {productPickerOpen && (
        <PickerSheet
          title="Продукт"
          options={[{ id: 'all', name: 'Все продукты' }, ...catalog.map(p => ({ id: p.name, name: p.name }))]}
          value={productName}
          onChange={v => { setProductName(v); setProductPickerOpen(false) }}
          onClose={() => setProductPickerOpen(false)}
        />
      )}
      {courierPickerOpen && (
        <PickerSheet
          title="Курьер"
          options={[{ id: 'all', name: 'Все курьеры' }, ...couriers.map(c => ({ id: String(c.id), name: c.name }))]}
          value={courierId}
          onChange={v => { setCourierId(v); setCourierPickerOpen(false) }}
          onClose={() => setCourierPickerOpen(false)}
        />
      )}
      {factoryPickerOpen && (
        <PickerSheet
          title="Завод"
          options={[{ id: 'all', name: 'Все заводы' }, ...factories.map(f => ({ id: String(f.id), name: f.name }))]}
          value={factoryId}
          onChange={v => { setFactoryId(v); setFactoryPickerOpen(false) }}
          onClose={() => setFactoryPickerOpen(false)}
        />
      )}

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={() => { setPeriod('all'); setCustomDate(null); setCustomDateTo(null) }} style={{
          flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
          background: period === 'all' ? GRAD : '#fff',
          color: period === 'all' ? '#fff' : TEXT2,
          border: period === 'all' ? 'none' : `1.5px solid ${BORDER}`,
          fontSize: 12, fontWeight: 700,
        }}>Все</button>
        <button onClick={() => { setPeriod('today'); setCustomDate(null); setCustomDateTo(null) }} style={{
          flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
          background: period === 'today' ? GRAD : '#fff',
          color: period === 'today' ? '#fff' : TEXT2,
          border: period === 'today' ? 'none' : `1.5px solid ${BORDER}`,
          fontSize: 12, fontWeight: 700,
        }}>Сегодня</button>
        <button onClick={() => setPickerOpen(true)} style={{
          flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
          background: period === 'custom' ? GRAD : '#fff',
          color: period === 'custom' ? '#fff' : TEXT2,
          border: period === 'custom' ? 'none' : `1.5px solid ${BORDER}`,
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {period === 'custom' ? periodLabel : 'Дата'}
        </button>
      </div>

      {/* Type chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
        {TYPES.map(t => {
          const active = type === t.key
          return (
            <button key={t.key} onClick={() => setType(t.key)} style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: active ? t.bg : '#F2F2F7',
              color: active ? t.color : TEXT2,
              border: active ? `1.5px solid ${t.activeBorder || t.color}` : '1.5px solid transparent',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>{t.label}</button>
          )
        })}
      </div>

      {/* Product + Courier filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setProductPickerOpen(true)} style={{
          flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
          background: productName !== 'all' ? '#F0FAE8' : '#fff',
          color: productName !== 'all' ? CD : TEXT2,
          border: `1.5px solid ${productName !== 'all' ? C : BORDER}`,
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', minWidth: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M20 7H4M17 12H7M14 17h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedProduct ? selectedProduct.name : 'Продукт'}
          </span>
        </button>
        <button onClick={() => setCourierPickerOpen(true)} style={{
          flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
          background: courierId !== 'all' ? '#F0FAE8' : '#fff',
          color: courierId !== 'all' ? CD : TEXT2,
          border: `1.5px solid ${courierId !== 'all' ? C : BORDER}`,
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', minWidth: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedCourier ? selectedCourier.name : 'Курьер'}
          </span>
        </button>
        <button onClick={() => setFactoryPickerOpen(true)} style={{
          flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
          background: factoryId !== 'all' ? '#F8EBFC' : '#fff',
          color: factoryId !== 'all' ? '#9C36B5' : TEXT2,
          border: `1.5px solid ${factoryId !== 'all' ? '#9C36B5' : BORDER}`,
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', minWidth: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M3 21h18M5 21V9l5 3V9l5 3V9l4 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedFactory ? selectedFactory.name : 'Завод'}
          </span>
        </button>
      </div>

      {/* Summary sections */}
      {hasSummary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {Object.keys(summary.prodByProduct).length > 0 && (
            <SummarySection title="Произведено" color="#2B8A3E" bg="#EBFBEE">
              {Object.entries(summary.prodByProduct).map(([name, { qty, cost }]) => (
                <SummaryRow key={name} label={name} value={`+${qty} шт.`} sub={fmtSum(cost)} color="#2B8A3E" />
              ))}
            </SummarySection>
          )}
          {Object.keys(summary.issueByProduct).length > 0 && (
            <SummarySection title="Выдано" color="#E67700" bg="#FFF3D9">
              {Object.entries(summary.issueByProduct).map(([name, { qty, cost }]) => (
                <SummaryRow key={name} label={name} value={`${qty} шт.`} sub={fmtSum(cost)} color="#E67700" />
              ))}
            </SummarySection>
          )}
          {Object.keys(summary.factoryByFactory).length > 0 && (
            <SummarySection title={`Выдано заводу · ${summary.totalFactory} шт.`} color="#9C36B5" bg="#F8EBFC">
              {Object.entries(summary.factoryByFactory).map(([name, qty]) => (
                <SummaryRow key={name} label={name} value={`${qty} шт.`} color="#9C36B5" />
              ))}
            </SummarySection>
          )}
          {Object.keys(summary.returnByCourier).length > 0 && (
            <SummarySection title={`Возвращено тары · ${summary.totalReturned} бут.`} color="#1971C2" bg="#E8F4FD">
              {Object.entries(summary.returnByCourier).map(([name, qty]) => (
                <SummaryRow key={name} label={name} value={`${qty} бут.`} color="#1971C2" />
              ))}
            </SummarySection>
          )}
          {debtCouriers.length > 0 && (
            <SummarySection title={`Должны вернуть · ${totalDebt} бут.`} color="#C92A2A" bg="#FFE8E8">
              {debtCouriers.map(c => (
                <SummaryRow key={c.id} label={c.name} value={`${c.bottles_must_return} бут.`} color="#C92A2A" />
              ))}
            </SummarySection>
          )}
        </div>
      )}

      {/* Section title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Операции · {history.length}
        </span>
        <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
      </div>

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
          {groupedHistory.map((h, i) => {
            const isProd = h.type === 'production'
            const isIssue = h.type === 'issued' || h.type === 'issue'
            const isFactoryIssue = h.type === 'factory_issue'
            const isFactoryReturn = h.type === 'factory_return'
            const isRet = h.type === 'returned' || h.type === 'return' || h.type === 'bottle_return'

            const color = isProd ? '#2B8A3E'
              : isIssue ? '#E67700'
              : isFactoryIssue ? '#9C36B5'
              : isFactoryReturn ? '#9C36B5'
              : '#1971C2'
            const bg = isProd ? '#EBFBEE'
              : isIssue ? '#FFF3D9'
              : (isFactoryIssue || isFactoryReturn) ? '#F8EBFC'
              : '#E8F4FD'
            // Goods leaving the warehouse use '−'; coming back use '+'
            const sign = (isProd || isRet || isFactoryReturn) ? '+' : '−'

            const rowTitle = isProd
              ? (h.product_name || h.product_short || 'Производство')
              : (isIssue || isFactoryIssue || isFactoryReturn)
              ? (h.product_name || h.product_short || 'Выдача')
              : 'Бутылки 19л'

            const subline = isProd
              ? `Производство${h.note ? ` · ${h.note}` : ''}`
              : isIssue
              ? `Выдача · ${h.courier_name || '—'}`
              : isFactoryIssue
              ? `Выдача заводу · ${h.factory_name || '—'}`
              : isFactoryReturn
              ? `Возврат от завода · ${h.factory_name || '—'}`
              : `Возврат тары · ${h.courier_name || '—'}`

            const priceTotal = (isIssue || isFactoryIssue) && h.price ? h.quantity * h.price : null
            const costTotal = (isIssue || isFactoryIssue) && h.cost_price ? h.quantity * h.cost_price : null
            const debtNote = isRet && h.note ? h.note : null

            const ts = h.created_at || h.date
            const showInvoice = h.batch_id && (isIssue || isFactoryIssue)

            return (
              <div key={h.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: i < groupedHistory.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {isProd && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>}
                  {(isIssue || isFactoryIssue) && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {(isRet || isFactoryReturn) && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rowTitle}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subline}
                  </div>
                  {debtNote && (
                    <div style={{ fontSize: 11, color: '#1971C2', marginTop: 2, fontWeight: 600 }}>
                      {debtNote}
                    </div>
                  )}
                  {(isIssue || isFactoryIssue) && h.return_qty > 0 && (
                    <div style={{ fontSize: 11, color: '#1971C2', marginTop: 2, fontWeight: 600 }}>
                      ↩ Возврат: {h.return_qty} бут.{h.return_note ? ` · ${h.return_note}` : ''}
                    </div>
                  )}
                  {h.performed_by && (
                    <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>
                      Создал: {h.performed_by_role ? `${roleLabel(h.performed_by_role)} · ` : ''}{h.performed_by}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color }}>{sign}{h.quantity}</div>
                  {priceTotal && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#E67700' }}>
                      {priceTotal.toLocaleString('ru-RU')} сум
                    </div>
                  )}
                  {costTotal && (
                    <div style={{ fontSize: 10, fontWeight: 500, color: '#868E96' }}>
                      с/с {costTotal.toLocaleString('ru-RU')} сум
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: TEXT2 }}>
                    {new Date(ts).toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short' })} · {new Date(ts).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {showInvoice && (
                    <a href={getInvoiceUrl(h.batch_id)} target="_blank" rel="noreferrer"
                       style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#1971C2', background: '#E8F4FD', padding: '3px 8px', borderRadius: 999, textDecoration: 'none' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Накладная
                    </a>
                  )}
                  {((isIssue || isFactoryIssue || isRet) && h.batch_id) && (
                    <button
                      onClick={() => setCancelConfirm(h.batch_id)}
                      disabled={cancelling === h.batch_id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#C92A2A', background: '#FFE8E8', padding: '3px 8px', borderRadius: 999, border: 'none', cursor: 'pointer', marginTop: 2 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      Отменить
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Cancelled batches section */}
      {cancelledBatches.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0 8px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C92A2A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Отменённые выдачи · {cancelledBatches.length}
            </span>
          </div>
          <div style={{ background: '#fff', borderRadius: 18, padding: '4px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {cancelledBatches.map((b, i) => {
              const isFactory = b.transaction_type === 'factory_issue'
              const recipient = isFactory ? (b.factory_name || '—') : (b.courier_name || '—')
              const recipientLabel = isFactory ? 'Завод' : 'Курьер'
              const ts = b.cancelled_at
              const origTs = b.original_created_at
              return (
                <div key={b.id} style={{ padding: '12px 0', borderBottom: i < cancelledBatches.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#C92A2A" strokeWidth="2.5" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.product_name || (isFactory ? 'Выдача заводу' : 'Выдача')}
                      </div>
                      <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>
                        {recipientLabel}: {recipient} · {b.total_quantity} шт.
                      </div>
                      {b.performed_by && (
                        <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>
                          Создал: {b.performed_by_role ? `${roleLabel(b.performed_by_role)} · ` : ''}{b.performed_by}
                        </div>
                      )}
                      {b.cancelled_by && (
                        <div style={{ fontSize: 10, color: '#C92A2A', marginTop: 2, fontWeight: 600 }}>
                          Отменил: {b.cancelled_by_role ? `${roleLabel(b.cancelled_by_role)} · ` : ''}{b.cancelled_by}
                        </div>
                      )}
                      {origTs && (
                        <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>
                          Выдача: {new Date(origTs).toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short' })} · {new Date(origTs).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#C92A2A' }}>−{b.total_quantity}</div>
                      <div style={{ fontSize: 10, color: TEXT2 }}>
                        {new Date(ts).toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short' })} · {new Date(ts).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {b.batch_id && (
                        <a href={getInvoiceUrl(b.batch_id)} target="_blank" rel="noreferrer"
                           style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#868E96', background: '#F2F2F7', padding: '3px 8px', borderRadius: 999, textDecoration: 'none', marginTop: 2 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Накладная
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Layout>
  )
}

function PickerSheet({ title, options, value, onChange, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '10px 16px 34px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '72vh', animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 6px', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{title}</div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: TEXT2, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {options.map(o => {
            const active = String(o.id) === String(value)
            return (
              <button key={o.id} onClick={() => onChange(String(o.id))} style={{
                padding: '12px 14px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                background: active ? '#F0FAE8' : '#F8F9FA',
                color: active ? CD : TEXT,
                border: `1.5px solid ${active ? C : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{o.name}</span>
                {active && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke={CD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SummarySection({ title, color, bg, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <div style={{ background: bg, padding: '6px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      </div>
      <div style={{ padding: '4px 14px 8px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, sub, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: color || TEXT }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: TEXT2 }}>{sub}</span>}
      </div>
    </div>
  )
}
