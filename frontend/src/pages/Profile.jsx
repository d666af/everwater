import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram } from '../api'
import { useAuthStore } from '../store/auth'

const tg = window.Telegram?.WebApp

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ ...s.statCard, borderColor: color + '30' }}>
      <div style={{ ...s.statIcon, background: color + '15', color }}>{icon}</div>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  )
}

function MenuRow({ icon, label, desc, onClick, danger }) {
  return (
    <button style={{ ...s.menuRow, ...(danger ? s.menuRowDanger : {}) }} onClick={onClick}>
      <div style={{ ...s.menuIcon, background: danger ? '#FFEBEE' : '#F5F5F5' }}>{icon}</div>
      <div style={s.menuText}>
        <div style={{ ...s.menuLabel, color: danger ? '#E53935' : '#1A1A1A' }}>{label}</div>
        {desc && <div style={s.menuDesc}>{desc}</div>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
        <path d="M9 18l6-6-6-6" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

export default function Profile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogout, setShowLogout] = useState(false)
  const { logout, user: authUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(setUser).catch(console.error).finally(() => setLoading(false))
    } else if (authUser) {
      setUser(authUser); setLoading(false)
    } else {
      setLoading(false)
    }
  }, [authUser])

  const doLogout = () => { logout(); navigate('/login') }

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
    </div>
  )

  if (!user) return (
    <div style={s.center}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="5" fill="#F0F0F0" stroke="#DDD" strokeWidth="1.5"/>
        <path d="M3 21C3 18 7 16 12 16C17 16 21 18 21 21" stroke="#DDD" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <p style={{ color: '#888', fontSize: 14 }}>Откройте приложение через Telegram</p>
      <button style={s.outlineBtn} onClick={doLogout}>← Выйти</button>
    </div>
  )

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)

  return (
    <div style={s.page}>
      {/* Profile hero */}
      <div style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.avatarWrap}>
          <div style={s.avatar}>{initials}</div>
          <div style={s.avatarBadge}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#8DC63F"/>
              <path d="M7 12l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div style={s.heroName}>{user.name}</div>
        <div style={s.heroPhone}>{user.phone}</div>
        <div style={s.memberBadge}>Клиент Everwater</div>
      </div>

      {/* Stats row */}
      <div style={s.statsRow}>
        <StatCard icon="💧" label="Заказов" value={user.order_count || 0} color="#2196F3" />
        <StatCard icon="🎁" label="Бонусы" value={`${(user.bonus_points || 0).toLocaleString()}`} color="#F0A500" />
        <StatCard icon="💰" label="Баланс" value={`${(user.balance || 0).toLocaleString()}`} color="#8DC63F" />
      </div>

      {/* Bonus promo */}
      <div style={s.promoCard}>
        <div style={s.promoLeft}>
          <div style={s.promoTitle}>Бонусная программа</div>
          <div style={s.promoDesc}>Получайте 5% бонусами с каждого заказа и тратьте при оформлении</div>
          <div style={s.promoPoints}>
            <span style={s.promoPointsNum}>{(user.bonus_points || 0).toLocaleString()}</span>
            <span style={s.promoPointsLabel}> бонусов</span>
          </div>
        </div>
        <div style={s.promoIcon}>🎁</div>
      </div>

      {/* Menu */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Аккаунт</div>
        <div style={s.menuCard}>
          <MenuRow
            icon="📱" label="Телефон"
            desc={user.phone || 'Не указан'}
          />
          <div style={s.menuDivider} />
          <MenuRow
            icon="📦" label="История заказов"
            desc="Все ваши заказы"
            onClick={() => navigate('/orders')}
          />
          <div style={s.menuDivider} />
          <MenuRow
            icon="💬" label="Поддержка"
            desc="Мы всегда поможем"
            onClick={() => tg?.openTelegramLink('https://t.me/your_support_bot')}
          />
        </div>
      </div>

      {/* Logout */}
      {!tg?.initDataUnsafe?.user && (
        <div style={s.section}>
          {!showLogout ? (
            <MenuRow
              icon="🚪" label="Выйти из аккаунта"
              danger onClick={() => setShowLogout(true)}
            />
          ) : (
            <div style={s.logoutConfirm}>
              <div style={s.logoutTitle}>Выйти из аккаунта?</div>
              <div style={s.logoutDesc}>Вам потребуется снова войти</div>
              <div style={s.logoutBtns}>
                <button style={s.cancelBtn} onClick={() => setShowLogout(false)}>Отмена</button>
                <button style={s.confirmBtn} onClick={doLogout}>Выйти</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 100 }} />
    </div>
  )
}

const P = '#8DC63F'

const s = {
  page: { background: '#F8F8F8', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 12 },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, height: '70vh',
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid #E8E8E8', borderTop: `3px solid ${P}`,
    animation: 'spin 0.8s linear infinite',
  },
  outlineBtn: {
    border: `2px solid ${P}`, background: 'none', color: P,
    borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  hero: {
    position: 'relative', background: `linear-gradient(145deg, ${P}, #6CA32F)`,
    padding: '32px 20px 28px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 84, height: 84, borderRadius: '50%',
    background: 'rgba(255,255,255,0.25)',
    border: '3px solid rgba(255,255,255,0.5)',
    color: '#fff', fontSize: 32, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    background: '#fff', borderRadius: '50%',
    width: 22, height: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  heroName: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.3 },
  heroPhone: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  memberBadge: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff', borderRadius: 999, padding: '4px 14px',
    fontSize: 12, fontWeight: 600, backdropFilter: 'blur(4px)',
    marginTop: 4,
  },
  statsRow: { display: 'flex', gap: 10, padding: '0 16px' },
  statCard: {
    flex: 1, background: '#fff', borderRadius: 14,
    padding: '14px 8px', textAlign: 'center',
    border: '1.5px solid #E8E8E8',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18,
  },
  statValue: { fontSize: 18, fontWeight: 800, color: '#1A1A1A' },
  statLabel: { fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  promoCard: {
    margin: '0 16px',
    background: 'linear-gradient(135deg, #FFF8E1, #FFF3CD)',
    borderRadius: 16, padding: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    border: '1px solid #FFE082',
  },
  promoLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  promoTitle: { fontSize: 14, fontWeight: 700, color: '#E65100' },
  promoDesc: { fontSize: 12, color: '#BF360C', lineHeight: 1.4, maxWidth: 220 },
  promoPoints: { marginTop: 4 },
  promoPointsNum: { fontSize: 20, fontWeight: 900, color: '#F57C00' },
  promoPointsLabel: { fontSize: 12, color: '#888' },
  promoIcon: { fontSize: 40, flexShrink: 0 },
  section: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 },
  menuCard: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 1px 6px rgba(0,0,0,0.05)', border: '1px solid #F0F0F0',
  },
  menuRow: {
    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    transition: 'background 0.15s',
  },
  menuRowDanger: { background: '#FFF5F5', borderRadius: 16 },
  menuIcon: {
    width: 38, height: 38, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0,
  },
  menuText: { flex: 1, textAlign: 'left' },
  menuLabel: { fontSize: 15, fontWeight: 600 },
  menuDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  menuDivider: { height: 1, background: '#F5F5F5', margin: '0 16px' },
  logoutConfirm: {
    background: '#FFF5F5', border: '1px solid #FFCDD2',
    borderRadius: 16, padding: 16,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  logoutTitle: { fontSize: 16, fontWeight: 700, color: '#C62828' },
  logoutDesc: { fontSize: 13, color: '#888' },
  logoutBtns: { display: 'flex', gap: 10, width: '100%' },
  cancelBtn: {
    flex: 1, padding: '12px 0', borderRadius: 12,
    border: '1.5px solid #E8E8E8', background: '#fff',
    color: '#333', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1, padding: '12px 0', borderRadius: 12,
    border: 'none', background: '#E53935',
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
}
