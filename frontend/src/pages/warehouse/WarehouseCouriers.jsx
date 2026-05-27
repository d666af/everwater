import { useEffect, useState, useCallback } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'
import {
  getWarehouseCourierStats, getProducts,
  getInvoiceUrl,
  getFactoryStats,
  getIssueBatches, cancelIssueBatch,
  adjustWarehouseCourierDebt,
} from '../../api'
import ReportModal from '../../components/warehouse/ReportModal'
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
  const [customDateTo, setCustomDateTo] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [couriers, setCouriers] = useState([])
  const [factories, setFactories] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [invoiceModal, setInvoiceModal] = useState(null) // { batchId, courierName }
  const [reportModal, setReportModal] = useState(null) // courier object
  const [cancelModal, setCancelModal] = useState(null) // { label } to show batches for
  const [debtAdjModal, setDebtAdjModal] = useState(null) // courier object for debt adjustment

  const load = () => {
    setLoading(true)
    const cd = period === 'custom' ? customDate : null
    const cdTo = period === 'custom' ? customDateTo : null
    Promise.all([
      getWarehouseCourierStats(period, cd, cdTo),
      getProducts(),
      getFactoryStats(period, cd, cdTo),
    ])
      .then(([cs, prods, fs]) => {
        setCouriers(cs)
        setCatalog((prods || []).filter(p => p.is_active !== false).map(p => ({ id: p.id, name: p.name })))
        setFactories(Array.isArray(fs) ? fs : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [period, customDate, customDateTo]) // eslint-disable-line

  const applyCustom = (start, end) => {
    setCustomDate(start)
    setCustomDateTo(end)
    setPeriod('custom')
  }

  const fmtDateStr = s => {
    if (!s) return ''
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const periodLabel = period === 'custom'
    ? (customDate
        ? (customDateTo && customDateTo !== customDate
            ? `${fmtDateStr(customDate)} – ${fmtDateStr(customDateTo)}`
            : fmtDateStr(customDate))
        : 'Дата')
    : 'Сегодня'

  const submitDebtAdj = async (courierId, delta, note) => {
    await adjustWarehouseCourierDebt(courierId, delta, note, actor, 'warehouse')
    load()
  }

  return (
    <Layout title={title}>
      {invoiceModal && (
        <InvoiceSuccessModal
          batchId={invoiceModal.batchId}
          courierName={invoiceModal.courierName}
          onClose={() => setInvoiceModal(null)}
        />
      )}
      {reportModal && (
        <ReportModal
          courierId={reportModal.id}
          courierName={reportModal.name}
          onClose={() => setReportModal(null)}
        />
      )}
      {cancelModal && (
        <CancelBatchModal
          label={cancelModal.label}
          onClose={() => { setCancelModal(null); load() }}
        />
      )}
      {debtAdjModal && (
        <DebtAdjustModal
          name={debtAdjModal.name}
          currentDebt={debtAdjModal.bottles_must_return || 0}
          onClose={() => setDebtAdjModal(null)}
          onSave={async (delta, note) => {
            await submitDebtAdj(debtAdjModal.id, delta, note)
            setDebtAdjModal(null)
          }}
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

      {/* Date filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => { setPeriod('today'); setCustomDate(null); setCustomDateTo(null) }}
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
      ) : (
        <>
          {/* "Другое" section */}
          {factories.filter(f => f.category === 'other' || f.name === 'НАХТ').length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>
                Другое · {periodLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {factories.filter(f => f.category === 'other' || f.name === 'НАХТ').map(f => (
                  <OtherCard
                    key={f.id}
                    f={f}
                    onReport={() => setReportModal(f)}
                    onDebtAdj={() => setDebtAdjModal(f)}
                    onCancel={() => setCancelModal({ label: f.name })}
                  />
                ))}
              </div>
            </>
          )}
          {/* Regular factories (Заводы) */}
          {factories.filter(f => !f.category && f.name !== 'НАХТ').length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9C36B5', textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>
                Заводы · {periodLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {factories.filter(f => !f.category && f.name !== 'НАХТ').map(f => (
                  <FactoryCard
                    key={f.id}
                    f={f}
                    onReport={() => setReportModal(f)}
                    onDebtAdj={() => setDebtAdjModal(f)}
                    onCancel={() => setCancelModal({ label: f.name })}
                  />
                ))}
              </div>
            </>
          )}
          {couriers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: TEXT2 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Нет активных курьеров</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 8px' }}>
                Курьеры · {periodLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {couriers.map(c => (
                  <CourierCard key={c.id} c={c} onReport={() => setReportModal(c)} onCancel={() => setCancelModal({ label: c.name })} onDebtAdj={() => setDebtAdjModal(c)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}

function CourierCard({ c, onReport, onCancel, onDebtAdj }) {
  const retBottles = c.bottles_returned_today || 0
  const mustBottles = c.bottles_must_return || 0
  const issuedProducts = Object.entries(c.issued_products || {}).filter(([, q]) => q > 0)

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Header: avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          {(c.vehicle_type || c.vehicle_plate) && (
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>
              {[c.vehicle_type, c.vehicle_plate].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Issued products + Bottles: side by side */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {/* Issued products */}
        <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Выдано</div>
          {issuedProducts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {issuedProducts.map(([name, qty]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: TEXT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 4, flex: 1 }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#E67700', flexShrink: 0 }}>{qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: TEXT2 }}>—</span>
          )}
        </div>

        {/* Bottles 19L */}
        <div style={{ flex: 0, flexBasis: 110, background: mustBottles > 0 ? '#EEF6FF' : '#F8F9FA', borderRadius: 12, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#1971C2', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Бут. 19л</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1971C2', lineHeight: 1 }}>{retBottles}</div>
              <div style={{ fontSize: 9, color: TEXT2, marginTop: 2 }}>вернул</div>
            </div>
            <div style={{ width: 1, height: 24, background: '#C0D8F0', alignSelf: 'center' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: mustBottles > 0 ? TEXT : TEXT2, lineHeight: 1 }}>{mustBottles}</div>
              <div style={{ fontSize: 9, color: TEXT2, marginTop: 2 }}>должен</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={onReport} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: `1px solid ${BORDER}`, background: '#FAFAFA', color: TEXT2,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Отчёт
        </button>
        <button onClick={onDebtAdj} style={{
          padding: '8px 10px', borderRadius: 10,
          border: '1px solid rgba(0,119,182,0.25)', background: '#E0F4FF', color: '#0077B6',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
          Долг
        </button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: '1px solid rgba(224,49,49,0.2)', background: '#FFF5F5', color: '#E03131',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Отменить выдачу
        </button>
      </div>
    </div>
  )
}

function FactoryCard({ f, onReport, onDebtAdj, onCancel }) {
  const PURP = '#9C36B5'
  const PURP_GRAD = 'linear-gradient(135deg, #B14CD0, #9C36B5)'
  const issuedProducts = Object.entries(f.issued || {}).filter(([, q]) => q > 0)
  const mustBottles = f.bottles_must_return || 0

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid rgba(156,54,181,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: PURP_GRAD, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M5 21V9l5 3V9l5 3V9l4 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
          <div style={{ fontSize: 11, color: PURP, marginTop: 1, fontWeight: 600 }}>Завод</div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Выдано</div>
          {issuedProducts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {issuedProducts.map(([name, qty]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: TEXT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 4, flex: 1 }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: PURP, flexShrink: 0 }}>{qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: TEXT2 }}>—</span>
          )}
        </div>
        <div style={{ flex: 0, flexBasis: 90, background: mustBottles > 0 ? '#F8EBFC' : '#F8F9FA', borderRadius: 12, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: PURP, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Бут. 19л</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: mustBottles > 0 ? TEXT : TEXT2, lineHeight: 1 }}>{mustBottles}</div>
            <div style={{ fontSize: 9, color: TEXT2, marginTop: 2 }}>должен</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={onReport} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: `1px solid ${BORDER}`, background: '#FAFAFA', color: TEXT2,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Отчёт
        </button>
        <button onClick={onDebtAdj} style={{
          padding: '8px 10px', borderRadius: 10,
          border: `1px solid rgba(156,54,181,0.25)`, background: '#F8EBFC', color: PURP,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
          Долг
        </button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: '1px solid rgba(224,49,49,0.2)', background: '#FFF5F5', color: '#E03131',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Отменить выдачу
        </button>
      </div>
    </div>
  )
}

function OtherCard({ f, onReport, onDebtAdj, onCancel }) {
  const TEAL = '#0077B6'
  const TEAL_GRAD = 'linear-gradient(135deg, #0096C7, #0077B6)'
  const issuedProducts = Object.entries(f.issued || {}).filter(([, q]) => q > 0)
  const mustBottles = f.bottles_must_return || 0

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid rgba(0,119,182,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: TEAL_GRAD, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
          <div style={{ fontSize: 11, color: TEAL, marginTop: 1, fontWeight: 600 }}>Другое</div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: '#FAFAFA', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Выдано</div>
          {issuedProducts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {issuedProducts.map(([name, qty]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: TEXT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 4, flex: 1 }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: TEAL, flexShrink: 0 }}>{qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: TEXT2 }}>—</span>
          )}
        </div>
        <div style={{ flex: 0, flexBasis: 90, background: mustBottles > 0 ? '#E0F4FF' : '#F8F9FA', borderRadius: 12, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Бут. 19л</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: mustBottles > 0 ? TEXT : TEXT2, lineHeight: 1 }}>{mustBottles}</div>
            <div style={{ fontSize: 9, color: TEXT2, marginTop: 2 }}>должен</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={onReport} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: `1px solid ${BORDER}`, background: '#FAFAFA', color: TEXT2,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Отчёт
        </button>
        <button onClick={onDebtAdj} style={{
          padding: '8px 10px', borderRadius: 10,
          border: `1px solid rgba(0,119,182,0.25)`, background: '#E0F4FF', color: TEAL,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
          Долг
        </button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '8px 12px', borderRadius: 10,
          border: '1px solid rgba(224,49,49,0.2)', background: '#FFF5F5', color: '#E03131',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Отменить выдачу
        </button>
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

function CancelBatchModal({ label, onClose }) {
  const [batches, setBatches] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(() => {
    getIssueBatches(undefined, true, 200).then(all => {
      if (!label) { setBatches(all); return }
      setBatches((all || []).filter(b => (b.courier_name || '').toLowerCase() === label.toLowerCase() || (b.factory_name || '').toLowerCase() === label.toLowerCase()))
    }).catch(() => setBatches([]))
  }, [label])

  useEffect(() => { load() }, [load])

  const doCancel = async (batchId) => {
    setCancelling(batchId)
    try {
      await cancelIssueBatch(batchId)
      load()
    } finally {
      setCancelling(null)
    }
  }

  const fmtDate = s => {
    if (!s) return '—'
    return new Date(s).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={st.handle} />
        <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>Отменить выдачу</div>
        {label && <div style={{ fontSize: 13, color: TEXT2, marginTop: -8 }}>{label}</div>}
        {batches === null ? (
          <div style={{ textAlign: 'center', padding: 30, color: TEXT2 }}>Загрузка...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: TEXT2, fontSize: 14 }}>Нет выдач для отмены</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {batches.map(b => (
              <div key={b.batch_id} style={{ background: '#FAFAFA', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{b.courier_name}</div>
                    {b.batch_type === 'factory' && (
                      <div style={{ fontSize: 11, color: '#9C36B5', fontWeight: 600 }}>Завод</div>
                    )}
                    <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{fmtDate(b.created_at)}</div>
                    <div style={{ marginTop: 6 }}>
                      {(b.items || []).map((it, i) => (
                        <div key={i} style={{ fontSize: 12, color: TEXT }}>{it.product_name}: <b>{it.quantity}</b> шт.</div>
                      ))}
                    </div>
                    {b.total_sum > 0 && (
                      <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>{b.total_sum.toLocaleString()} сум</div>
                    )}
                  </div>
                  <button
                    disabled={cancelling === b.batch_id}
                    onClick={() => doCancel(b.batch_id)}
                    style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(224,49,49,0.3)', background: '#FFF5F5', color: '#E03131', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: cancelling === b.batch_id ? 0.6 : 1 }}
                  >
                    {cancelling === b.batch_id ? '...' : 'Отменить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

function DebtAdjustModal({ name, currentDebt, onClose, onSave }) {
  const [delta, setDelta] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    if (delta === 0) return
    setError('')
    setLoading(true)
    try {
      await onSave(delta, note.trim() || null)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Ошибка')
      setLoading(false)
    }
  }

  const stepBtn = (base = {}) => ({
    width: 36, height: 36, borderRadius: 10, fontSize: 20, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none',
    ...base,
  })

  const preview = currentDebt + delta

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, gap: 12 }}>
        <div style={st.handle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>Изменить долг бутылок</div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: TEXT2, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: TEXT2 }}>
          Курьер: <b style={{ color: TEXT }}>{name}</b> · текущий долг: <b style={{ color: currentDebt > 0 ? '#E03131' : TEXT }}>{currentDebt} бут.</b>
        </div>

        <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Изменение</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => setDelta(d => d - 1)} style={stepBtn({ background: '#FFF5F5', border: '1.5px solid rgba(224,49,49,0.2)', color: '#E03131', fontSize: 22 })}>−</button>
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: delta > 0 ? '#E03131' : delta < 0 ? '#2B8A3E' : TEXT2, lineHeight: 1 }}>
                {delta > 0 ? `+${delta}` : delta}
              </div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>бут.</div>
            </div>
            <button onClick={() => setDelta(d => d + 1)} style={stepBtn({ background: '#FFF5F5', border: '1.5px solid rgba(224,49,49,0.2)', color: '#E03131', fontSize: 22 })}>+</button>
          </div>
          {delta !== 0 && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: TEXT2 }}>
              Будет: <b style={{ color: preview > 0 ? '#E03131' : '#2B8A3E' }}>{preview} бут.</b>
            </div>
          )}
        </div>

        <input
          style={{ ...st.input }}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Причина (необязательно)"
        />

        {error && <div style={{ padding: '8px 12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FFB4B4', fontSize: 12, color: '#C92A2A', fontWeight: 600 }}>{error}</div>}

        <button
          style={{ ...st.primaryBtn, background: 'linear-gradient(135deg, #E03131, #C92A2A)', boxShadow: '0 4px 14px rgba(224,49,49,0.3)', ...(delta === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}), padding: 14 }}
          disabled={delta === 0 || loading}
          onClick={handle}
        >
          {loading ? 'Сохраняю...' : 'Применить изменение'}
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
