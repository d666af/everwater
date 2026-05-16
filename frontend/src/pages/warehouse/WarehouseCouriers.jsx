import { useEffect, useState } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'
import {
  getWarehouseCourierStats, getProducts,
  issueBatchToCourier, getInvoiceUrl,
} from '../../api'
import { useAuthStore } from '../../store/auth'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

export default function WarehouseCouriers({ Layout = WarehouseLayout, title = 'Курьеры' }) {
  const { user } = useAuthStore()
  const actor = user?.name || null

  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [couriers, setCouriers] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [issueModal, setIssueModal] = useState(null) // courier object
  const [invoiceModal, setInvoiceModal] = useState(null) // { batchId, courierName }

  const load = () => {
    setLoading(true)
    const cd = period === 'custom' ? customDate : null
    Promise.all([
      getWarehouseCourierStats(period, cd),
      getProducts(),
    ])
      .then(([cs, prods]) => {
        setCouriers(cs)
        setCatalog((prods || []).filter(p => p.is_active !== false).map(p => ({ id: p.id, name: p.name })))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [period, customDate]) // eslint-disable-line

  const applyCustom = (start) => {
    setCustomDate(start)
    setPeriod('custom')
  }

  const fmtDateStr = s => {
    if (!s) return ''
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const periodLabel = period === 'custom' && customDate ? fmtDateStr(customDate) : 'Сегодня'

  const issueBatch = async (courierId, courierName, items, bottleReturn, vehicleType, vehiclePlate) => {
    const res = await issueBatchToCourier(courierId, items, actor, vehicleType, vehiclePlate, null, bottleReturn)
    if (res?.batch_id) setInvoiceModal({ batchId: res.batch_id, courierName })
    load()
  }

  return (
    <Layout title={title}>
      {issueModal && (
        <CourierIssueModal
          courier={issueModal}
          catalog={catalog}
          onClose={() => setIssueModal(null)}
          onSave={async (items, bottleReturn, vt, vp) => {
            await issueBatch(issueModal.id, issueModal.name, items, bottleReturn, vt, vp)
            setIssueModal(null)
          }}
        />
      )}
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
          initialDateTo={null}
          onApply={(start) => applyCustom(start)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Date filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => { setPeriod('today'); setCustomDate(null) }}
          style={{
            flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
            background: period === 'today' ? GRAD : '#fff',
            color: period === 'today' ? '#fff' : TEXT2,
            border: period === 'today' ? 'none' : `1.5px solid ${BORDER}`,
            fontSize: 12, fontWeight: 700,
          }}>
          Сегодня
        </button>
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid rgba(141,198,63,0.2)`, borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: TEXT2 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Нет активных курьеров</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>
            Курьеры · {periodLabel}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {couriers.map(c => (
              <CourierCard key={c.id} c={c} onIssue={() => setIssueModal(c)} />
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}

function CourierCard({ c, onIssue }) {
  const issuedCount = c.issued_today || 0
  const retBottles = c.bottles_returned_today || 0
  const mustBottles = c.bottles_must_return || 0

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          {(c.vehicle_type || c.vehicle_plate) && (
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>
              {[c.vehicle_type, c.vehicle_plate].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <button
          onClick={onIssue}
          style={{
            flexShrink: 0, padding: '9px 14px', borderRadius: 12, border: 'none',
            background: GRAD, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M14 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Выдать
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {/* Issued */}
        <div style={{ flex: 1, background: issuedCount > 0 ? '#FFF8F0' : '#F8F9FA', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: issuedCount > 0 ? '#E67700' : TEXT2, lineHeight: 1 }}>{issuedCount}</div>
          <div style={{ fontSize: 10, color: TEXT2, marginTop: 3, fontWeight: 600 }}>Выдано, шт.</div>
        </div>
        {/* Bottles */}
        <div style={{ flex: 2, background: mustBottles > 0 ? '#EEF6FF' : '#F8F9FA', borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1971C2', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Бутылки 19л</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1971C2', lineHeight: 1 }}>{retBottles}</div>
              <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>вернул</div>
            </div>
            <div style={{ width: 1, height: 28, background: mustBottles > 0 ? '#C0D8F0' : BORDER, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{mustBottles}</div>
              <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>должен</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CourierIssueModal({ courier, catalog, onClose, onSave }) {
  const [quantities, setQuantities] = useState({})
  const [bottleReturn, setBottleReturn] = useState('')
  const [vehicleType, setVehicleType] = useState(courier?.vehicle_type || '')
  const [vehiclePlate, setVehiclePlate] = useState(courier?.vehicle_plate || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      await onSave(batchItems, parsedReturn, vehicleType.trim() || null, vehiclePlate.trim() || null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Ошибка при выдаче')
      setLoading(false)
    }
  }

  const stepBtn = (base = {}) => ({
    width: 34, height: 34, borderRadius: 9, fontSize: 18, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none',
    ...base,
  })

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        ...st.sheet, padding: 0, gap: 0,
        maxHeight: 'min(96dvh, 96vh)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Fixed header */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={st.handle} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Выдать курьеру</div>
            <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: TEXT2, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: TEXT2, marginBottom: 10 }}>
            Курьер: <b style={{ color: TEXT }}>{courier.name}</b>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Продукты</div>
        </div>

        {/* Scrollable products */}
        <div style={{ overflowY: 'auto', padding: '0 16px', maxHeight: 'calc(min(96dvh, 96vh) - 280px)', flexShrink: 0 }}>
          {catalog.length === 0 ? (
            <div style={{ fontSize: 12, color: TEXT2, padding: '8px 0' }}>Загрузка…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {catalog.map(p => {
                const q = quantities[p.id] || 0
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 12,
                    background: q > 0 ? '#F0FAE8' : '#F8F9FA',
                    border: `1.5px solid ${q > 0 ? C : BORDER}`,
                  }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT, lineHeight: 1.2 }}>{p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <button onClick={() => setQty(p.id, q - 1)}
                        style={stepBtn({ background: '#fff', border: `1.5px solid ${BORDER}`, color: TEXT2 })}
                      >−</button>
                      <input type="number" inputMode="numeric" min="0" value={q || ''} placeholder="0"
                        onChange={e => setQty(p.id, e.target.value)}
                        style={{ width: 52, height: 34, borderRadius: 9, border: `1.5px solid ${q > 0 ? C : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: q > 0 ? CD : TEXT2, textAlign: 'center', outline: 'none', padding: 0 }}
                      />
                      <button onClick={() => setQty(p.id, q + 1)}
                        style={stepBtn({ background: q > 0 ? GRAD : '#fff', border: `1.5px solid ${C}`, color: q > 0 ? '#fff' : CD })}
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Fixed footer */}
        <div style={{ padding: '8px 16px 28px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Bottle return section */}
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Возврат · Бутылки 19л</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 12,
            background: parsedReturn > 0 ? '#EBF4FF' : '#F8F9FA',
            border: `1.5px solid ${parsedReturn > 0 ? '#4DA6FF' : BORDER}`,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: parsedReturn > 0 ? '#1971C2' : TEXT2 }}>Бутылки 19л</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <button onClick={() => setBottleReturn(String(Math.max(0, parsedReturn - 1)))}
                style={stepBtn({ background: '#fff', border: `1.5px solid ${BORDER}`, color: TEXT2 })}
              >−</button>
              <input type="number" inputMode="numeric" min="0" value={parsedReturn || ''} placeholder="0"
                onChange={e => setBottleReturn(String(Math.max(0, Number(e.target.value) || 0)))}
                style={{ width: 52, height: 34, borderRadius: 9, border: `1.5px solid ${parsedReturn > 0 ? '#4DA6FF' : BORDER}`, background: '#fff', fontSize: 16, fontWeight: 700, color: parsedReturn > 0 ? '#1971C2' : TEXT2, textAlign: 'center', outline: 'none', padding: 0 }}
              />
              <button onClick={() => setBottleReturn(String(parsedReturn + 1))}
                style={stepBtn({ background: parsedReturn > 0 ? '#4DA6FF' : '#fff', border: '1.5px solid #4DA6FF', color: parsedReturn > 0 ? '#fff' : '#4DA6FF' })}
              >+</button>
            </div>
          </div>
          {/* Transport */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={{ ...st.input, flex: 1 }} value={vehicleType} onChange={e => { setVehicleType(e.target.value); setError('') }} placeholder="Тип машины" />
            <input style={{ ...st.input, flex: 1 }} value={vehiclePlate} onChange={e => { setVehiclePlate(e.target.value.toUpperCase()); setError('') }} placeholder="Госномер" />
          </div>
          {error && <div style={{ padding: '8px 12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FFB4B4', fontSize: 12, color: '#C92A2A', fontWeight: 600 }}>{error}</div>}
          <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed' } : {}), padding: 14 }} disabled={dis || loading} onClick={handle}>
            {loading ? 'Выдаю...' : 'Выдать'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InvoiceSuccessModal({ batchId, courierName, onClose }) {
  const url = getInvoiceUrl(batchId)
  const openInBot = () => {
    if (window.Telegram?.WebApp?.close) {
      window.Telegram.WebApp.close()
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
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
          Накладная отправлена в Telegram
        </div>
        <div style={{ background: '#F8F9FA', borderRadius: 12, padding: 8 }}>
          <img src={url} alt="накладная" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
        </div>
        <button onClick={openInBot}
          style={{ padding: 16, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' }}>
          Посмотреть в боте
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  input: { border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '13px 12px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
}
