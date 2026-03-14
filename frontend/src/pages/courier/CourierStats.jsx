import { useEffect, useState } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats, getCourierOrders } from '../../api'
import { useAuthStore } from '../../store/auth'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ ...s.statCard, borderColor: accent + '22' }}>
      <div style={{ ...s.statIcon, background: accent + '15' }}>{icon}</div>
      <div style={{ ...s.statVal, color: accent }}>{value}</div>
      <div style={s.statLbl}>{label}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  )
}

export default function CourierStats() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const telegramId = tg?.initDataUnsafe?.user?.id || user?.telegram_id

  useEffect(() => {
    if (!telegramId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      getCourierStats(telegramId),
      getCourierOrders(telegramId),
    ])
      .then(([st, orders]) => {
        setStats(st)
        setRecent(orders.filter(o => o.status === 'delivered').slice(0, 8))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [telegramId])

  const todayDeliveries = recent.filter(o => {
    if (!o.created_at) return false
    const d = new Date(o.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <CourierLayout title="Статистика">
      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : !stats ? (
        <div style={s.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M18 20V10M12 20V4M6 20v-6" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyText}>Статистика недоступна</div>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div style={s.grid}>
            <StatCard
              label="Всего доставок"
              value={stats.delivery_count ?? '—'}
              accent="#2B8A3E"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="3" stroke="#2B8A3E" strokeWidth="1.8"/>
                  <path d="M7 9h10M7 13h6" stroke="#2B8A3E" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Сегодня"
              value={stats.today_count ?? todayDeliveries ?? '—'}
              accent={C}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="5" cy="18" r="2" stroke={C} strokeWidth="1.6"/>
                  <circle cx="19" cy="18" r="2" stroke={C} strokeWidth="1.6"/>
                  <path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke={C} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
            <StatCard
              label="Заработано"
              value={stats.earnings ? `${Math.round(stats.earnings / 1000)}к` : '—'}
              sub={stats.earnings ? `${Number(stats.earnings).toLocaleString()} сум` : null}
              accent="#1971C2"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="#1971C2" strokeWidth="1.8"/>
                  <path d="M2 10h20" stroke="#1971C2" strokeWidth="1.5"/>
                  <path d="M6 15h4" stroke="#1971C2" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />
            <StatCard
              label="Рейтинг"
              value={stats.rating ? stats.rating.toFixed(1) : '—'}
              sub={stats.rating ? 'из 5.0' : null}
              accent="#E67700"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    stroke="#E67700" strokeWidth="1.8" strokeLinejoin="round"
                    fill={stats.rating && stats.rating >= 4 ? '#FFF3BF' : 'none'}/>
                </svg>
              }
            />
          </div>

          {/* Rating progress bar */}
          {stats.rating && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Рейтинг</div>
              <div style={s.ratingRow}>
                <div style={s.ratingTrack}>
                  <div style={{ ...s.ratingFill, width: `${(stats.rating / 5) * 100}%` }} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#E67700', minWidth: 36 }}>
                  {stats.rating.toFixed(1)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>
                {stats.rating >= 4.5 ? 'Отличный результат! Так держать' :
                 stats.rating >= 4.0 ? 'Хороший рейтинг' :
                 'Старайтесь доставлять быстро и аккуратно'}
              </div>
            </div>
          )}

          {/* Recent deliveries */}
          {recent.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Последние доставки</div>
              {recent.map(o => (
                <div key={o.id} style={s.deliveryRow}>
                  <div style={s.deliveryBadge}>#{o.id}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.deliveryAddr}>{o.address}</div>
                    {o.delivery_time && <div style={s.deliveryTime}>{o.delivery_time}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={s.deliveryTotal}>{Number(o.total || 0).toLocaleString()} сум</div>
                    <span style={s.doneBadge}>Доставлен</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CourierLayout>
  )
}

const s = {
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px' },
  emptyText: { fontSize: 16, fontWeight: 700, color: TEXT2 },

  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12,
  },
  statCard: {
    background: '#fff', borderRadius: 16, padding: '18px 14px',
    textAlign: 'center', border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  },
  statIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  statLbl: { fontSize: 12, color: TEXT2, fontWeight: 500 },
  statSub: { fontSize: 11, color: '#bbb', marginTop: -2 },

  section: {
    background: '#fff', borderRadius: 16, padding: '18px 20px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12,
  },
  sectionTitle: { fontWeight: 800, fontSize: 16, color: TEXT },

  ratingRow: { display: 'flex', alignItems: 'center', gap: 12 },
  ratingTrack: { flex: 1, height: 10, background: '#F2F2F7', borderRadius: 999, overflow: 'hidden' },
  ratingFill: { height: '100%', background: 'linear-gradient(90deg, #E67700, #FFD43B)', borderRadius: 999, transition: 'width 0.6s ease' },

  deliveryRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    paddingBottom: 12, borderBottom: `1px solid ${BORDER}`,
  },
  deliveryBadge: {
    fontWeight: 800, fontSize: 12, color: TEXT2,
    background: '#F2F2F7', padding: '3px 8px', borderRadius: 7, flexShrink: 0,
  },
  deliveryAddr: { fontSize: 14, color: TEXT, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deliveryTime: { fontSize: 12, color: TEXT2, marginTop: 2 },
  deliveryTotal: { fontWeight: 800, fontSize: 15, color: TEXT, marginBottom: 3 },
  doneBadge: {
    fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
    background: '#EBFBEE', color: '#2B8A3E',
  },
}
