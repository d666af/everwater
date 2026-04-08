import { useEffect, useState } from 'react'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats, getCourierOrders } from '../../api'
import { useAuthStore } from '../../store/auth'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

export default function CourierStats() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  const courierId = tg?.initDataUnsafe?.user?.id || user?.telegram_id || user?.id

  useEffect(() => {
    if (!courierId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      getCourierStats(courierId),
      getCourierOrders(courierId),
    ])
      .then(([st, orders]) => {
        setStats(st)
        setRecent(orders.filter(o => o.status === 'delivered').slice(0, 8))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [courierId])

  return (
    <CourierLayout title="Статистика">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : !stats ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
            <path d="M18 20V10M12 20V4M6 20v-6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Статистика недоступна</div>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <StatCard label="Всего доставок" value={stats.delivery_count ?? '—'} accent="#2B8A3E" icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#2B8A3E" strokeWidth="1.8"/><path d="M7 9h10M7 13h6" stroke="#2B8A3E" strokeWidth="1.5" strokeLinecap="round"/></svg>
            } />
            <StatCard label="Сегодня" value={stats.today_count ?? '—'} accent={C} icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.6"/><path d="M12 7v5l3 3" stroke={C} strokeWidth="1.6" strokeLinecap="round"/></svg>
            } />
            <StatCard label="Заработано" value={stats.earnings ? `${Math.round(stats.earnings / 1000)}к` : '—'} sub={stats.earnings ? `${Number(stats.earnings).toLocaleString()} сум` : null} accent="#1971C2" icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#1971C2" strokeWidth="1.8"/><path d="M2 10h20" stroke="#1971C2" strokeWidth="1.5"/></svg>
            } />
            <StatCard label="Рейтинг" value={stats.rating ? stats.rating.toFixed(1) : '—'} sub={stats.rating ? 'из 5.0' : null} accent="#E67700" icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#E67700" strokeWidth="1.8" strokeLinejoin="round" fill={stats.rating >= 4 ? '#FFF3BF' : 'none'}/></svg>
            } />
          </div>

          {/* Rating bar */}
          {stats.rating > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Рейтинг</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 10, background: '#F2F2F7', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(stats.rating / 5) * 100}%`, background: 'linear-gradient(90deg, #E67700, #FFD43B)', borderRadius: 999, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#E67700', minWidth: 36 }}>{stats.rating.toFixed(1)}</span>
              </div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 6 }}>
                {stats.rating >= 4.5 ? 'Отличный результат! Так держать' :
                 stats.rating >= 4.0 ? 'Хороший рейтинг' :
                 'Старайтесь доставлять быстро и аккуратно'}
              </div>
            </div>
          )}

          {/* Recent deliveries */}
          {recent.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 12 }}>Последние доставки</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recent.map(o => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: TEXT2, background: '#F2F2F7', padding: '3px 8px', borderRadius: 7, flexShrink: 0 }}>#{o.id}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: TEXT, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</div>
                      {o.delivery_date && <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>{o.delivery_date}{o.delivery_period ? ` · ${o.delivery_period}` : ''}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: TEXT }}>{(o.total || 0).toLocaleString()} сум</div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: '#EBFBEE', color: '#2B8A3E' }}>Доставлен</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </CourierLayout>
  )
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: '18px 14px',
      textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#bbb', marginTop: -2 }}>{sub}</div>}
    </div>
  )
}
