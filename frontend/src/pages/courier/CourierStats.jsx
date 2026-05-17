import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats, getCourierWater, getCourierReport } from '../../api'
import { useAuthStore } from '../../store/auth'
import CourierReportModal from '../../components/CourierReportModal'
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
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.18)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
  )
}

// Flat section label
function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 8px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</span>
      {right && <span style={{ fontSize: 11, color: TEXT2 }}>{right}</span>}
    </div>
  )
}

// Clean flat row inside a white card
function DataRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 14, color: TEXT, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: TEXT, fontWeight: 700 }}>{value}</span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function CourierStats() {
  const [stats, setStats]               = useState(null)
  const [water, setWater]               = useState({})
  const [report, setReport]             = useState(null)
  const [loading, setLoading]           = useState(true)
  const [reportLoading, setReportLoad]  = useState(false)
  const [showReport, setShowReport]     = useState(false)
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
    const today = toLocalISO(new Date())
    if (period === 'today') return { dateFrom: today, dateTo: today }
    return { dateFrom: customDate || today, dateTo: customDateTo || customDate || today }
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
  const waterEntries  = Object.entries(water).filter(([, v]) => v > 0)
  const waterTotal    = waterEntries.reduce((s, [, v]) => s + v, 0)
  const hasWarehouse  = (report?.warehouse_received?.length || 0) > 0
  const hasReturns    = (report?.bottle_returns_in_period?.length || 0) > 0

  if (loading) return (
    <CourierLayout title="Статистика">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
    </CourierLayout>
  )
  if (!stats) return (
    <CourierLayout title="Статистика">
      <div style={{ textAlign: 'center', padding: '60px 20px', fontSize: 15, fontWeight: 600, color: TEXT2, opacity: 0.4 }}>
        Статистика недоступна
      </div>
    </CourierLayout>
  )

  return (
    <CourierLayout title="Статистика">
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate} initialDateTo={customDateTo}
          onApply={applyCustom} onClose={() => setPickerOpen(false)}
        />
      )}
      {showReport && stats?.courier_id && (
        <CourierReportModal courierId={stats.courier_id} courierName={stats.name || 'Курьер'} onClose={() => setShowReport(false)} />
      )}

      {/* ── 1. Rating + Deliveries ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

        {/* Rating */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={C}>
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={CD} strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Рейтинг</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
            {stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 5, lineHeight: 1.3 }}>
            {stats.rating > 0 ? ratingMsg(stats.rating) : 'Нет оценок'}
          </div>
          {stats.review_count > 0 && (
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 4 }}>
              {stats.review_count} {plural(stats.review_count, 'отзыв', 'отзыва', 'отзывов')}
            </div>
          )}
        </div>

        {/* Total deliveries */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke={C} strokeWidth="1.8"/>
              <path d="M7 9h10M7 13h6" stroke={C} strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Всего доставок</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
            {stats.delivery_count ?? '—'}
          </div>
        </div>
      </div>

      {/* ── 2. Bottle debt ── */}
      {stats.bottles_must_return > 0 && (
        <div style={{ ...card, borderLeft: '3px solid #E03131', marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E03131', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Долг по бутылкам</div>
            <div style={{ fontSize: 13, color: TEXT2 }}>Не возвращено на склад</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#E03131', lineHeight: 1 }}>{stats.bottles_must_return} шт.</div>
            {stats.bottle_debt_value > 0 && (
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 3 }}>{Number(stats.bottle_debt_value).toLocaleString()} сум</div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Report button (above filters) ── */}
      {stats?.courier_id && (
        <button onClick={() => setShowReport(true)} style={{
          width: '100%', padding: '12px', borderRadius: 14, border: 'none',
          background: GRAD, color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
          Скачать отчёт
        </button>
      )}

      {/* ── 4. Period filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setPeriod('today'); setCustomDate(null); setCustomDateTo(null) }} style={{
          flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: period === 'today' ? GRAD : '#fff',
          color: period === 'today' ? '#fff' : TEXT2,
          border: period === 'today' ? 'none' : `1.5px solid ${BORDER}`,
        }}>Сегодня</button>

        <button onClick={() => setPickerOpen(true)} style={{
          flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: period === 'custom' ? GRAD : '#fff',
          color: period === 'custom' ? '#fff' : TEXT2,
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
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 28 }}><Spinner /></div>
        : report && (
          <>
            {/* ── 5. Period KPI: Заработано + Доставок ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Заработано</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
                  {report.total_earned > 0 ? `${Number(Math.round(report.total_earned)).toLocaleString()}` : '0'}
                </div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>сум</div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Доставок</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: TEXT, lineHeight: 1 }}>
                  {report.deliveries ?? 0}
                </div>
              </div>
            </div>

            {/* ── 6. Water on hand ── */}
            {waterEntries.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <SectionLabel>Товары на руках</SectionLabel>
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, padding: '0 16px' }}>
                  {waterEntries.map(([name, qty], i) => (
                    <DataRow key={name} label={name} value={`${qty} шт.`} last={i === waterEntries.length - 1} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px 0' }}>
                  <span style={{ fontSize: 12, color: TEXT2 }}>Итого</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CD }}>{waterTotal} шт.</span>
                </div>
              </div>
            )}

            {/* ── 7. Warehouse transactions ── */}
            {(hasWarehouse || hasReturns) && (
              <div style={{ marginBottom: 10 }}>
                <SectionLabel>Транзакции склада</SectionLabel>
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, padding: '0 16px' }}>
                  {hasWarehouse && report.warehouse_received.map((item, i) => {
                    const isLast = !hasReturns && i === report.warehouse_received.length - 1
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: isLast ? 'none' : `1px solid ${BORDER}` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                          <path d="M5 12h14M14 5l7 7-7 7" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 500 }}>{item.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                          {item.quantity} шт.{item.total > 0 ? ` · ${Number(item.total).toLocaleString()} сум` : ''}
                        </span>
                      </div>
                    )
                  })}
                  {hasWarehouse && hasReturns && (
                    <div style={{ borderTop: `1px solid ${BORDER}` }} />
                  )}
                  {hasReturns && report.bottle_returns_in_period.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i === report.bottle_returns_in_period.length - 1 ? 'none' : `1px solid ${BORDER}` }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M19 12H5M10 19l-7-7 7-7" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 500 }}>{item.name} (возврат тары)</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.quantity} шт.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 8. Delivery history ── */}
            <div style={{ marginBottom: 8 }}>
              <SectionLabel right={periodLabel}>История доставок · {deliveryRows.length}</SectionLabel>

              {(report?.orders || []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[
                    { key: 'all',  label: 'Все',      icon: null },
                    { key: 'cash', label: 'Наличные',
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.5"/></svg> },
                    { key: 'card', label: 'Карта',
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="2" y="10" width="20" height="4" fill="currentColor" opacity="0.18"/></svg> },
                  ].map(f => (
                    <button key={f.key} onClick={() => setPayFilter(f.key)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 13px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: payFilter === f.key ? '#F0FAE8' : '#F2F2F7',
                      color: payFilter === f.key ? CD : TEXT2,
                      border: payFilter === f.key ? `1.5px solid ${C}` : '1.5px solid transparent',
                      flexShrink: 0,
                    }}>
                      {f.icon}
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {deliveryRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 20px', color: TEXT2, fontSize: 13 }}>Нет доставок за период</div>
              ) : (
                <>
                  <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, padding: '0 16px' }}>
                    {deliveryRows.map((o, i) => {
                      const isCash = o.payment_method === 'cash'
                      const dt = o.delivered_at_iso ? new Date(o.delivered_at_iso) : null
                      const timeStr = dt ? dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : (o.delivered_at || '').slice(-5)
                      const dateStr = dt ? dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : (o.delivered_at || '').slice(0, 6)
                      return (
                        <div key={o.order_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: i < deliveryRows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
                            {isCash
                              ? <><rect x="2" y="5" width="20" height="14" rx="2" stroke={TEXT} strokeWidth="1.8"/><path d="M2 10h20" stroke={TEXT} strokeWidth="1.5"/></>
                              : <><rect x="2" y="5" width="20" height="14" rx="2" stroke={TEXT} strokeWidth="1.8"/><rect x="2" y="10" width="20" height="4" fill={TEXT} opacity="0.35"/></>
                            }
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</div>
                            <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{dateStr} · {timeStr} · {isCash ? 'Нал.' : 'Карта'}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, flexShrink: 0 }}>
                            {Number(o.total).toLocaleString()} сум
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px 0' }}>
                    <span style={{ fontSize: 12, color: TEXT2 }}>{deliveryRows.length} {plural(deliveryRows.length, 'доставка', 'доставки', 'доставок')}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{Number(Math.round(deliveryTotal)).toLocaleString()} сум</span>
                  </div>
                </>
              )}
            </div>
          </>
        )
      }
    </CourierLayout>
  )
}

const card = {
  background: '#fff',
  borderRadius: 16,
  border: `1px solid ${BORDER}`,
  padding: '16px 16px',
  display: 'flex',
  flexDirection: 'column',
}
