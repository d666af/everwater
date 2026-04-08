import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CourierLayout from '../../components/courier/CourierLayout'
import { getCourierStats } from '../../api'
import { useAuthStore } from '../../store/auth'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

export default function CourierProfile() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [stats, setStats] = useState(null)

  const tgUser = tg?.initDataUnsafe?.user
  const courierId = tgUser?.id || user?.telegram_id || user?.id

  const displayName = tgUser
    ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`
    : user?.name || 'Курьер'

  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  useEffect(() => {
    if (!courierId) return
    getCourierStats(courierId).then(setStats).catch(console.error)
  }, [courierId])

  const doLogout = () => { logout(); navigate('/login') }

  return (
    <CourierLayout title="Профиль">
      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 16px', gap: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C}, ${CD})`,
          color: '#fff', fontWeight: 900, fontSize: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(141,198,63,0.35)',
        }}>{initials}</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: TEXT }}>{displayName}</div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: CD,
          background: `${C}15`, padding: '4px 14px', borderRadius: 999,
          border: `1px solid ${C}30`,
        }}>Курьер доставки</div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ background: '#fff', borderRadius: 18, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#2B8A3E', lineHeight: 1 }}>{stats.delivery_count ?? 0}</div>
            <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500, marginTop: 4 }}>Доставок</div>
          </div>
          <div style={{ width: 1, height: 36, background: BORDER }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: C, lineHeight: 1 }}>{stats.today_count ?? 0}</div>
            <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500, marginTop: 4 }}>Сегодня</div>
          </div>
          <div style={{ width: 1, height: 36, background: BORDER }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#E67700', lineHeight: 1 }}>{stats.rating ? stats.rating.toFixed(1) : '—'}</div>
            <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500, marginTop: 4 }}>Рейтинг</div>
          </div>
        </div>
      )}

      {/* Account info */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Аккаунт</div>
        {tgUser?.username && <InfoRow label="Telegram" value={`@${tgUser.username}`} />}
        {courierId && <InfoRow label="ID" value={String(courierId)} />}
        {(user?.phone || tgUser?.phone_number) && <InfoRow label="Телефон" value={user?.phone || tgUser?.phone_number} />}
      </div>

      {/* Logout */}
      <button onClick={doLogout} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: 14, borderRadius: 14,
        background: '#FFF5F5', border: '1.5px solid rgba(224,49,49,0.2)',
        color: '#E03131', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#E03131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Выйти из аккаунта
      </button>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#C0C0C8', padding: '12px 0 4px' }}>ever · v1.0</div>
    </CourierLayout>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
