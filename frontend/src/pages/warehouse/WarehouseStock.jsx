import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import DateTimePickerModal, { toISODate } from '../../components/warehouse/DateTimePickerModal'
import { getWarehouseOverview, addProduction, getSubscriptionsByPeriod, getProductionPlan, getCatalogProducts, issueWaterToCourier, adjustStock, getAdminCouriers, getInvoiceUrl } from '../../api'
import { useAuthStore } from '../../store/auth'
import { useSubscriptionsEnabled } from '../../hooks/useSubscriptionsEnabled'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const QUICK = [
  { key: 'today', label: 'Сегодня' },
]

function loadReminders() {
  try { return JSON.parse(localStorage.getItem('wh_reminders') || '[]') } catch { return [] }
}
function saveReminders(list) {
  localStorage.setItem('wh_reminders', JSON.stringify(list))
}

export default function WarehouseStock({ Layout = WarehouseLayout, title = 'Склад' }) {
  const subsEnabled = useSubscriptionsEnabled()
  const { user } = useAuthStore()
  const actor = user?.name || null
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [remindersOpen, setRemindersOpen] = useState(false)
  const [reminders, setReminders] = useState(loadReminders)

  const [overview, setOverview] = useState(null)
  const [subs, setSubs] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [couriers, setCouriers] = useState([])
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [invoiceModal, setInvoiceModal] = useState(null) // { batchId, courierName }

  const addReminder = (reminder) => {
    const updated = [...reminders, { ...reminder, id: Date.now() }]
    setReminders(updated)
    saveReminders(updated)
  }
  const deleteReminder = (id) => {
    const updated = reminders.filter(r => r.id !== id)
    setReminders(updated)
    saveReminders(updated)
  }

  const upcomingCount = reminders.filter(r => {
    const dt = new Date(`${r.date}T${r.time || '00:00'}`)
    return dt >= new Date()
  }).length

  const load = () => {
    setLoading(true)
    const cd = period === 'custom' ? customDate : null
    Promise.all([
      getWarehouseOverview(period, cd, timeFrom, timeTo),
      getSubscriptionsByPeriod(period, cd),
      getProductionPlan(),
    ])
      .then(([ov, sb, pl]) => { setOverview(ov); setSubs(sb); setPlan(pl) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [period, customDate, timeFrom, timeTo]) // eslint-disable-line
  useEffect(() => { getAdminCouriers().then(cs => setCouriers(cs.filter(c => c.is_active))).catch(console.error) }, [])

  const applyCustom = (date, from, to) => {
    setCustomDate(date)
    setTimeFrom(from)
    setTimeTo(to)
    setPeriod('custom')
  }

  const periodLabel = period === 'custom'
    ? (customDate ? `${customDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}${timeFrom || timeTo ? ` · ${timeFrom || '00:00'}–${timeTo || '23:59'}` : ''}` : 'Дата')
    : QUICK.find(p => p.key === period)?.label || ''

  if (loading && !overview) {
    return (
      <Layout title={title}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      </Layout>
    )
  }

  const products = overview?.products || []
  const totals = overview?.totals || {}
  const shortfallItems = overview?.shortfall_items || []
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.stock > 0)

  return (
    <Layout title={title}>
      {showAdd && <AddProductionModal onClose={() => setShowAdd(false)} products={products.length ? products : undefined} onSave={async (productId, qty, note, nameHint) => { await addProduction(productId, qty, note, nameHint, actor); load() }} />}
      {showIssue && <IssueToCourierModal couriers={couriers} products={products} onClose={() => setShowIssue(false)} onSave={async (courierId, courierName, name, qty, vt, vp) => {
        const res = await issueWaterToCourier(courierId, courierName, name, qty, actor, vt, vp)
        if (res?.batch_id) setInvoiceModal({ batchId: res.batch_id, courierName })
        load()
      }} />}
      {adjustProduct && <AdjustStockModal product={adjustProduct} onClose={() => setAdjustProduct(null)} onSave={async (name, delta, type, note) => { await adjustStock(name, delta, type, note, actor); load() }} />}
      {invoiceModal && (
        <InvoiceSuccessModal
          batchId={invoiceModal.batchId}
          courierName={invoiceModal.courierName}
          onClose={() => setInvoiceModal(null)}
        />
      )}
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate}
          initialFrom={timeFrom}
          initialTo={timeTo}
          onApply={applyCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {remindersOpen && (
        <RemindersModal
          reminders={reminders}
          onAdd={addReminder}
          onDelete={deleteReminder}
          onClose={() => setRemindersOpen(false)}
        />
      )}

      {/* Shortfall alert with per-item volumes */}
      {shortfallItems.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #FFE8E8, #FFF5F5)', border: '1.5px solid #FFB4B4', borderRadius: 16, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 2L2 20h20L12 2z" fill="#E03131" />
            <path d="M12 9v5M12 17v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#C92A2A' }}>Не хватает {totals.shortfall} шт.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
              {shortfallItems.map(it => (
                <div key={it.product_name} style={{ fontSize: 12, color: '#862020' }}>
                  • <b>{it.qty} шт.</b> × {it.product_name}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#862020', marginTop: 6, opacity: 0.85 }}>
              Заказано больше, чем есть на складе и у курьеров
            </div>
          </div>
        </div>
      )}

      {/* Period filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <SegGroup options={QUICK} value={period} onChange={setPeriod} />
        <button
          onClick={() => setPickerOpen(true)}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
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
        <button
          onClick={() => setRemindersOpen(true)}
          style={{
            position: 'relative', flex: 1, padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
            background: '#fff', color: TEXT2,
            border: `1.5px solid ${BORDER}`,
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Планы
          {upcomingCount > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              background: '#E03131', color: '#fff',
              borderRadius: '50%', width: 16, height: 16,
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{upcomingCount}</span>
          )}
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px 10px', borderRadius: 14, border: 'none',
          background: GRAD, color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)',
        }} onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
          Производство
        </button>
        <button style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px 10px', borderRadius: 14, border: `1.5px solid ${C}`,
          background: '#fff', color: CD, fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
        }} onClick={() => setShowIssue(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke={CD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Выдать курьеру
        </button>
      </div>

      {/* Summary totals (labels under numbers, no + =) */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 10px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <TotalStat value={totals.stock} label="На складе" color={C} />
          <TotalStat value={totals.on_couriers} label="У курьеров" color="#1971C2" />
          <TotalStat value={totals.total} label="Всего" color={TEXT} />
        </div>
      </div>

      {/* Section title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Продукция</span>
        <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
      </div>

      {/* 2-column product grid — always shows all active catalog products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {products.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 30, color: TEXT2, fontSize: 14 }}>Каталог пуст</div>
        ) : products.map(p => <ProductCard key={p.key} p={p} period={period} onAdjust={() => setAdjustProduct(p)} />)}
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
                  <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>Есть {r.current} · нужно {r.needed}</div>
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

      {/* Low stock */}
      {lowStockProducts.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>Мало на складе</div>
          <div style={{ background: '#fff', borderRadius: 16, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            {lowStockProducts.map((p, i) => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < lowStockProducts.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E03131', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{p.product_name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#E03131' }}>{p.stock}</span>
                <span style={{ fontSize: 11, color: TEXT2 }}>шт.</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Subscriptions for period — hidden when the module is disabled */}
      {subsEnabled !== false && <>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>
        Подписки клиентов · {periodLabel.toLowerCase()}
      </div>
      <div style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        {!subs?.subscriptions?.length ? (
          <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', padding: '10px 0' }}>Нет подписок на выбранный период</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: TEXT2 }}>Подписок в период</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C }}>{subs.subscriptions.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {Object.entries(subs.demand || {}).map(([product, qty]) => (
                <div key={product} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#F8F9FA', borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{product}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CD }}>{qty} шт.</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: TEXT2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Расписание</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {subs.subscriptions.map(ss => (
                <div key={`${ss.user_id}-${ss.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{ss.plan}</div>
                    <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{ss.day} · {ss.time}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: CD }}>{ss.total_qty} шт.</div>
                    {ss.occurrences > 1 && <div style={{ fontSize: 10, color: TEXT2 }}>× {ss.occurrences} шт.</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      </>}
    </Layout>
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

function TotalStat({ value, label, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: TEXT2, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function ProductCard({ p, period, onAdjust }) {
  const isShort = p.shortfall > 0
  const isLow = p.stock <= 10 && p.stock > 0
  const needLabel = period === 'custom' ? 'К выдаче за период' : 'К выдаче'

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: isShort ? '1.5px solid #FFB4B4' : '1.5px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.2, flex: 1 }}>{p.product_name}</div>
        <button onClick={onAdjust} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: TEXT2, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Header row: stock (left) + total (right), both: number on top, label below */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: isLow ? '#E03131' : (isShort ? '#E03131' : C), lineHeight: 1 }}>{p.stock}</span>
          <span style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>на складе</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{p.total}</span>
          <span style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>всего</span>
        </div>
      </div>

      {/* Secondary stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
        <Row label="У курьеров" value={p.on_couriers} color="#1971C2" />
        {p.needed_period > 0 && <Row label={needLabel} value={p.needed_period} color="#E67700" />}
        {p.delivered_period > 0 && <Row label="Доставлено" value={p.delivered_period} color="#2B8A3E" />}
        {p.produced_period > 0 && <Row label="Произведено" value={`+${p.produced_period}`} color="#2B8A3E" />}
        {p.issued_period > 0 && <Row label="Выдано курьерам" value={p.issued_period} color="#E67700" />}
        {p.returned_period > 0 && <Row label="Возвраты" value={`+${p.returned_period}`} color="#1971C2" />}
      </div>

      {isShort && (
        <div style={{ marginTop: 8, padding: '5px 8px', background: '#FFE8E8', borderRadius: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: '#C92A2A', fontWeight: 700 }}>Не хватает: {p.shortfall}</span>
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

function AddProductionModal({ onClose, onSave, products: propProducts }) {
  // Normalize overview products ({product_id, product_name}) and catalog products ({id, short_name})
  const catalog = (propProducts || getCatalogProducts()).map(p => ({
    id: p.id ?? p.product_id,
    short_name: p.short_name ?? p.product_name,
  }))
  const [selectedId, setSelectedId] = useState(catalog[0]?.id || null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const selected = catalog.find(p => p.id === selectedId)

  const handle = async () => {
    if (!qty || Number(qty) <= 0 || !selectedId) return
    setLoading(true)
    try { await onSave(selectedId, Number(qty), note.trim(), selected?.short_name || selected?.product_name); onClose() }
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
            {catalog.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: selectedId === p.id ? GRAD : '#F8F9FA',
                color: selectedId === p.id ? '#fff' : TEXT,
                border: selectedId === p.id ? 'none' : `1px solid ${BORDER}`,
              }}>{p.short_name}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Количество</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 5, 10, 20, 50].map(n => (
              <button key={n} onClick={() => setQty(p => String((Number(p) || 0) + n))} style={st.presetBtn}>+{n}</button>
            ))}
            {Number(qty) > 0 && <button onClick={() => setQty('')} style={st.presetBtnReset}>✕</button>}
          </div>
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

function IssueToCourierModal({ couriers, products, onClose, onSave }) {
  const catalog = (products || []).map(p => ({ id: p.product_id ?? p.id, name: p.product_name ?? p.name }))
  const [courierId, setCourierId] = useState(couriers[0]?.id || null)
  const [name, setName] = useState(catalog[0]?.name || '')
  const [qty, setQty] = useState('')
  const [loading, setLoading] = useState(false)
  const courier = couriers.find(c => c.id === courierId)

  const [vehicleType, setVehicleType] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  // When the courier changes, prefill from their saved vehicle
  useEffect(() => {
    setVehicleType(courier?.vehicle_type || '')
    setVehiclePlate(courier?.vehicle_plate || '')
  }, [courierId]) // eslint-disable-line

  const dis = !qty || Number(qty) <= 0 || !courierId || !name
  const handle = async () => {
    if (dis) return
    setLoading(true)
    try { await onSave(courierId, courier?.name || '', name, Number(qty), vehicleType.trim() || null, vehiclePlate.trim() || null); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Выдать курьеру</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Курьер</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {couriers.map(c => (
              <button key={c.id} onClick={() => setCourierId(c.id)} style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: courierId === c.id ? GRAD : '#F8F9FA',
                color: courierId === c.id ? '#fff' : TEXT,
                border: courierId === c.id ? 'none' : `1px solid ${BORDER}`,
              }}>{c.name}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Продукт</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catalog.map(p => (
              <button key={p.id} onClick={() => setName(p.name)} style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: name === p.name ? GRAD : '#F8F9FA',
                color: name === p.name ? '#fff' : TEXT,
                border: name === p.name ? 'none' : `1px solid ${BORDER}`,
              }}>{p.name}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Количество</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 5, 10, 20, 50].map(n => (
              <button key={n} onClick={() => setQty(p => String((Number(p) || 0) + n))} style={st.presetBtn}>+{n}</button>
            ))}
            {Number(qty) > 0 && <button onClick={() => setQty('')} style={st.presetBtnReset}>✕</button>}
          </div>
          <input style={st.input} type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />

          {/* Vehicle for the invoice */}
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>Транспорт (для накладной)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...st.input, flex: 1 }} value={vehicleType} onChange={e => setVehicleType(e.target.value)} placeholder="Тип машины" />
            <input style={{ ...st.input, flex: 1 }} value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value.toUpperCase())} placeholder="Госномер" />
          </div>
        </div>
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={dis || loading} onClick={handle}>
          {loading ? 'Выдаю...' : `Выдать ${qty || 0} шт. → ${courier?.name || '?'}`}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

/* Success modal — same as in WarehouseCouriers */
function InvoiceSuccessModal({ batchId, courierName, onClose }) {
  const url = getInvoiceUrl(batchId)
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={st.handle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EBFBEE', color: '#2B8A3E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Накладная создана</div>
        </div>
        <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', marginTop: -4 }}>
          Курьер: <b style={{ color: TEXT }}>{courierName}</b><br/>
          Отправлена администратору в Telegram
        </div>
        <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 8 }}>
          <img src={url} alt="накладная" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
        </div>
        <a href={url} download={`nakladnaya_${batchId.slice(0, 8)}.png`}
           style={{ padding: 16, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' }}>
          Скачать накладную
        </a>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

const ADJUST_TYPES = [
  { key: 'plus', label: '+', desc: 'Добавить' },
  { key: 'minus', label: '−', desc: 'Списать' },
]

function AdjustStockModal({ product, onClose, onSave }) {
  const [adjType, setAdjType] = useState('plus')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const dis = !qty || Number(qty) <= 0
  const handle = async () => {
    if (dis) return
    setLoading(true)
    const delta = adjType === 'plus' ? Number(qty) : -Number(qty)
    try { await onSave(product.product_name, delta, `adjustment_${adjType}`, note.trim()); onClose() }
    catch { alert('Ошибка') }
    finally { setLoading(false) }
  }
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Корректировка</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT2, textAlign: 'center', marginTop: -6 }}>{product.product_name}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ADJUST_TYPES.map(t => (
            <button key={t.key} onClick={() => setAdjType(t.key)} style={{
              flex: 1, padding: '12px', borderRadius: 12, fontSize: 22, fontWeight: 800, cursor: 'pointer',
              background: adjType === t.key ? (t.key === 'plus' ? '#EBFBEE' : '#FFF5F5') : '#F8F9FA',
              color: adjType === t.key ? (t.key === 'plus' ? '#2B8A3E' : '#E03131') : TEXT2,
              border: adjType === t.key ? `2px solid ${t.key === 'plus' ? '#2B8A3E' : '#E03131'}` : `1.5px solid ${BORDER}`,
            }}>{t.label} {t.desc}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Количество (шт.)</div>
          <input style={st.input} type="number" inputMode="numeric" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Заметка</div>
          <input style={st.input} placeholder="Необязательно" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div style={{ background: '#F8F9FA', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: TEXT2 }}>
          На складе: <b style={{ color: TEXT }}>{product.stock}</b> → будет: <b style={{ color: adjType === 'plus' ? '#2B8A3E' : '#E03131' }}>{Math.max(0, product.stock + (adjType === 'plus' ? 1 : -1) * (Number(qty) || 0))}</b>
        </div>
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed' } : {}, adjType === 'minus' ? { background: 'linear-gradient(135deg,#E03131,#C92A2A)' } : {}) }} disabled={dis || loading} onClick={handle}>
          {loading ? 'Сохраняю...' : `${adjType === 'plus' ? 'Добавить' : 'Списать'} ${qty || 0} шт.`}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function RemindersModal({ reminders, onAdd, onDelete, onClose }) {
  const [tab, setTab] = useState('list') // 'list' | 'add'
  const [text, setText] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)

  const sorted = [...reminders].sort((a, b) => {
    const da = new Date(`${a.date}T${a.time || '00:00'}`)
    const db = new Date(`${b.date}T${b.time || '00:00'}`)
    return da - db
  })
  const now = new Date()

  const handleAdd = () => {
    if (!text.trim() || !date) return
    setLoading(true)
    onAdd({ text: text.trim(), date, time })
    setText('')
    setTime('')
    setDate(new Date().toISOString().slice(0, 10))
    setLoading(false)
    setTab('list')
  }

  const formatDt = (r) => {
    const d = new Date(`${r.date}T${r.time || '00:00'}`)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + (r.time ? ` · ${r.time}` : '')
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={st.handle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Запланированные</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT2, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'list', l: 'Список' }, { k: 'add', l: '+ Добавить' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: '9px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: tab === t.k ? GRAD : '#F8F9FA',
              color: tab === t.k ? '#fff' : TEXT2,
              border: tab === t.k ? 'none' : `1.5px solid ${BORDER}`,
            }}>{t.l}</button>
          ))}
        </div>

        {tab === 'list' && (
          sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: TEXT2, fontSize: 14 }}>
              Нет запланированных действий
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(r => {
                const dt = new Date(`${r.date}T${r.time || '00:00'}`)
                const past = dt < now
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 12,
                    background: past ? '#F8F9FA' : '#F0FAE8',
                    border: `1px solid ${past ? BORDER : 'rgba(141,198,63,0.25)'}`,
                    opacity: past ? 0.6 : 1,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{r.text}</div>
                      <div style={{ fontSize: 11, color: past ? TEXT2 : CD, marginTop: 2, fontWeight: 600 }}>
                        {past ? '⏰ ' : '📅 '}{formatDt(r)}
                        {past && ' · прошло'}
                      </div>
                    </div>
                    <button onClick={() => onDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E03131', fontSize: 16, padding: '2px 4px', flexShrink: 0 }}>✕</button>
                  </div>
                )
              })}
            </div>
          )
        )}

        {tab === 'add' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Описание</div>
              <input
                style={st.input}
                placeholder="Что нужно сделать?"
                value={text}
                onChange={e => setText(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Дата</div>
                <input
                  style={st.input}
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Время</div>
                <input
                  style={st.input}
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  placeholder="Необязательно"
                />
              </div>
            </div>
            <button
              style={{ ...st.primaryBtn, ...(!text.trim() || !date ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }}
              disabled={!text.trim() || !date || loading}
              onClick={handleAdd}
            >
              Добавить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  input: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
  presetBtn: { padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${C}`, background: '#fff', color: CD, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  presetBtnReset: { padding: '7px 10px', borderRadius: 10, border: '1.5px solid #ddd', background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
}
