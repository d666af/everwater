import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminStats } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

const PERIODS = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

const STATUS_LABELS = {
  new: 'Новые',
  awaiting_confirmation: 'Ожидают',
  confirmed: 'Подтверждены',
  assigned_to_courier: 'У курьера',
  in_delivery: 'В доставке',
  delivered: 'Доставлены',
  rejected: 'Отклонены',
}

const STATUS_COLORS = {
  new: '#3B5BDB',
  awaiting_confirmation: '#E67700',
  confirmed: '#2B8A3E',
  assigned_to_courier: '#6741D9',
  in_delivery: '#1971C2',
  delivered: C,
  rejected: '#E03131',
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ ...s.statCard, ...(accent ? { borderColor: accent + '30' } : {}) }}>
      {icon && (
        <div style={{ ...s.statIcon, background: (accent || C) + '15' }}>
          {icon}
        </div>
      )}
      <div style={{ ...s.statVal, color: accent || TEXT }}>{value}</div>
      <div style={s.statLbl}>{label}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  )
}

export default function ManagerStats() {
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAdminStats(period)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  return (
    <ManagerLayout title="Статистика">
      {/* Period segmented control */}
      <div style={s.segmented}>
        {PERIODS.map(p => (
          <button key={p.key}
            style={{ ...s.segBtn, ...(period === p.key ? s.segBtnActive : {}) }}
            onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : !stats ? (
        <div style={s.center}>
          <div style={{ color: TEXT2, fontSize: 15 }}>Нет данных</div>
        </div>
      ) : (
        <>
          {/* Main stats grid */}
          <div style={s.grid}>
            <StatCard
              label="Заказов доставлено"
              value={stats.order_count ?? '—'}
              accent="#2B8A3E"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="3" stroke="#2B8A3E" strokeWidth="1.8"/>
                  <path d="M7 9h10M7 13h6" stroke="#2B8A3E" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Выручка"
              value={stats.revenue ? `${Math.round(stats.revenue / 1000)}к` : '—'}
              sub={stats.revenue ? `${stats.revenue.toLocaleString()} сум` : null}
              accent={C}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke={C} strokeWidth="1.8"/>
                  <path d="M2 10h20M8 15h3m5 0h-2" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Средний чек"
              value={stats.avg_check ? `${Math.round(stats.avg_check / 1000)}к` : '—'}
              sub={stats.avg_check ? `${Math.round(stats.avg_check).toLocaleString()} сум` : null}
              accent="#1971C2"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M18 20V10M12 20V4M6 20v-6" stroke="#1971C2" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Повторных клиентов"
              value={stats.repeat_customers ?? '—'}
              accent="#6741D9"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#6741D9" strokeWidth="1.8"/>
                  <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="#6741D9" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Возврат бутылок"
              value={stats.bottles_returned ?? '—'}
              accent="#12B886"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M3 3v5h5" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Отменено"
              value={stats.cancelled ?? '—'}
              accent="#E03131"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#E03131" strokeWidth="1.8"/>
                  <path d="M15 9L9 15M9 9l6 6" stroke="#E03131" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
            />
          </div>

          {/* Status breakdown */}
          {stats.by_status && Object.keys(stats.by_status).length > 0 && (
            <div style={s.breakdownCard}>
              <div style={s.breakdownTitle}>Разбивка по статусам</div>
              {Object.entries(stats.by_status)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const total = Object.values(stats.by_status).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? Math.round(count / total * 100) : 0
                  const color = STATUS_COLORS[status] || TEXT2
                  return (
                    <div key={status} style={s.barRow}>
                      <div style={s.barLabel}>{STATUS_LABELS[status] || status}</div>
                      <div style={s.barTrack}>
                        <div style={{ ...s.barFill, width: `${pct}%`, background: color }} />
                      </div>
                      <div style={{ ...s.barCount, color }}>
                        {count}
                        <span style={s.barPct}> {pct}%</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}
    </ManagerLayout>
  )
}

const s = {
  segmented: {
    display: 'flex', background: '#fff', borderRadius: 12, padding: 4,
    border: `1px solid ${BORDER}`, marginBottom: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  segBtn: {
    flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none',
    background: 'none', color: TEXT2, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
  },
  segBtnActive: {
    background: C, color: '#fff',
    boxShadow: '0 2px 8px rgba(141,198,63,0.35)',
  },

  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },

  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  statCard: {
    background: '#fff', borderRadius: 16, padding: '18px 14px',
    textAlign: 'center', border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  },
  statIcon: {
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statVal: { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  statLbl: { fontSize: 12, color: TEXT2, fontWeight: 500, lineHeight: 1.3, textAlign: 'center' },
  statSub: { fontSize: 11, color: '#bbb', marginTop: -2 },

  breakdownCard: {
    background: '#fff', borderRadius: 16, padding: '18px 20px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  breakdownTitle: { fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 4 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10 },
  barLabel: { width: 130, fontSize: 13, color: TEXT, flexShrink: 0 },
  barTrack: {
    flex: 1, height: 8, background: '#F2F2F7',
    borderRadius: 999, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999, transition: 'width 0.5s ease' },
  barCount: { fontWeight: 800, fontSize: 14, minWidth: 55, textAlign: 'right', flexShrink: 0 },
  barPct: { fontWeight: 400, fontSize: 11, color: TEXT2 },
}
