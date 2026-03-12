import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram } from '../api'
import { useAuthStore } from '../store/auth'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l6-6-6-6" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function MenuRow({ icon, label, desc, value, onClick, danger }) {
  return (
    <button
      style={{
        ...s.menuRow,
        ...(danger ? { background: 'none' } : {}),
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      disabled={!onClick}
    >
      <div style={{
        ...s.menuIconWrap,
        background: danger ? 'rgba(255,59,48,0.1)' : 'rgba(142,142,147,0.1)',
      }}>
        {icon}
      </div>
      <div style={s.menuText}>
        <span style={{ ...s.menuLabel, color: danger ? '#FF3B30' : TEXT }}>{label}</span>
        {desc && <span style={s.menuDesc}>{desc}</span>}
      </div>
      {value && <span style={s.menuValue}>{value}</span>}
      {onClick && <ChevronRight />}
    </button>
  )
}

function MenuSection({ title, children }) {
  return (
    <div style={s.section}>
      {title && <div style={s.sectionTitle}>{title}</div>}
      <div style={s.menuCard}>
        {children}
      </div>
    </div>
  )
}

function MenuDivider() {
  return <div style={s.menuDivider} />
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
      <div style={s.emptyIconWrap}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="5" fill="#F2F2F7" stroke="#C7C7CC" strokeWidth="1.5"/>
          <path d="M3 21C3 18 7 16 12 16C17 16 21 18 21 21" stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ color: TEXT2, fontSize: 14, textAlign: 'center', maxWidth: 220 }}>
        Откройте приложение через Telegram
      </p>
      <button style={s.outlineBtn} onClick={doLogout}>Выйти</button>
    </div>
  )

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={s.page}>
      {/* Avatar + name card */}
      <div style={s.profileCard}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>{initials}</div>
          <div style={s.avatarOnline} />
        </div>
        <div style={s.profileName}>{user.name}</div>
        <div style={s.profilePhone}>{user.phone}</div>
        <div style={s.memberBadge}>Клиент Everwater</div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{user.order_count || 0}</div>
          <div style={s.statLabel}>Заказов</div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={s.statNum}>{(user.bonus_points || 0).toLocaleString()}</div>
          <div style={s.statLabel}>Бонусы</div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={s.statNum}>{(user.balance || 0).toLocaleString()}</div>
          <div style={s.statLabel}>Баланс</div>
        </div>
      </div>

      {/* Bonus promo */}
      {(user.bonus_points > 0) && (
        <div style={s.promoCard}>
          <div>
            <div style={s.promoTitle}>Бонусная программа</div>
            <div style={s.promoDesc}>5% с каждого заказа — к оплате следующего</div>
          </div>
          <div style={s.promoBadge}>
            <span style={s.promoBadgeNum}>{(user.bonus_points || 0).toLocaleString()}</span>
            <span style={s.promoBadgeLabel}>бонусов</span>
          </div>
        </div>
      )}

      {/* Account section */}
      <MenuSection title="Аккаунт">
        <MenuRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill={TEXT2}/>
            </svg>
          }
          label="Телефон"
          value={user.phone || 'Не указан'}
        />
        <MenuDivider />
        <MenuRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT2} strokeWidth="1.7"/>
              <path d="M7 9h10M7 13h6" stroke={TEXT2} strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          }
          label="История заказов"
          desc="Все ваши заказы"
          onClick={() => navigate('/orders')}
        />
        <MenuDivider />
        <MenuRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={TEXT2} strokeWidth="1.7" strokeLinejoin="round"/>
            </svg>
          }
          label="Поддержка"
          desc="Чат с поддержкой"
          onClick={() => tg?.openTelegramLink('https://t.me/your_support_bot')}
        />
      </MenuSection>

      {/* Logout (only for non-Telegram users) */}
      {!tg?.initDataUnsafe?.user && (
        <MenuSection>
          {!showLogout ? (
            <MenuRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C4.5 21 4 20.5 4 20V4C4 3.5 4.5 3 5 3H9M16 17L21 12L16 7M21 12H9" stroke="#FF3B30" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="Выйти из аккаунта"
              danger
              onClick={() => setShowLogout(true)}
            />
          ) : (
            <div style={s.logoutConfirm}>
              <div style={s.logoutTitle}>Выйти из аккаунта?</div>
              <div style={s.logoutDesc}>Вам потребуется снова войти</div>
              <div style={s.logoutBtns}>
                <button style={s.cancelBtn} onClick={() => setShowLogout(false)}>
                  Отмена
                </button>
                <button style={s.confirmBtn} onClick={doLogout}>
                  Выйти
                </button>
              </div>
            </div>
          )}
        </MenuSection>
      )}

      <div style={{ height: 120 }} />
    </div>
  )
}

const s = {
  page: {
    background: BG,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    height: '70vh',
    padding: '0 32px',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${BORDER}`,
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)',
    borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  outlineBtn: {
    border: `1.5px solid ${BORDER}`,
    background: '#FFFFFF',
    color: TEXT,
    borderRadius: 12,
    padding: '11px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  // Profile card
  profileCard: {
    background: '#FFFFFF',
    padding: '32px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    borderBottom: `1px solid ${BORDER}`,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${C} 0%, ${CD} 100%)`,
    color: '#fff',
    fontSize: 30,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: -1,
  },
  avatarOnline: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#34C759',
    border: '2.5px solid #FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: -0.3,
  },
  profilePhone: {
    fontSize: 14,
    color: TEXT2,
    fontWeight: 400,
  },
  memberBadge: {
    background: 'rgba(141,198,63,0.12)',
    color: CD,
    borderRadius: 999,
    padding: '4px 14px',
    fontSize: 12,
    fontWeight: 600,
    marginTop: 4,
  },
  // Stats
  statsRow: {
    background: '#FFFFFF',
    display: 'flex',
    borderBottom: `1px solid ${BORDER}`,
  },
  statCard: {
    flex: 1,
    padding: '16px 8px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    background: BORDER,
    alignSelf: 'stretch',
    margin: '12px 0',
  },
  statNum: {
    fontSize: 20,
    fontWeight: 800,
    color: TEXT,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: TEXT2,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Promo
  promoCard: {
    background: '#FFFFFF',
    margin: '12px 16px 0',
    borderRadius: 16,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: `1px solid ${BORDER}`,
    gap: 12,
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: TEXT,
    marginBottom: 3,
  },
  promoDesc: {
    fontSize: 12,
    color: TEXT2,
    lineHeight: 1.4,
    maxWidth: 200,
  },
  promoBadge: {
    background: 'rgba(141,198,63,0.12)',
    borderRadius: 12,
    padding: '8px 14px',
    textAlign: 'center',
    flexShrink: 0,
  },
  promoBadgeNum: {
    display: 'block',
    fontSize: 20,
    fontWeight: 800,
    color: C,
    letterSpacing: -0.5,
    lineHeight: 1.1,
  },
  promoBadgeLabel: {
    fontSize: 11,
    color: CD,
    fontWeight: 600,
  },
  // Menu sections
  section: {
    padding: '16px 16px 0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: TEXT2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuCard: {
    background: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${BORDER}`,
  },
  menuRow: {
    width: '100%',
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    transition: TRANSITION,
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: 500,
  },
  menuDesc: {
    fontSize: 12,
    color: TEXT2,
  },
  menuValue: {
    fontSize: 14,
    color: TEXT2,
    fontWeight: 400,
    marginRight: 4,
  },
  menuDivider: {
    height: 1,
    background: BORDER,
    margin: '0 16px',
  },
  // Logout confirm
  logoutConfirm: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#FF3B30',
    letterSpacing: -0.2,
  },
  logoutDesc: {
    fontSize: 13,
    color: TEXT2,
    textAlign: 'center',
  },
  logoutBtns: {
    display: 'flex',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    padding: '13px 0',
    borderRadius: 12,
    border: `1.5px solid ${BORDER}`,
    background: BG,
    color: TEXT,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: TRANSITION,
  },
  confirmBtn: {
    flex: 1,
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    background: '#FF3B30',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: TRANSITION,
  },
}
