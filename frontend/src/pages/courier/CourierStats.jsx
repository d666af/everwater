import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats, getCourierWater, getCourierReport } from '../../api'
import { useAuthStore } from '../../store/auth'
import CourierReportModal from '../../components/CourierReportModal'
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'

const tg = window.Telegram?.WebApp

const C    = '#8DC63F'
const CD   = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT  = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const toLocalISO = (d) =>
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
  if (r >= 4.8) return 'Превосходный результат! 🏆'
  if (r >= 4.5) return 'Отличный результат! Так держать'
  if (r >= 4.0) return 'Хороший рейтинг'
  if (r >= 3.0) return 'Есть куда расти'
  return 'Старайтесь работать лучше'
}

// ─── Reusable primitives ─────────────────────────────────────────────────────

function Spinner() {
  return <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
}

function SummarySection({ title, color, bg, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
      <div style={{ background: bg, padding: '6px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      </div>
      <div style={{ padding: '4px 14px 8px', display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

function SummaryRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || TEXT }}>{value}</span>
    </div>
  )
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ rating }) {
  const filled = Math.round(rating || 0)
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i <= filled ? '#FFD43B' : 'none'}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            stroke="#FFD43B" strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
      ))}
    </div>
  )
}

// ─── KPI mini card (period) ───────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: TEXT2, lineHeight: 1.3 }}>{sub}</div>}
      <div style={{ fontSize: 9, color: TEXT2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.2 }}>{label}</div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CourierStats() {
  const [stats, setStats]             = useState(null)
  const [water, setWater]             = useState({})
  const [report, setReport]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [reportLoading, setReportLoad]= useState(false)
  const [showReport, setShowReport]   = useState(false)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [period, setPeriod]           = useState('today')
  const [customDate, setCustomDate]   = useState(null)
  const [customDateTo, setCustomDateTo] = useState(null)
  const [payFilter, setPayFilter]     = useState('all')
  const { user } = useAuthStore()

  const courierId = tg?.initDataUnsafe?.user?.id || user?.telegram_id || user?.id

  // Load static data (stats + water)
  useEffect(() => {
    if (!courierId) { setLoading(false); return }
    Promise.allSettled([
      getCourierStats(courierId),
      getCourierWater(courierId),
    ]).then(([st, w]) => {
      if (st.status === 'fulfilled') setStats(st.value)
      if (w.status === 'fulfilled')  setWater(w.value || {})
      setLoading(false)
    })
  }, [courierId]) // eslint-disable-line

  // Compute effective date range
  const { dateFrom, dateTo } = (() => {
    const today = toLocalISO(new Date())
    if (period === 'today') return { dateFrom: today, dateTo: today }
    return { dateFrom: customDate || today, dateTo: customDateTo || customDate || today }
  })()

  // Load report whenever courierId / dates change
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

  const applyCustom = (start, end) => {
    setCustomDate(start); setCustomDateTo(end); setPeriod('custom')
  }

  const periodLabel = period === 'custom'
    ? (customDate
        ? (customDateTo && customDateTo !== customDate
            ? `${fmtDateStr(customDate)} – ${fmtDateStr(customDateTo)}`
            : fmtDateStr(customDate))
        : 'Дата')
    : 'Сегодня'

  // Delivery history filtered by payment
  const deliveryRows = (report?.orders || []).filter(o =>
    payFilter === 'all' ? true : o.payment_method === payFilter
  )
  const deliveryTotal = deliveryRows.reduce((s, o) => s + (o.total || 0), 0)

  const waterEntries = Object.entries(water).filter(([, v]) => v > 0)
  const waterTotal   = waterEntries.reduce((s, [, v]) => s + v, 0)

  const hasWarehouse = (report?.warehouse_received?.length || 0) > 0
  const hasReturns   = (report?.bottle_returns_in_period?.length || 0) > 0

  if (loading) return (
    <CourierLayout title="Статистика">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
    </CourierLayout>
  )

  if (!stats) return (
    <CourierLayout title="Статистика">
      <div style={{ textAlign: 'center', padding: '60px 20px', color: TEXT2 }}>
        <div style={{ fontSize: 17, fontWeight: 700, opacity: 0.3 }}>Статистика недоступна</div>
      </div>
    </CourierLayout>
  )

  return (
    <CourierLayout title="Статистика">
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={customDate}
          initialDateTo={customDateTo}
          onApply={applyCustom}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {showReport && stats?.courier_id && (
        <CourierReportModal
          courierId={stats.courier_id}
          courierName={stats.name || 'Курьер'}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* ── 1. Rating + Deliveries (всегда, не фильтруются) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

        {/* Rating */}
        <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${BORDER}`, padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Stars rating={stats.rating} />
          <div style={{ fontSize: 34, fontWeight: 900, color: '#E67700', lineHeight: 1 }}>
            {stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
          </div>
          {stats.review_count > 0 && (
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>
              {stats.review_count} {plural(stats.review_count, 'отзыв', 'отзыва', 'отзывов')}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#E67700', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
            {stats.rating > 0 ? ratingMsg(stats.rating) : 'Нет оценок'}
          </div>
          <div style={{ fontSize: 9, color: TEXT2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Рейтинг</div>
        </div>

        {/* Total deliveries */}
        <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${BORDER}`, padding: '18px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EBFBEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" stroke="#2B8A3E" strokeWidth="1.7" strokeLinecap="round"/>
              <rect x="9" y="11" width="14" height="10" rx="2" stroke="#2B8A3E" strokeWidth="1.7"/>
              <path d="M13 16l2 2 4-4" stroke="#2B8A3E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#2B8A3E', lineHeight: 1 }}>
            {stats.delivery_count ?? '—'}
          </div>
          <div style={{ fontSize: 9, color: TEXT2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' }}>Всего доставок</div>
        </div>
      </div>

      {/* ── 2. Bottle debt (всегда, если > 0) ── */}
      {stats.bottles_must_return > 0 && (
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(224,49,49,0.2)', padding: '14px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF5F5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 3h6l1 4H8L9 3zM8 7c0 0-2 2-2 7a6 6 0 0012 0c0-5-2-7-2-7H8z" stroke="#E03131" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 11v3M12 16.5v.5" stroke="#E03131" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E03131' }}>Долг по бутылкам</div>
            <div style={{ fontSize: 12, color: '#C92A2A', marginTop: 2 }}>
              Не возвращено: {stats.bottles_must_return} шт.
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#E03131', lineHeight: 1 }}>{stats.bottles_must_return}</div>
            <div style={{ fontSize: 10, color: '#C92A2A', fontWeight: 600 }}>шт.</div>
            {stats.bottle_debt_value > 0 && (
              <div style={{ fontSize: 12, color: '#C92A2A', fontWeight: 700, marginTop: 2 }}>
                {Number(stats.bottle_debt_value).toLocaleString()} сум
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Filter row: Сегодня / Дата / Отчёт ── */}
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

        {stats?.courier_id && (
          <button onClick={() => setShowReport(true)} style={{
            padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: '#F0FFF4', color: CD, border: `1.5px solid ${C}`,
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke={CD} strokeWidth="2.2" strokeLinecap="round"/></svg>
            Отчёт
          </button>
        )}
      </div>

      {reportLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 28 }}><Spinner /></div>
      ) : report ? (
        <>
          {/* ── 4. Period KPI cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <KpiCard label="Заработано" color="#1971C2"
              value={report.total_earned > 0 ? `${Math.round(report.total_earned / 1000)}к` : '0'}
              sub={report.total_earned > 0 ? `${Number(Math.round(report.total_earned)).toLocaleString()} сум` : null}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#1971C2" strokeWidth="1.8"/><path d="M2 10h20" stroke="#1971C2" strokeWidth="1.5"/><circle cx="12" cy="15" r="2" fill="#1971C2"/></svg>}
            />
            <KpiCard label="Доставок" color={CD}
              value={report.deliveries ?? 0}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke={CD} strokeWidth="1.8"/><path d="M7 9h10M7 13h6" stroke={CD} strokeWidth="1.5" strokeLinecap="round"/></svg>}
            />
            <KpiCard label="Возвращено" color="#5C940D"
              value={report.total_bottle_returns_in_period ?? 0}
              sub="бутылок"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M10 19l-7-7 7-7" stroke="#5C940D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            />
          </div>

          {/* ── 5. Water on hand (current, not period-filtered) ── */}
          {waterEntries.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${BORDER}`, marginBottom: 10 }}>
              <div style={{ padding: '12px 18px 0', fontSize: 12, fontWeight: 800, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Товары на руках
              </div>
              <div style={{ padding: '8px 18px 14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {waterEntries.map(([name, qty]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{name}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: CD }}>{qty}</span>
                      <span style={{ fontSize: 11, color: TEXT2 }}>шт.</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>Итого</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: C }}>{waterTotal}</span>
                    <span style={{ fontSize: 11, color: TEXT2 }}>шт.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. Warehouse transactions ── */}
          {(hasWarehouse || hasReturns) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0' }}>
                Транзакции склада
              </div>
              {hasWarehouse && (
                <SummarySection title="Получено со склада" color="#E67700" bg="#FFF3D9">
                  {report.warehouse_received.map((item, i) => (
                    <SummaryRow key={i} label={item.name}
                      value={`${item.quantity} шт.${item.total > 0 ? ` · ${Number(item.total).toLocaleString()} сум` : ''}`}
                      color="#E67700" />
                  ))}
                </SummarySection>
              )}
              {hasReturns && (
                <SummarySection title="Возврат тары на склад" color="#1971C2" bg="#E8F4FD">
                  {report.bottle_returns_in_period.map((item, i) => (
                    <SummaryRow key={i} label={item.name} value={`${item.quantity} шт.`} color="#1971C2" />
                  ))}
                </SummarySection>
              )}
            </div>
          )}

          {/* ── 7. Delivery history ── */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                История доставок · {deliveryRows.length}
              </span>
              <span style={{ fontSize: 12, color: TEXT2 }}>{periodLabel}</span>
            </div>

            {/* Cash/card filter chips */}
            {(report?.orders || []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[
                  { key: 'all',  label: 'Все' },
                  { key: 'cash', label: '💵 Наличные' },
                  { key: 'card', label: '💳 Карта' },
                ].map(f => (
                  <button key={f.key} onClick={() => setPayFilter(f.key)} style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: payFilter === f.key ? '#F0FFF4' : '#F2F2F7',
                    color: payFilter === f.key ? CD : TEXT2,
                    border: payFilter === f.key ? `1.5px solid ${C}` : '1.5px solid transparent',
                    flexShrink: 0,
                  }}>{f.label}</button>
                ))}
              </div>
            )}

            {deliveryRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 20px', color: TEXT2, fontSize: 14 }}>
                Нет доставок за период
              </div>
            ) : (
              <>
                <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${BORDER}`, padding: '0 16px' }}>
                  {deliveryRows.map((o, i) => {
                    const isCash = o.payment_method === 'cash'
                    const dt = o.delivered_at_iso ? new Date(o.delivered_at_iso) : null
                    const timeStr = dt
                      ? dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                      : (o.delivered_at || '').slice(-5)
                    const dateStr = dt
                      ? dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                      : (o.delivered_at || '').slice(0, 6)
                    return (
                      <div key={o.order_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: i < deliveryRows.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: isCash ? '#FFF3D9' : '#E8F4FD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            {isCash
                              ? <rect x="2" y="5" width="20" height="14" rx="2" stroke="#E67700" strokeWidth="1.8"/>
                              : <><rect x="2" y="5" width="20" height="14" rx="2" stroke="#1971C2" strokeWidth="1.8"/><path d="M2 10h20" stroke="#1971C2" strokeWidth="1.5"/></>
                            }
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.address}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>
                            {dateStr} · {timeStr}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>
                            {Number(o.total).toLocaleString()} сум
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: isCash ? '#FFF3D9' : '#E8F4FD', color: isCash ? '#E67700' : '#1971C2' }}>
                            {isCash ? 'Нал.' : 'Карта'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Delivery total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, marginTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT2 }}>
                    Итого · {deliveryRows.length} {plural(deliveryRows.length, 'доставка', 'доставки', 'доставок')}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: TEXT }}>
                    {Number(Math.round(deliveryTotal)).toLocaleString()} сум
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </CourierLayout>
  )
}
