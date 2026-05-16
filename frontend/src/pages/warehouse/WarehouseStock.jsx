import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import DateTimePickerModal, { toISODate } from '../../components/warehouse/DateTimePickerModal'
import { getWarehouseOverview, addProduction, getSubscriptionsByPeriod, getProductionPlan, getProducts, issueBatchToCourier, adjustStock, getAdminCouriers, getInvoiceUrl } from '../../api'
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

export default function WarehouseStock({ Layout = WarehouseLayout, title = 'Склад' }) {
  const subsEnabled = useSubscriptionsEnabled()
  const { user } = useAuthStore()
  const actor = user?.name || null
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [overview, setOverview] = useState(null)
  const [subs, setSubs] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [couriers, setCouriers] = useState([])
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [invoiceModal, setInvoiceModal] = useState(null) // { batchId, courierName }

  const load = () => {
    setLoading(true)
    const cd = period === 'custom' ? customDate : null
    const cdTo = period === 'custom' ? customDateTo : null
    Promise.all([
      getWarehouseOverview(period, cd, null, null, cdTo),
      getSubscriptionsByPeriod(period, cd),
      getProductionPlan(),
    ])
      .then(([ov, sb, pl]) => { setOverview(ov); setSubs(sb); setPlan(pl) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [period, customDate, customDateTo]) // eslint-disable-line
  useEffect(() => { getAdminCouriers().then(cs => setCouriers(cs.filter(c => c.is_active))).catch(console.error) }, [])

  const applyCustom = (start, end) => {
    setCustomDate(start)
    setCustomDateTo(end)
    setPeriod('custom')
  }

  const fmtDate = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString()

  const periodLabel = period === 'custom'
    ? (customDate
        ? (customDateTo && !sameDay(customDate, customDateTo)
            ? `${fmtDate(customDate)} – ${fmtDate(customDateTo)}`
            : fmtDate(customDate))
        : 'Дата')
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
      {showIssue && <IssueToCourierModal couriers={couriers} onClose={() => setShowIssue(false)} onSave={async (courierId, courierName, items, bottleReturn, vt, vp) => {
        const res = await issueBatchToCourier(courierId, items, actor, vt, vp, null, bottleReturn)
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
          initialDateTo={customDateTo}
          onApply={applyCustom}
          onClose={() => setPickerOpen(false)}
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
        <div style={{ flex: 1 }}><SegGroup options={QUICK} value={period} onChange={setPeriod} /></div>
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
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 10px', borderRadius: 14, border: 'none',
          background: GRAD, color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)',
        }} onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
          Производство
        </button>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 10px', borderRadius: 14, border: `1.5px solid ${C}`,
          background: '#fff', color: CD, fontSize: 15, fontWeight: 700,
          cursor: 'pointer',
        }} onClick={() => setShowIssue(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke={CD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Выдать курьеру
        </button>
      </div>

      {/* Summary totals */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px 10px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <TotalStat value={totals.stock} label="На складе" color={C} />
          <TotalStat value={totals.bottle_returns_period ?? 0} label="Вернули" color="#1971C2" />
          <TotalStat value={totals.on_couriers} label="Осталось" color={TEXT} />
        </div>
      </div>

      {/* Section title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Продукция</span>
        <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
      </div>

      {/* Product list — 1 per row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: TEXT2, fontSize: 14 }}>Каталог пуст</div>
        ) : products.map(p => <ProductCard key={p.key} p={p} onAdjust={() => setAdjustProduct(p)} />)}
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

function ProductCard({ p, onAdjust }) {
  const isShort = p.shortfall > 0
  const isLow = p.stock <= 10 && p.stock > 0
  const stockColor = isLow || isShort ? '#E03131' : C
  const hasSecondary = p.produced_period > 0 || p.issued_period > 0

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      border: `1.5px solid ${isShort ? '#FFB4B4' : BORDER}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Left: name + shortfall badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>{p.product_name}</div>
          {isShort && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 8px', background: '#FFE8E8', borderRadius: 6 }}>
              <span style={{ fontSize: 11, color: '#C92A2A', fontWeight: 700 }}>Не хватает: {p.shortfall}</span>
            </div>
          )}
        </div>
        {/* Right: big stock number + adjust icon */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: stockColor, lineHeight: 1 }}>{p.stock}</div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>на складе</div>
          </div>
          <button onClick={onAdjust} style={{
            background: '#F8F9FA', border: 'none', width: 30, height: 30, borderRadius: 8,
            cursor: 'pointer', color: TEXT2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {hasSecondary && (
        <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
          {p.produced_period > 0 && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: TEXT2 }}>Произведено: </span>
              <span style={{ fontWeight: 700, color: '#2B8A3E' }}>{p.produced_period} шт.</span>
            </div>
          )}
          {p.issued_period > 0 && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: TEXT2 }}>Выдано: </span>
              <span style={{ fontWeight: 700, color: '#E67700' }}>{p.issued_period} шт.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddProductionModal({ onClose, onSave, products: propProducts }) {
  const catalog = (propProducts || getCatalogProducts()).map(p => ({
    id: p.id ?? p.product_id,
    short_name: p.short_name ?? p.product_name,
  }))
  const [quantities, setQuantities] = useState({})
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  // Only one product at a time — setting non-zero qty clears others
  const setQty = (id, val) => {
    const n = Math.max(0, Number(val) || 0)
    setQuantities(n > 0 ? { [id]: n } : prev => ({ ...prev, [id]: 0 }))
  }

  const activeItem = catalog.find(p => (quantities[p.id] || 0) > 0)
  const dis = !activeItem

  const handle = async () => {
    if (!activeItem) return
    setLoading(true)
    try { await onSave(activeItem.id, quantities[activeItem.id], note.trim(), activeItem.short_name); onClose() }
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {catalog.map(p => {
              const q = quantities[p.id] || 0
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12,
                  background: q > 0 ? '#F0FAE8' : '#F8F9FA',
                  border: `1.5px solid ${q > 0 ? C : BORDER}`,
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{p.short_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setQty(p.id, q - 1)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: TEXT2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >−</button>
                    <input
                      type="number" inputMode="numeric" min="0" value={q || ''} placeholder="0"
                      onChange={e => setQty(p.id, e.target.value)}
                      style={{ width: 64, height: 36, borderRadius: 10, border: `1.5px solid ${q > 0 ? C : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: q > 0 ? CD : TEXT2, textAlign: 'center', outline: 'none', padding: 0 }}
                    />
                    <button onClick={() => setQty(p.id, q + 1)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C}`, background: q > 0 ? GRAD : '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: q > 0 ? '#fff' : CD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Заметка</div>
          <input style={st.input} placeholder="Необязательно" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={dis || loading} onClick={handle}>
          {loading ? 'Записываю...' : `Добавить ${activeItem ? quantities[activeItem.id] : 0} шт.`}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function IssueToCourierModal({ couriers, onClose, onSave }) {
  const [courierId, setCourierId] = useState(couriers[0]?.id || null)
  const [catalog, setCatalog] = useState([])
  const [quantities, setQuantities] = useState({})
  const [bottleReturn, setBottleReturn] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const courier = couriers.find(c => c.id === courierId)

  useEffect(() => {
    getProducts().then(ps => {
      const list = (ps || []).filter(p => p.is_active !== false).map(p => ({ id: p.id, name: p.name }))
      setCatalog(list)
    }).catch(console.error)
  }, []) // eslint-disable-line

  useEffect(() => {
    setVehicleType(courier?.vehicle_type || '')
    setVehiclePlate(courier?.vehicle_plate || '')
  }, [courierId]) // eslint-disable-line

  const setQty = (id, val) => setQuantities(prev => ({ ...prev, [id]: Math.max(0, Number(val) || 0) }))

  const batchItems = catalog
    .filter(p => (quantities[p.id] || 0) > 0)
    .map(p => ({ product_name: p.name, quantity: quantities[p.id] }))

  const parsedReturn = Math.max(0, Number(bottleReturn) || 0)
  const dis = batchItems.length === 0 && parsedReturn === 0

  const handle = async () => {
    if (dis) return
    setError('')
    setLoading(true)
    try {
      await onSave(
        courierId,
        courier?.name || '',
        batchItems,
        parsedReturn,
        vehicleType.trim() || null,
        vehiclePlate.trim() || null,
      )
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Ошибка при выдаче')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, maxHeight: '90vh', overflowY: 'auto' }}>
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

          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Продукты</div>
          {catalog.length === 0 ? (
            <div style={{ fontSize: 12, color: TEXT2, padding: '4px 0' }}>Загрузка…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {catalog.map(p => {
                const q = quantities[p.id] || 0
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 12,
                    background: q > 0 ? '#F0FAE8' : '#F8F9FA',
                    border: `1.5px solid ${q > 0 ? C : BORDER}`,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => setQty(p.id, q - 1)}
                        style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: TEXT2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >−</button>
                      <input
                        type="number" inputMode="numeric" min="0" value={q || ''}
                        placeholder="0"
                        onChange={e => setQty(p.id, e.target.value)}
                        style={{ width: 64, height: 36, borderRadius: 10, border: `1.5px solid ${q > 0 ? C : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: q > 0 ? CD : TEXT2, textAlign: 'center', outline: 'none', padding: 0 }}
                      />
                      <button
                        onClick={() => setQty(p.id, q + 1)}
                        style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C}`, background: q > 0 ? GRAD : '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: q > 0 ? '#fff' : CD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Возврат бутылок</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12,
            background: parsedReturn > 0 ? '#EBF4FF' : '#F8F9FA',
            border: `1.5px solid ${parsedReturn > 0 ? '#4DA6FF' : BORDER}`,
            transition: 'background 0.15s, border-color 0.15s',
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>Бутылок</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button onClick={() => setBottleReturn(String(Math.max(0, parsedReturn - 1)))}
                style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: TEXT2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >−</button>
              <input
                type="number" inputMode="numeric" min="0" value={parsedReturn || ''} placeholder="0"
                onChange={e => setBottleReturn(String(Math.max(0, Number(e.target.value) || 0)))}
                style={{ width: 64, height: 36, borderRadius: 10, border: `1.5px solid ${parsedReturn > 0 ? '#4DA6FF' : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: parsedReturn > 0 ? '#1971C2' : TEXT2, textAlign: 'center', outline: 'none', padding: 0 }}
              />
              <button onClick={() => setBottleReturn(String(parsedReturn + 1))}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #4DA6FF', background: parsedReturn > 0 ? '#4DA6FF' : '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: parsedReturn > 0 ? '#fff' : '#4DA6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >+</button>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Транспорт</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...st.input, flex: 1 }} value={vehicleType} onChange={e => { setVehicleType(e.target.value); setError('') }} placeholder="Тип машины" />
            <input style={{ ...st.input, flex: 1 }} value={vehiclePlate} onChange={e => { setVehiclePlate(e.target.value.toUpperCase()); setError('') }} placeholder="Госномер" />
          </div>
        </div>
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FFB4B4', fontSize: 13, color: '#C92A2A', fontWeight: 600 }}>{error}</div>
        )}
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed' } : {}) }} disabled={dis || loading} onClick={handle}>
          {loading ? 'Выдаю...' : 'Выдать'}
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
        <a href={url} target="_blank" rel="noopener noreferrer"
           style={{ padding: 16, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' }}>
          Посмотреть накладную
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

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  input: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
  presetBtn: { padding: '7px 12px', borderRadius: 10, border: `1.5px solid ${C}`, background: '#fff', color: CD, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  presetBtnReset: { padding: '7px 10px', borderRadius: 10, border: '1.5px solid #ddd', background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
}
