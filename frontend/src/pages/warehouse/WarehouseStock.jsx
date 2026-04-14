import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { getWarehouseOverview, addProduction, getSubscriptionsByPeriod, getProductionPlan } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PRODUCTS = ['Вода 20л', 'Вода 10л', 'Вода 5л', 'Вода 1.5л', 'Вода 1л', 'Вода 0.5л', 'Газ. вода 1.5л', 'Газ. вода 1л', 'Газ. вода 0.5л']

const PERIODS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'tomorrow', label: 'Завтра' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'week', label: 'Неделя' },
  { key: 'custom', label: 'Дата' },
]

export default function WarehouseStock() {
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState('')
  const [overview, setOverview] = useState(null)
  const [subs, setSubs] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    const cd = period === 'custom' && customDate ? new Date(customDate) : null
    Promise.all([
      getWarehouseOverview(period, cd),
      getSubscriptionsByPeriod(period, cd),
      getProductionPlan(),
    ])
      .then(([ov, sb, pl]) => { setOverview(ov); setSubs(sb); setPlan(pl) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [period, customDate]) // eslint-disable-line

  if (loading && !overview) {
    return (
      <WarehouseLayout title="Склад">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      </WarehouseLayout>
    )
  }

  const products = overview?.products || []
  const totals = overview?.totals || {}
  const shortfallItems = overview?.shortfall_items || []
  const lowStockProducts = products.filter(p => p.stock <= 10 && p.stock > 0)

  return (
    <WarehouseLayout title="Склад">
      {showAdd && <AddProductionModal onClose={() => setShowAdd(false)} onSave={async (name, qty, note) => { await addProduction(name, qty, note); load() }} />}

      {/* Shortfall alert — shows exact items with volumes */}
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
      <div style={{ display: 'flex', gap: 6, marginBottom: period === 'custom' ? 8 : 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
          fontSize: 14, marginBottom: 12, outline: 'none', background: '#fff', color: TEXT, boxSizing: 'border-box',
        }} />
      )}

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

      {/* Stock block header + totals math */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Остатки по продуктам</span>
      </div>

      {/* Totals math explanation */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: C }}>{totals.stock}</span>
            <span style={{ fontSize: 12, color: TEXT2 }}>на складе</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: TEXT2 }}>+</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1971C2' }}>{totals.on_couriers}</span>
            <span style={{ fontSize: 12, color: TEXT2 }}>у курьеров</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: TEXT2 }}>=</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{totals.total}</span>
            <span style={{ fontSize: 12, color: TEXT2 }}>всего</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: TEXT2, marginTop: 6, textAlign: 'center' }}>
          Показатели складываются отдельно друг от друга
        </div>
      </div>

      {/* 2-column product grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {products.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 30, color: TEXT2, fontSize: 14 }}>Нет товаров на складе</div>
        ) : products.map(p => <ProductCard key={p.product_name} p={p} period={period} />)}
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

      {/* Subscriptions — filtered by period */}
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>
        Подписки клиентов · {PERIODS.find(p => p.key === period)?.label?.toLowerCase() || ''}
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
              {subs.subscriptions.map(s => (
                <div key={`${s.user_id}-${s.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{s.plan}</div>
                    <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{s.day} · {s.time}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: CD }}>{s.total_qty} шт.</div>
                    {s.occurrences > 1 && <div style={{ fontSize: 10, color: TEXT2 }}>×{s.occurrences}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </WarehouseLayout>
  )
}

function ProductCard({ p, period }) {
  const isShort = p.shortfall > 0
  const isLow = p.stock <= 10
  const needLabel = period === 'yesterday' ? 'Нужно было' : period === 'week' ? 'Нужно за неделю' : 'К выдаче'
  const delivLabel = period === 'today' ? 'Доставлено' : period === 'yesterday' ? 'Доставлено' : 'Доставлено'

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: isShort ? '1.5px solid #FFB4B4' : '1.5px solid transparent' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6, minHeight: 30, lineHeight: 1.2 }}>{p.product_name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: isLow ? '#E03131' : (isShort ? '#E03131' : C), lineHeight: 1 }}>{p.stock}</span>
        <span style={{ fontSize: 11, color: TEXT2 }}>на складе</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
        <Row label="У курьеров" value={p.on_couriers} color="#1971C2" />
        <Row label="Всего" value={p.total} color={TEXT} bold />
        <div style={{ height: 4 }} />
        {p.needed_period > 0 && <Row label={needLabel} value={p.needed_period} color="#E67700" />}
        {p.delivered_period > 0 && <Row label={delivLabel} value={p.delivered_period} color="#2B8A3E" />}
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

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, color: TEXT2 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: bold ? 800 : 700, color }}>{value}</span>
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
