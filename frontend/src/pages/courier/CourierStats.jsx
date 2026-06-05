import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats, getCourierWater, getCourierReport } from '../../api'
import { useAuthStore } from '../../store/auth'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'

const tg = window.Telegram?.WebApp

const C      = '#8DC63F'
const CD     = '#6CA32F'
const GRAD   = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT   = '#1C1C1E'
const TEXT2  = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const toLocalISO = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

// For "today" always use UTC date — matches backend's datetime.utcnow() used in warehouse
const todayUTC = () => new Date().toISOString().slice(0, 10)

function fmtDateStr(s) {
  if (!s) return ''
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m100 >= 11 && m100 <= 19) return many
  if (m10 === 1) return one
  if (m10 >= 2 && m10 <= 4) return few
  return many
}

function ratingMsg(r) {
  if (r >= 4.8) return 'Превосходный результат'
  if (r >= 4.5) return 'Отличный результат'
  if (r >= 4.0) return 'Хороший рейтинг'
  if (r >= 3.0) return 'Есть куда расти'
  return 'Старайтесь работать лучше'
}

function Spinner() {
  return <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function CourierStats() {
  const [stats, setStats]               = useState(null)
  const [water, setWater]               = useState({})
  const [report, setReport]             = useState(null)
  const [loading, setLoading]           = useState(true)
  const [reportLoading, setReportLoad]  = useState(false)
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [period, setPeriod]             = useState('today')
  const [customDate, setCustomDate]     = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [payFilter, setPayFilter]       = useState('all')
  const { user } = useAuthStore()

  const courierId = tg?.initDataUnsafe?.user?.id || user?.telegram_id || user?.id

  useEffect(() => {
    if (!courierId) { setLoading(false); return }
    Promise.allSettled([getCourierStats(courierId), getCourierWater(courierId)])
      .then(([st, w]) => {
        if (st.status === 'fulfilled') setStats(st.value)
        if (w.status === 'fulfilled')  setWater(w.value || {})
        setLoading(false)
      })
  }, [courierId]) // eslint-disable-line

  const { dateFrom, dateTo } = (() => {
    if (period === 'today') {
      const t = todayUTC()
      return { dateFrom: t, dateTo: t }
    }
    return { dateFrom: customDate || todayUTC(), dateTo: customDateTo || customDate || todayUTC() }
  })()

  const loadReport = useCallback((dbId, from, to) => {
    if (!dbId) return
    setReportLoad(true)
    getCourierReport(dbId, from, to)
      .then(r => setReport(r))
      .catch(() => setReport(null))
      .finally(() => setReportLoad(false))
  }, [])

  useEffect(() => {
    if (stats?.courier_id) loadReport(stats.courier_id, dateFrom, dateTo)
  }, [stats?.courier_id, dateFrom, dateTo]) // eslint-disable-line

  const applyCustom = (start, end) => { setCustomDate(start); setCustomDateTo(end); setPeriod('custom') }

  const periodLabel = period === 'custom'
    ? (customDate
        ? (customDateTo && customDateTo !== customDate
            ? `${fmtDateStr(customDate)} – ${fmtDateStr(customDateTo)}`
            : fmtDateStr(customDate))
        : 'Дата')
    : 'Сегодня'

  const deliveryRows  = (report?.orders || []).filter(o => payFilter === 'all' || o.payment_method === payFilter)
  const deliveryTotal = deliveryRows.reduce((s, o) => s + (o.total || 0), 0)
  const deliveryItemTotals = deliveryRows.reduce((acc, o) => {
    (o.items || []).forEach(it => { acc[it.name] = (acc[it.name] || 0) + it.quantity })
    return acc
  }, {})
  const totalReturnedFromClients = deliveryRows.reduce((s, o) => s + (o.return_bottles || 0), 0)
  const totalBonusUsed = deliveryRows.reduce((s, o) => s + (o.bonus_used || 0), 0)
  const bottleSurcharge = report?.bottle_surcharge || 0
  const unreturnedInPeriod = Math.max(0, (report?.total_bottles_19l_delivered || 0) - (report?.total_bottles_returned || 0))
  const unreturnedPeriodValue = Math.round(unreturnedInPeriod * bottleSurcharge)

  const reservedItems = (stats?.reserved_items || []).filter(i => (i.reserved || 0) > 0 || (i.available || 0) > 0)
  const hasReserved   = reservedItems.some(i => i.reserved > 0)

  const waterEntries  = Object.entries(water).filter(([, v]) => v > 0)
  const waterTotal    = waterEntries.reduce((s, [, v]) => s + v, 0)
  const hasWarehouse  = (report?.warehouse_received?.length || 0) > 0
  const hasReturns    = (report?.bottle_returns_in_period?.length || 0) > 0
  const warehouseTotal = (report?.warehouse_received || []).reduce((s, i) => s + (i.total || 0), 0)

  if (loading) return (
    <CourierLayout title="Статистика">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
    </CourierLayout>
  )
  if (!stats) return (
    <CourierLayout title="Статистика">
      <div style={{ textAlign: 'center', padding: '60px 20px', fontSize: 15, fontWeight: 600, color: TEXT2, opacity: 0.35 }}>Статистика недоступна</div>
    </CourierLayout>
  )

  return (
    <CourierLayout title="Статистика">
      {pickerOpen && (
        <DateTimePickerModal initialDate={customDate} initialDateTo={customDateTo} onApply={applyCustom} onClose={() => setPickerOpen(false)} />
      )}

      {/* ── 1. Courier info ── */}
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 4 }}>{stats.name || 'Курьер'}</div>
        {(stats.vehicle_type || stats.vehicle_plate) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" stroke={TEXT2} strokeWidth="1.7" strokeLinejoin="round"/>
              <circle cx="5.5" cy="18.5" r="2.5" stroke={TEXT2} strokeWidth="1.5"/>
              <circle cx="18.5" cy="18.5" r="2.5" stroke={TEXT2} strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 13, color: TEXT2 }}>
              {[stats.vehicle_type, stats.vehicle_plate].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>

      {/* ── 2. Deliveries + Debt (2-col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: stats.bottles_must_return > 0 ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 10 }}>
        {/* Deliveries */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" stroke={C} strokeWidth="1.7" strokeLinejoin="round"/>
              <circle cx="5.5" cy="18.5" r="2.5" stroke={C} strokeWidth="1.5"/>
              <circle cx="18.5" cy="18.5" r="2.5" stroke={C} strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Всего доставок</span>
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, color: CD, lineHeight: 1 }}>
            {stats.delivery_count ?? '—'}
          </div>
        </div>

        {/* Bottle debt */}
        {stats.bottles_must_return > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid rgba(224,49,49,0.25)`, padding: '14px 16px', borderLeft: '3px solid #E03131' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 3h6l1 4H8L9 3z" stroke="#E03131" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 7c0 0-2 2-2 7a6 6 0 0012 0c0-5-2-7-2-7" stroke="#E03131" strokeWidth="1.7" strokeLinecap="round"/>
                <path d="M12 11v3M12 16h.01" stroke="#E03131" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#E03131', textTransform: 'uppercase', letterSpacing: 0.4 }}>Долг</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#E03131', lineHeight: 1 }}>{stats.bottles_must_return} <span style={{ fontSize: 14, fontWeight: 600 }}>шт.</span></div>
            {stats.bottle_debt_value > 0 && (
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 4 }}>{Number(stats.bottle_debt_value).toLocaleString()} сум</div>
            )}
          </div>
        )}
      </div>

      {/* ── Sold bottles (проданные бутылки) ── */}
      {stats.bottles_sold > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid rgba(0,119,182,0.25)`, padding: '14px 16px', borderLeft: '3px solid #0077B6', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 3h6l1 4H8L9 3z" stroke="#0077B6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 7c0 0-2 2-2 7a6 6 0 0012 0c0-5-2-7-2-7" stroke="#0077B6" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M12 11v4M10 13h4" stroke="#0077B6" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0077B6', textTransform: 'uppercase', letterSpacing: 0.4 }}>Продано бутылок</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0077B6', lineHeight: 1 }}>{stats.bottles_sold} <span style={{ fontSize: 14, fontWeight: 600 }}>шт.</span></div>
        </div>
      )}

      {/* ── 3. Rating (full width, horizontal) ── */}
      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={C}>
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={CD} strokeWidth="1" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 32, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
              {stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3,4,5].map(i => {
              const filled = stats.rating >= i
              const half = !filled && stats.rating >= i - 0.5
              return (
                <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={filled || half ? C : 'none'}>
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={filled || half ? CD : BORDER.replace('rgba','rgb').replace(',0.08)','')} strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              )
            })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 5, background: '#F2F2F7', borderRadius: 99, overflow: 'hidden', marginBottom: 7 }}>
            <div style={{ height: '100%', width: `${((stats.rating || 0) / 5) * 100}%`, background: GRAD, borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>
            {stats.rating > 0 ? ratingMsg(stats.rating) : 'Нет оценок пока'}
          </div>
          <div style={{ fontSize: 11, color: TEXT2 }}>
            {stats.review_count > 0
              ? `${stats.review_count} ${plural(stats.review_count, 'отзыв', 'отзыва', 'отзывов')} · из 5.0`
              : 'Нет отзывов'}
          </div>
        </div>
      </div>

      {/* ── 4. Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setPeriod('today'); setCustomDate(null); setCustomDateTo(null) }} style={{
          flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: period === 'today' ? GRAD : '#fff', color: period === 'today' ? '#fff' : TEXT2,
          border: period === 'today' ? 'none' : `1.5px solid ${BORDER}`,
        }}>Сегодня</button>
        <button onClick={() => setPickerOpen(true)} style={{
          flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: period === 'custom' ? GRAD : '#fff', color: period === 'custom' ? '#fff' : TEXT2,
          border: period === 'custom' ? 'none' : `1.5px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {period === 'custom' ? periodLabel : 'Дата'}
        </button>
      </div>

      {reportLoading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
        : report && (
        <>
          {/* ── 5. Period KPI: single card with divider ── */}
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, marginBottom: 10, display: 'flex' }}>
            <div style={{ flex: 1, padding: '14px 16px', borderRight: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Заработано</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: CD, lineHeight: 1 }}>
                {report.total_earned > 0 ? Number(Math.round(report.total_earned)).toLocaleString() : '0'}
              </div>
              <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>сум · {periodLabel}</div>
            </div>
            <div style={{ flex: 1, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Доставок</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
                {report.deliveries ?? 0}
              </div>
              <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>{periodLabel}</div>
            </div>
          </div>

          {/* ── 5b. Lent bottles ── */}
          <div style={{ background: '#FFF8E7', borderRadius: 16, border: '1px solid #FFD87A', marginBottom: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#E67700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Одолжено бутылок</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#E67700', lineHeight: 1 }}>{report?.lent_bottles || 0}</div>
            <div style={{ fontSize: 10, color: '#E67700', marginTop: 3 }}>шт · {periodLabel}</div>
          </div>

          {/* ── 6. Water on hand ── */}
          {(waterEntries.length > 0 || reservedItems.length > 0) && (() => {
            // Merge water (available) with reserved_items
            const nameSet = new Set([...waterEntries.map(([n]) => n), ...reservedItems.map(i => i.name)])
            const waterMap = Object.fromEntries(waterEntries)
            const reservedMap = Object.fromEntries(reservedItems.map(i => [i.name, i.reserved || 0]))
            const merged = [...nameSet].map(name => ({
              name,
              available: waterMap[name] || 0,
              reserved: reservedMap[name] || 0,
              total: (waterMap[name] || 0) + (reservedMap[name] || 0),
            })).filter(r => r.total > 0)
            const grandTotal = merged.reduce((s, r) => s + r.total, 0)
            return (
              <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, marginBottom: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Товары на руках</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {merged.map((r, i) => (
                    <div key={r.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < merged.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div>
                        <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{r.name}</span>
                        {r.reserved > 0 && (
                          <span style={{ fontSize: 11, color: '#E67700', fontWeight: 600, marginLeft: 6, background: 'rgba(230,119,0,0.1)', borderRadius: 5, padding: '1px 6px' }}>{r.reserved} бронь</span>
                        )}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: CD }}>{r.total} <span style={{ fontSize: 11, fontWeight: 500, color: TEXT2 }}>шт.</span></span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 2, borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>Итого</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C }}>{grandTotal} шт.</span>
                </div>
              </div>
            )
          })()}

          {/* ── 6a. Returned bottles from clients ── */}
          {totalReturnedFromClients > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: `1px solid rgba(18,184,134,0.25)`, borderLeft: '3px solid #12B886', marginBottom: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0CA678', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Возвращённые бутылки</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>Бутылки 19л · получено от клиентов</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#12B886' }}>+{totalReturnedFromClients} <span style={{ fontSize: 11, fontWeight: 500, color: TEXT2 }}>шт.</span></span>
              </div>
            </div>
          )}

          {/* ── 6a2. Unreturned bottles in period ── */}
          {unreturnedInPeriod > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: `1px solid rgba(224,49,49,0.2)`, borderLeft: '3px solid #E03131', marginBottom: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#E03131', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Невозвращённые бутылки</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>Бутылки 19л · не возвращены</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#E03131' }}>−{unreturnedInPeriod} <span style={{ fontSize: 11, fontWeight: 500, color: TEXT2 }}>шт.</span></span>
              </div>
              {unreturnedPeriodValue > 0 && (
                <div style={{ fontSize: 12, color: '#E03131', marginTop: 4, textAlign: 'right', opacity: 0.8 }}>
                  {Number(unreturnedPeriodValue).toLocaleString()} сум
                </div>
              )}
            </div>
          )}

          {/* ── 6b. Reserved for orders ── */}
          {hasReserved && (
            <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid rgba(230,119,0,0.3)`, borderLeft: '3px solid #E67700', marginBottom: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#E67700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Забронировано для заказов</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {reservedItems.filter(i => i.reserved > 0).map((r, i, arr) => (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{r.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#E67700' }}>{r.reserved} <span style={{ fontSize: 11, fontWeight: 500, color: TEXT2 }}>шт.</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 7. Warehouse transactions ── */}
          {(hasWarehouse || hasReturns) && (
            <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, marginBottom: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Транзакции склада</span>
                <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {report.warehouse_received.map((item, i) => {
                  const isLast = !hasReturns && i === report.warehouse_received.length - 1
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: isLast ? 'none' : `1px solid ${BORDER}` }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M5 12h14M14 6l6 6-6 6" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.quantity} шт.</span>
                      {item.total > 0 && <span style={{ fontSize: 12, color: TEXT2 }}>{Number(item.total).toLocaleString()} сум</span>}
                    </div>
                  )
                })}
                {hasReturns && report.bottle_returns_in_period.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: 'none', borderTop: hasWarehouse ? `1px solid ${BORDER}` : 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M19 12H5M10 18l-6-6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 500 }}>{item.name} · возврат тары</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.quantity} шт.</span>
                  </div>
                ))}
              </div>
              {warehouseTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>Итого выдано</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{Number(warehouseTotal).toLocaleString()} сум</span>
                </div>
              )}
            </div>
          )}

          {/* ── 8. Delivery history ── */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                История доставок · {deliveryRows.length}
              </span>
              <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
            </div>

            {(report?.orders || []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[
                  { key: 'all',  label: 'Все',
                    icon: null },
                  { key: 'cash', label: 'Наличные',
                    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 7v10M9 9.5C9 8.12 10.34 7 12 7s3 1.12 3 2.5S13.66 12 12 12s-3 1.12-3 2.5S10.34 17 12 17s3-1.12 3-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                  { key: 'card', label: 'Карта',
                    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20M6 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                ].map(f => (
                  <button key={f.key} onClick={() => setPayFilter(f.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: payFilter === f.key ? '#F0FAE8' : '#F2F2F7',
                    color: payFilter === f.key ? CD : TEXT2,
                    border: payFilter === f.key ? `1.5px solid ${C}` : '1.5px solid transparent',
                    flexShrink: 0,
                  }}>
                    {f.icon}{f.label}
                  </button>
                ))}
              </div>
            )}

            {deliveryRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: TEXT2, fontSize: 13 }}>Нет доставок за период</div>
            ) : (
              <>
                <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: '0 16px' }}>
                  {deliveryRows.map((o, i) => {
                    const isCash = o.payment_method === 'cash'
                    const dt = o.delivered_at_iso ? new Date(o.delivered_at_iso) : null
                    const timeStr = dt ? dt.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }) : (o.delivered_at || '').slice(-5)
                    const dateStr = dt ? dt.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short' }) : (o.delivered_at || '').slice(0, 6)
                    const orderItems = (o.items || []).filter(it => it.quantity > 0)
                    const bottles19l = orderItems.reduce((s, it) => (it.volume || 0) >= 19 ? s + it.quantity : s, 0)
                    const unreturnedOrder = Math.max(0, bottles19l - (o.return_bottles || 0))
                    const unreturnedOrderValue = Math.round(unreturnedOrder * bottleSurcharge)
                    return (
                      <div key={o.order_id} style={{ padding: '11px 0', borderBottom: i < deliveryRows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flexShrink: 0, color: TEXT2 }}>
                            {isCash
                              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 7v10M9 9.5C9 8.12 10.34 7 12 7s3 1.12 3 2.5S13.66 12 12 12s-3 1.12-3 2.5S10.34 17 12 17s3-1.12 3-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/></svg>
                              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20M6 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</div>
                            <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{dateStr} · {timeStr} · {isCash ? 'Наличные' : 'Карта'}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, flexShrink: 0 }}>
                            {Number(o.total).toLocaleString()} сум
                          </div>
                        </div>
                        {(orderItems.length > 0 || o.return_bottles > 0 || unreturnedOrder > 0) && (
                          <div style={{ marginTop: 6, paddingLeft: 27, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {orderItems.map((it, j) => (
                              <div key={j} style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 4 }}>
                                <span style={{ color: '#E03131', fontWeight: 700 }}>−{it.quantity} шт.</span>
                                <span>{it.name}</span>
                              </div>
                            ))}
                            {o.return_bottles > 0 && (
                              <div style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 4 }}>
                                <span style={{ color: '#12B886', fontWeight: 700 }}>+{o.return_bottles} шт.</span>
                                <span>Возврат бутылок</span>
                              </div>
                            )}
                            {unreturnedOrder > 0 && (
                              <div style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 4 }}>
                                <span style={{ color: '#E03131', fontWeight: 700 }}>−{unreturnedOrder} шт. не возвращено</span>
                                {unreturnedOrderValue > 0 && (
                                  <span style={{ color: '#E03131', fontWeight: 700 }}>· {Number(unreturnedOrderValue).toLocaleString()} сум</span>
                                )}
                              </div>
                            )}
                            {(o.bonus_used || 0) > 0 && (
                              <div style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 4 }}>
                                <span style={{ color: '#6741D9', fontWeight: 700 }}>−{Number(o.bonus_used).toLocaleString()} сум</span>
                                <span>бонусная скидка</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding: '10px 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: Object.keys(deliveryItemTotals).length > 0 ? 6 : 0 }}>
                    <span style={{ fontSize: 12, color: TEXT2 }}>{deliveryRows.length} {plural(deliveryRows.length, 'доставка', 'доставки', 'доставок')}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{Number(Math.round(deliveryTotal)).toLocaleString()} сум</span>
                  </div>
                  {(Object.keys(deliveryItemTotals).length > 0 || totalReturnedFromClients > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(deliveryItemTotals).map(([name, qty]) => (
                        <div key={name} style={{ fontSize: 11, color: TEXT2, background: '#F2F2F7', borderRadius: 7, padding: '3px 8px' }}>
                          <span style={{ color: '#E03131', fontWeight: 700 }}>−{qty}</span> {name}
                        </div>
                      ))}
                      {totalReturnedFromClients > 0 && (
                        <div style={{ fontSize: 11, color: TEXT2, background: '#E6FCF5', borderRadius: 7, padding: '3px 8px', border: '1px solid rgba(18,184,134,0.2)' }}>
                          <span style={{ color: '#12B886', fontWeight: 700 }}>+{totalReturnedFromClients}</span> Возврат бутылок
                        </div>
                      )}
                      {totalBonusUsed > 0 && (
                        <div style={{ fontSize: 11, color: TEXT2, background: '#F3ECFF', borderRadius: 7, padding: '3px 8px', border: '1px solid rgba(103,65,217,0.15)' }}>
                          <span style={{ color: '#6741D9', fontWeight: 700 }}>−{Number(Math.round(totalBonusUsed)).toLocaleString()}</span> Скидки бонусами
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </CourierLayout>
  )
}
