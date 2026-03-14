import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { EverLogoMark } from '../EverLogo'
import { useState, useEffect } from 'react'
import { getNotifications } from '../../api'

const NAV = [
  {
    path: '/manager', label: 'Заказы', exactMatch: true,
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/notifications', label: 'Уведомления',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/support', label: 'Поддержка',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/clients', label: 'Клиенты',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M3 19C3 16.8 5.7 15 9 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="16" cy="11" r="3" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M13 21C13 18.8 14.3 17 16 17C17.7 17 19 18.8 19 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/couriers', label: 'Курьеры',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/stats', label: 'Статистика',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export default function ManagerLayout({ children, title }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchUnread = () => {
      getNotifications()
        .then(ns => setUnreadCount(ns.filter(n => !n.read).length))
        .catch(() => {})
    }
    fetchUnread()
    const iv = setInterval(fetchUnread, 30000)
    return () => clearInterval(iv)
  }, [])

  const doLogout = () => { logout(); navigate('/login') }

  const isActive = (nav) =>
    nav.exactMatch ? location.pathname === nav.path : location.pathname.startsWith(nav.path)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F2F7' }}>

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      {!isMobile && (
        <aside style={s.sidebar}>
          <div style={s.sidebarTop}>
            <div style={s.logo} onClick={() => navigate('/manager')}>
              <EverLogoMark width={34} />
              <div>
                <div style={s.logoName}>ever</div>
                <div style={s.logoBadge}>Менеджер</div>
              </div>
            </div>

            {user && (
              <div style={s.userCard}>
                <div style={s.userAvatar}>{(user.name || 'M')[0].toUpperCase()}</div>
                <div>
                  <div style={s.userName}>{user.name}</div>
                  <div style={s.userRole}>Менеджер</div>
                </div>
              </div>
            )}

            <nav style={s.nav}>
              {NAV.map((nav) => {
                const active = isActive(nav)
                return (
                  <button key={nav.path}
                    style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                    onClick={() => navigate(nav.path)}>
                    <span style={{ color: active ? '#8DC63F' : 'rgba(255,255,255,0.5)', position: 'relative', flexShrink: 0 }}>
                      <nav.Icon size={18} />
                      {nav.path === '/manager/notifications' && unreadCount > 0 && (
                        <span style={s.navBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                      )}
                    </span>
                    <span style={{ flex: 1 }}>{nav.label}</span>
                    {active && <span style={s.navActiveDot} />}
                  </button>
                )
              })}
            </nav>
          </div>

          <button style={s.logoutBtn} onClick={doLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Выйти
          </button>
        </aside>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={isMobile ? s.mobileHeader : s.desktopHeader}>
          {isMobile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <EverLogoMark width={28} />
                <span style={s.mobileTitle}>{title}</span>
              </div>
              {unreadCount > 0 && (
                <button style={s.bellBtn} onClick={() => navigate('/manager/notifications')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#1C1C1E" strokeWidth="1.7" strokeLinecap="round"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#1C1C1E" strokeWidth="1.7" strokeLinecap="round"/>
                  </svg>
                  <span style={s.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <h1 style={s.desktopTitle}>{title}</h1>
              <div style={s.headerBadge}>Панель менеджера</div>
            </>
          )}
        </header>

        {/* Page content */}
        <div style={{ ...s.content, paddingBottom: isMobile ? 80 : 24 }}>
          {children}
        </div>
      </div>

      {/* ── Mobile bottom navigation ── */}
      {isMobile && (
        <nav style={s.mobileNav}>
          {NAV.map((nav) => {
            const active = isActive(nav)
            return (
              <button key={nav.path}
                style={{ ...s.mobileItem, color: active ? '#8DC63F' : '#8E8E93' }}
                onClick={() => navigate(nav.path)}>
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <nav.Icon size={20} />
                  {nav.path === '/manager/notifications' && unreadCount > 0 && (
                    <span style={s.mobileNavBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, lineHeight: 1, whiteSpace: 'nowrap', color: active ? '#8DC63F' : '#8E8E93' }}>
                  {nav.label}
                </span>
              </button>
            )
          })}
          <button style={{ ...s.mobileItem, color: '#AEAEB2' }} onClick={doLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 500, color: '#AEAEB2' }}>Выйти</span>
          </button>
        </nav>
      )}
    </div>
  )
}

const G = '#8DC63F'
const s = {
  sidebar: {
    width: 220, background: '#111827', flexShrink: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
  },
  sidebarTop: { display: 'flex', flexDirection: 'column' },
  logo: {
    padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
  },
  logoName: { color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: -0.5 },
  logoBadge: { fontSize: 9, color: G, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 },
  userCard: {
    margin: '10px 10px 0',
    background: 'rgba(255,255,255,0.05)', borderRadius: 10,
    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  userAvatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: `linear-gradient(135deg, ${G}, #6CA32F)`,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 12, flexShrink: 0,
  },
  userName: { color: '#fff', fontWeight: 600, fontSize: 12, lineHeight: 1.2 },
  userRole: { color: G, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  nav: { padding: '6px 0', display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
    position: 'relative',
  },
  navItemActive: { background: 'rgba(141,198,63,0.1)', color: '#fff', borderLeft: `3px solid ${G}` },
  navActiveDot: { width: 6, height: 6, borderRadius: '50%', background: G, flexShrink: 0 },
  navBadge: {
    position: 'absolute', top: -5, right: -8,
    background: '#FF3B30', color: '#fff',
    borderRadius: 999, fontSize: 9, fontWeight: 800,
    minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 2px', border: '1.5px solid #111827',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.3)', padding: '14px 16px',
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },

  // Mobile header
  mobileHeader: {
    background: '#fff', padding: '10px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid rgba(60,60,67,0.1)',
    position: 'sticky', top: 0, zIndex: 10,
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
    minHeight: 54,
  },
  mobileTitle: { fontWeight: 700, fontSize: 15, color: '#1C1C1E', letterSpacing: -0.2 },
  bellBtn: {
    position: 'relative', background: 'rgba(118,118,128,0.1)',
    border: 'none', borderRadius: 10, width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  bellBadge: {
    position: 'absolute', top: 5, right: 5,
    background: '#FF3B30', color: '#fff',
    borderRadius: 999, fontSize: 8, fontWeight: 800,
    minWidth: 14, height: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 2px', border: '1.5px solid #fff',
  },

  // Desktop header
  desktopHeader: {
    background: '#fff', padding: '14px 22px',
    borderBottom: '1px solid #EBEBEB',
    position: 'sticky', top: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  desktopTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#1A1A1A' },
  headerBadge: {
    background: '#8DC63F20', color: '#6CA32F',
    border: '1px solid #8DC63F40', borderRadius: 8,
    padding: '4px 10px', fontSize: 11, fontWeight: 700,
  },

  content: { padding: 16, flex: 1, overflowY: 'auto' },

  // Mobile bottom nav
  mobileNav: {
    display: 'flex',
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff', zIndex: 200,
    borderTop: '1px solid rgba(60,60,67,0.12)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
    boxShadow: '0 -2px 16px rgba(0,0,0,0.06)',
  },
  mobileItem: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '9px 2px 5px', gap: 3, cursor: 'pointer',
    transition: 'color 0.15s', minWidth: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  mobileNavBadge: {
    position: 'absolute', top: -4, right: -5,
    background: '#FF3B30', color: '#fff',
    borderRadius: 999, fontSize: 8, fontWeight: 800,
    minWidth: 13, height: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 2px', border: '1.5px solid #fff',
  },
}
