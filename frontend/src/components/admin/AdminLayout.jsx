import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { EverLogoMark } from '../EverLogo'
import { useState, useEffect } from 'react'

const C = '#8DC63F'
const CD = '#6CA32F'

const NAV = [
  { path: '/admin', label: 'Дашборд', exactMatch: true,
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
  },
  { path: '/admin/orders', label: 'Заказы',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  { path: '/admin/products', label: 'Товары',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C12 2 4 10 4 15.5C4 19.6 7.6 23 12 23C16.4 23 20 19.6 20 15.5C20 10 12 2 12 2Z"
          fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  { path: '/admin/managers', label: 'Менеджеры',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M3 21C3 18 5.7 16 9 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="17" cy="10" r="3" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M14 21C14 19 15.3 17 17 17C18.7 17 20 19 20 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  { path: '/admin/couriers', label: 'Курьеры',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  { path: '/admin/settings', label: 'Настройки',
    Icon: ({ size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5"/>
        <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function AdminLayout({ children, title, noPadding = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const doLogout = () => { logout(); navigate('/login') }
  const isActive = ({ path, exactMatch }) =>
    exactMatch ? location.pathname === path : location.pathname.startsWith(path)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F2F7' }}>

      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <aside style={s.sidebar}>
          <div style={s.sidebarTop}>
            <div style={s.logo} onClick={() => navigate('/admin')}>
              <EverLogoMark width={34} />
              <div>
                <div style={s.logoName}>ever</div>
                <div style={s.logoBadge}>Администратор</div>
              </div>
            </div>

            {user && (
              <div style={s.userCard}>
                <div style={s.userAvatar}>{(user.name || 'A')[0].toUpperCase()}</div>
                <div>
                  <div style={s.userName}>{user.name}</div>
                  <div style={s.userRole}>Администратор</div>
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
                    <span style={{ color: active ? C : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                      <nav.Icon size={18} />
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

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={isMobile ? s.mobileHeader : s.desktopHeader}>
          {isMobile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <EverLogoMark width={28} />
                <span style={s.mobileTitle}>{title}</span>
              </div>
              <button style={s.headerBtn} onClick={doLogout} title="Выйти">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                    stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <h1 style={s.desktopTitle}>{title}</h1>
              <div style={s.headerBadge}>
                <div style={s.headerBadgeDot} />
                Администратор
              </div>
            </>
          )}
        </header>

        <div style={{
          ...s.content,
          paddingBottom: isMobile ? 80 : 24,
          ...(noPadding ? { padding: isMobile ? '0 0 80px' : 0 } : {}),
        }}>
          {children}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <nav style={s.mobileNav}>
          {NAV.map((nav) => {
            const active = isActive(nav)
            return (
              <button key={nav.path}
                style={{ ...s.mobileItem, color: active ? C : '#8E8E93' }}
                onClick={() => navigate(nav.path)}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <nav.Icon size={20} />
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, lineHeight: 1, whiteSpace: 'nowrap', color: active ? C : '#8E8E93' }}>
                  {nav.label}
                </span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

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
  logoBadge: { fontSize: 9, color: C, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 },
  userCard: {
    margin: '10px 10px 0', background: 'rgba(255,255,255,0.05)', borderRadius: 10,
    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  userAvatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 12, flexShrink: 0,
  },
  userName: { color: '#fff', fontWeight: 600, fontSize: 12, lineHeight: 1.2 },
  userRole: { color: C, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  nav: { padding: '6px 0', display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', position: 'relative',
  },
  navItemActive: { background: 'rgba(141,198,63,0.1)', color: '#fff', borderLeft: `3px solid ${C}` },
  navActiveDot: { width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
    padding: '14px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },

  mobileHeader: {
    background: '#fff', padding: '10px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid rgba(60,60,67,0.1)',
    position: 'sticky', top: 0, zIndex: 10,
    boxShadow: '0 1px 8px rgba(0,0,0,0.04)', minHeight: 54,
  },
  mobileTitle: { fontWeight: 700, fontSize: 15, color: '#1C1C1E', letterSpacing: -0.2 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10, border: 'none',
    background: 'rgba(118,118,128,0.1)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

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
    padding: '4px 12px', fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', gap: 6,
  },
  headerBadgeDot: {
    width: 7, height: 7, borderRadius: '50%', background: C,
    animation: 'pulse 2s infinite',
  },

  content: { padding: 16, flex: 1 },

  mobileNav: {
    display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0,
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
}
