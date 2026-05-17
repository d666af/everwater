import { useEffect, useState, useCallback } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats, getCourierWater, getCourierReport } from '../../api'
import { useAuthStore } from '../../store/auth'
import CourierReportModal from '../../components/CourierReportModal'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function ratingMessage(r) {
  if (r >= 4.8) return 'Превосходный результат! 🏆'
  if (r >= 4.5) return 'Отличный результат! Так держать'
  if (r >= 4.0) return 'Хороший рейтинг'
  if (r >= 3.0) return 'Есть куда расти'
  return 'Старайтесь доставлять быстро и аккуратно'
}

export default function CourierStats() {
  const [stats, setStats] = useState(null)
  const [water, setWater] = useState({})
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [isToday, setIsToday] = useState(true)
  const { user } = useAuthStore()

  const courierId = tg?.initDataUnsafe?.user?.id || user?.telegram_id || user?.id

  useEffect(() => {
    if (!courierId) { setLoading(false); return }
    Promise.allSettled([
      getCourierStats(courierId),
      getCourierWater(courierId),
    ]).then(([st, w]) => {
      if (st.status === 'fulfilled') setStats(st.value)
      if (w.status === 'fulfilled') setWater(w.value || {})
      setLoading(false)
    })
  }, [courierId]) // eslint-disable-line

  const loadReport = useCallback((dbId, from, to) => {
    if (!dbId) return
    setReportLoading(true)
    getCourierReport(dbId, from, to)
      .then(r => setReport(r))
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false))
  }, [])

  useEffect(() => {
    if (stats?.courier_id) loadReport(stats.courier_id, dateFrom, dateTo)
  }, [stats?.courier_id, dateFrom, dateTo]) // eslint-disable-line

  const setToday = () => {
    const t = todayStr()
    setIsToday(true)
    setDateFrom(t)
    setDateTo(t)
  }

  const handleDateFrom = (v) => { setIsToday(false); setDateFrom(v); if (v > dateTo) setDateTo(v) }
  const handleDateTo = (v) => { setIsToday(false); setDateTo(v); if (v < dateFrom) setDateFrom(v) }

  const waterEntries = Object.entries(water).filter(([, v]) => v > 0)
  const totalWater = waterEntries.reduce((s, [, v]) => s + v, 0)

  return (
    <CourierLayout title="Статистика">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={spinner} />
        </div>
      ) : !stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 20px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, opacity: 0.3 }}>Статистика недоступна</div>
        </div>
      ) : (
        <>
          {/* ── Top row: Rating + Total deliveries ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {/* Rating card */}
            <div style={{ ...card, padding: '18px 14px', background: 'linear-gradient(135deg, #FFF9E6 0%, #FFFBF0 100%)', border: '1px solid rgba(230,119,0,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <StarIcon rating={stats.rating} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#E67700', textAlign: 'center', lineHeight: 1 }}>
                {stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#E67700', textAlign: 'center', marginTop: 3, opacity: 0.75 }}>из 5.0</div>
              <div style={{ fontSize: 11, color: '#E67700', textAlign: 'center', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>
                {stats.rating > 0 ? ratingMessage(stats.rating) : 'Нет оценок'}
              </div>
              {stats.review_count > 0 && (
                <div style={{ fontSize: 11, color: TEXT2, textAlign: 'center', marginTop: 4 }}>
                  {stats.review_count} {plural(stats.review_count, 'отзыв', 'отзыва', 'отзывов')}
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textAlign: 'center', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Рейтинг</div>
            </div>

            {/* Total deliveries card */}
            <div style={{ ...card, padding: '18px 14px', background: 'linear-gradient(135deg, #F0FFF4 0%, #F8FFF8 100%)', border: '1px solid rgba(43,138,62,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(43,138,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" stroke="#2B8A3E" strokeWidth="1.8" strokeLinecap="round"/>
                    <rect x="9" y="11" width="14" height="10" rx="2" stroke="#2B8A3E" strokeWidth="1.8"/>
                    <path d="M13 16l2 2 4-4" stroke="#2B8A3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#2B8A3E', textAlign: 'center', lineHeight: 1 }}>
                {stats.delivery_count ?? '—'}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textAlign: 'center', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Всего доставок</div>
            </div>
          </div>

          {/* ── Bottle debt card ── */}
          {stats.bottles_must_return > 0 && (
            <div style={{ ...card, marginBottom: 10, padding: '16px 18px', background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF8F8 100%)', border: '1px solid rgba(224,49,49,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(224,49,49,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 3h6l1 4H8L9 3zM8 7c0 0-2 2-2 7a6 6 0 0012 0c0-5-2-7-2-7H8z" stroke="#E03131" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 11v4M12 17.5v.5" stroke="#E03131" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E03131', marginBottom: 2 }}>Долг по бутылкам</div>
                  <div style={{ fontSize: 12, color: '#C92A2A' }}>
                    {stats.bottles_must_return} шт. не возвращено
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#E03131', lineHeight: 1 }}>
                    {stats.bottles_must_return}
                  </div>
                  <div style={{ fontSize: 11, color: '#C92A2A', fontWeight: 600 }}>шт.</div>
                  {stats.bottle_debt_value > 0 && (
                    <div style={{ fontSize: 12, color: '#C92A2A', fontWeight: 700, marginTop: 2 }}>
                      {Number(stats.bottle_debt_value).toLocaleString()} сум
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Report button + date filter ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'stretch' }}>
            {stats?.courier_id && (
              <button onClick={() => setShowReport(true)} style={{
                flexShrink: 0, padding: '12px 16px', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
                Отчёт
              </button>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={setToday} style={{
                width: '100%', padding: '8px 14px', borderRadius: 10,
                border: `1.5px solid ${isToday ? C : 'rgba(60,60,67,0.12)'}`,
                background: isToday ? `${C}15` : '#fff',
                color: isToday ? CD : TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>Сегодня</button>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="date" value={dateFrom} onChange={e => handleDateFrom(e.target.value)}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 10, border: `1.5px solid ${!isToday ? C : 'rgba(60,60,67,0.12)'}`, fontSize: 12, color: TEXT, background: '#fff', outline: 'none' }} />
                <input type="date" value={dateTo} onChange={e => handleDateTo(e.target.value)}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 10, border: `1.5px solid ${!isToday ? C : 'rgba(60,60,67,0.12)'}`, fontSize: 12, color: TEXT, background: '#fff', outline: 'none' }} />
              </div>
            </div>
          </div>

          {/* ── Period cards ── */}
          {reportLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20, marginBottom: 10 }}>
              <div style={spinner} />
            </div>
          ) : report ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <PeriodCard
                label="Заработано"
                value={report.total_earned > 0 ? `${Math.round(report.total_earned / 1000)}к` : '0'}
                sub={report.total_earned > 0 ? `${Number(report.total_earned).toLocaleString()} сум` : null}
                color="#1971C2"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="#1971C2" strokeWidth="1.8"/>
                    <path d="M2 10h20" stroke="#1971C2" strokeWidth="1.5"/>
                    <circle cx="12" cy="15" r="2" fill="#1971C2"/>
                  </svg>
                }
              />
              <PeriodCard
                label="Доставок"
                value={report.deliveries ?? 0}
                color={CD}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="16" rx="3" stroke={CD} strokeWidth="1.8"/>
                    <path d="M7 9h10M7 13h6" stroke={CD} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                }
              />
              <PeriodCard
                label="Бутылок"
                value={report.total_bottles_returned ?? 0}
                sub="возвращено"
                color="#5C940D"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 3h6l1 4H8L9 3zM8 7c0 0-2 2-2 7a6 6 0 0012 0c0-5-2-7-2-7H8z" stroke="#5C940D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              />
            </div>
          ) : null}

          {/* ── Water on hand ── */}
          {waterEntries.length > 0 && (
            <div style={{ ...card, padding: '16px 18px', marginBottom: 10 }}>
              <div style={sectionTitle}>Товары на руках</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {waterEntries.map(([product, qty]) => (
                  <div key={product} style={waterRow}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: C, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{product}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: CD }}>{qty}</span>
                    <span style={{ fontSize: 11, color: TEXT2 }}>шт.</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 12px', background: `${C}12`, borderRadius: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Всего</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: C }}>{totalWater} шт.</span>
              </div>
            </div>
          )}

          {/* ── Received from warehouse (period) ── */}
          {report?.warehouse_received?.length > 0 && (
            <div style={{ ...card, padding: '16px 18px', marginBottom: 10 }}>
              <div style={sectionTitle}>Получено со склада</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {report.warehouse_received.map((item, i) => (
                  <div key={i} style={waterRow}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1971C2', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{item.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1971C2', marginRight: 4 }}>{item.quantity} шт.</span>
                    {item.total > 0 && (
                      <span style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>
                        {Number(item.total).toLocaleString()} сум
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 12px', background: 'rgba(25,113,194,0.07)', borderRadius: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Всего</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1971C2' }}>
                  {report.warehouse_received.reduce((s, i) => s + i.quantity, 0)} шт.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {showReport && stats?.courier_id && (
        <CourierReportModal
          courierId={stats.courier_id}
          courierName={stats.name || 'Курьер'}
          onClose={() => setShowReport(false)}
        />
      )}
    </CourierLayout>
  )
}

function PeriodCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#999', lineHeight: 1.2 }}>{sub}</div>}
      <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

function StarIcon({ rating }) {
  const filled = Math.round(rating || 0)
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= filled ? '#FFD43B' : 'none'}>
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            stroke="#FFD43B" strokeWidth="1.8" strokeLinejoin="round"/>
        </svg>
      ))}
    </div>
  )
}

function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

const card = { background: '#fff', borderRadius: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const spinner = { width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }
const sectionTitle = { fontSize: 14, fontWeight: 700, color: TEXT }
const waterRow = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#F8F9FA', borderRadius: 10 }
