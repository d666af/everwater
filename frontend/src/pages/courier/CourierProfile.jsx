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
const BORDER = 'rgba(60,60,67,0.12)'

function InfoRow({ icon, label, value }) {
  return (
    <div style={s.infoRow}>
      <div style={s.infoIcon}>{icon}</div>
      <div>
        <div style={s.infoLabel}>{label}</div>
        <div style={s.infoVal}>{value || '—'}</div>
      </div>
    </div>
  )
}

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
      {/* Avatar + name block */}
      <div style={s.hero}>
        <div style={s.avatar}>{initials}</div>
        <div style={s.heroName}>{displayName}</div>
        <div style={s.heroBadge}>Курьер доставки</div>
      </div>

      {/* Stats mini row */}
      {stats && (
        <div style={s.statsRow}>
          <div style={s.miniStat}>
            <div style={{ ...s.miniVal, color: '#2B8A3E' }}>{stats.delivery_count ?? 0}</div>
            <div style={s.miniLabel}>Доставок</div>
          </div>
          <div style={s.statDivider} />
          <div style={s.miniStat}>
            <div style={{ ...s.miniVal, color: '#1971C2' }}>
              {stats.earnings ? `${Math.round(stats.earnings / 1000)}к` : '—'}
            </div>
            <div style={s.miniLabel}>Заработано</div>
          </div>
          <div style={s.statDivider} />
          <div style={s.miniStat}>
            <div style={{ ...s.miniVal, color: '#E67700' }}>
              {stats.rating ? stats.rating.toFixed(1) : '—'}
            </div>
            <div style={s.miniLabel}>Рейтинг</div>
          </div>
        </div>
      )}

      {/* Info section */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Данные аккаунта</div>
        {tgUser?.username && (
          <InfoRow
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21.6 12.3C21.6 17.4 17.4 21.6 12 21.6C9.8 21.6 7.7 20.9 6 19.7L2.4 20.4 3.1 17C1.9 15.2 1.2 13.1 1.2 10.9 1.2 5.8 5.4 1.6 10.8 1.6" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="19" cy="5" r="3" fill={C}/>
              </svg>
            }
            label="Telegram"
            value={`@${tgUser.username}`}
          />
        )}
        {courierId && (
          <InfoRow
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="2" width="14" height="20" rx="2" stroke={TEXT2} strokeWidth="1.5"/>
                <path d="M12 17h.01" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/>
              </svg>
            }
            label="ID"
            value={String(courierId)}
          />
        )}
        {(user?.phone || tgUser?.phone_number) && (
          <InfoRow
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4l1.9-1.9c.2-.2.5-.3.8-.1 1 .4 2.1.6 3.1.6.4 0 .8.3.8.8V19c0 .4-.4.8-.8.8C9.1 19.8 4.2 14.9 4.2 8.8c0-.5.4-.8.8-.8H8c.5 0 .8.4.8.8 0 1.1.2 2.1.6 3.1.1.3 0 .6-.1.8l-1.9 1.9-.6-3.8z" fill={TEXT2}/>
              </svg>
            }
            label="Телефон"
            value={user?.phone || tgUser?.phone_number}
          />
        )}
        {stats?.today_count != null && (
          <InfoRow
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.5"/>
                <path d="M12 7v5l3 3" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
            label="Доставок сегодня"
            value={`${stats.today_count} шт.`}
          />
        )}
      </div>

      {/* Quick actions */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Навигация</div>
        <button style={s.actionRow} onClick={() => navigate('/courier')}>
          <div style={{ ...s.actionIcon, background: '#EBFBEE' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke="#2B8A3E" strokeWidth="1.6"/>
              <path d="M7 9h10M7 13h6" stroke="#2B8A3E" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={s.actionLabel}>Мои заказы</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
        <button style={s.actionRow} onClick={() => navigate('/courier/stats')}>
          <div style={{ ...s.actionIcon, background: '#EDF3FF' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 20V10M12 20V4M6 20v-6" stroke="#3B5BDB" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={s.actionLabel}>Статистика</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Logout */}
      <button style={s.logoutBtn} onClick={doLogout}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
            stroke="#E03131" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Выйти из аккаунта
      </button>

      {/* App version */}
      <div style={s.version}>ever · Курьер · v1.0</div>
    </CourierLayout>
  )
}

const s = {
  hero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 20px 20px', gap: 8,
  },
  avatar: {
    width: 80, height: 80, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    color: '#fff', fontWeight: 900, fontSize: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(141,198,63,0.35)', marginBottom: 4,
  },
  heroName: { fontWeight: 800, fontSize: 22, color: TEXT, letterSpacing: -0.3 },
  heroBadge: {
    fontSize: 12, fontWeight: 700, color: C,
    background: '#F0FFF0', padding: '4px 14px', borderRadius: 999,
    border: `1px solid rgba(141,198,63,0.25)`,
  },

  statsRow: {
    background: '#fff', borderRadius: 16, padding: '16px 20px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', alignItems: 'center', marginBottom: 12,
  },
  miniStat: { flex: 1, textAlign: 'center' },
  miniVal: { fontWeight: 900, fontSize: 22, lineHeight: 1 },
  miniLabel: { fontSize: 11, color: TEXT2, fontWeight: 500, marginTop: 4 },
  statDivider: { width: 1, height: 36, background: BORDER },

  section: {
    background: '#fff', borderRadius: 16, padding: '16px 20px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12,
  },
  sectionTitle: { fontWeight: 800, fontSize: 14, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  infoRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
    borderBottom: `1px solid ${BORDER}`,
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8, background: '#F2F2F7',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoLabel: { fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoVal: { fontSize: 14, color: TEXT, fontWeight: 600, marginTop: 1 },

  actionRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 0', borderBottom: `1px solid ${BORDER}`,
    background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
  actionIcon: {
    width: 34, height: 34, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionLabel: { flex: 1, fontSize: 15, color: TEXT, fontWeight: 500 },

  logoutBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', padding: '14px', borderRadius: 14,
    background: '#FFF5F5', border: '1.5px solid rgba(224,49,49,0.2)',
    color: '#E03131', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    marginBottom: 12, WebkitTapHighlightColor: 'transparent',
  },

  version: { textAlign: 'center', fontSize: 11, color: '#C0C0C8', paddingBottom: 8 },
}
