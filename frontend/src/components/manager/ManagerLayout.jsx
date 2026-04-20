import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useAdminRoleStore } from '../../store/adminRole'
import { EverLogoMark } from '../EverLogo'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const NAV = [
  {
    path: '/manager', label: 'Панель', exactMatch: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/support', label: 'Чат',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/clients', label: 'Клиенты',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M3 19c0-2.2 2.7-4 6-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="16" cy="11" r="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M13 21c0-2.2 1.3-4 3-4s3 1.8 3 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/couriers', label: 'Курьеры',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/manager/stats', label: 'Стат.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function ManagerLayout({ children, title, noPadding = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { clearRole } = useAdminRoleStore()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const itemRefs = useRef({})
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const switchRole = () => { clearRole(); navigate('/admin') }
  const isAdmin = user?.role === 'admin'

  const isActive = (nav) =>
    nav.exactMatch ? location.pathname === nav.path : location.pathname.startsWith(nav.path)

  // Pill animation for mobile bottom nav
  useLayoutEffect(() => {
    if (!isMobile) return
    const activeNav = NAV.find(n => isActive(n))
    if (!activeNav) return
    const activeEl = itemRefs.current[activeNav.path]
    const navEl = navRef.current
    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect()
      const itemRect = activeEl.getBoundingClientRect()
      const pillW = 64
      setPillStyle({
        left: itemRect.left - navRect.left + (itemRect.width - pillW) / 2,
        width: pillW,
      })
      if (!ready) setTimeout(() => setReady(true), 50)
    }
  }, [location.pathname, isMobile]) // eslint-disable-line

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: noPadding ? '#fff' : '#e4e4e8' }}>

      {/* Desktop sidebar */}
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
              {NAV.map(nav => {
                const active = isActive(nav)
                return (
                  <button key={nav.path}
                    style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                    onClick={() => navigate(nav.path)}>
                    <span style={{ color: active ? C : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                      {nav.icon}
                    </span>
                    <span style={{ flex: 1 }}>{nav.label}</span>
                    {active && <span style={s.navDot} />}
                  </button>
                )
              })}
            </nav>
          </div>
          {isAdmin && (
            <button style={{ ...s.logoutBtn, color: 'rgba(255,255,255,0.5)' }} onClick={switchRole}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 10a8 8 0 00-8-8 8 8 0 00-5.7 2.3M4 14a8 8 0 008 8 8 8 0 005.7-2.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Сменить роль
            </button>
          )}
        </aside>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Desktop-only header */}
        {!isMobile && (
          <header style={s.desktopHeader}>
            <h1 style={s.desktopTitle}>{title}</h1>
            <div style={s.headerBadge}>Панель менеджера</div>
          </header>
        )}

        {/* Page content */}
        <div style={{
          ...s.content,
          paddingBottom: isMobile ? 100 : 24,
          ...(noPadding ? { padding: 0, paddingBottom: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
        }}>
          {children}
        </div>
      </div>

      {/* Admin role switch FAB (mobile only) */}
      {isMobile && isAdmin && (
        <button style={s.switchFab} onClick={switchRole}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 10a8 8 0 00-8-8 8 8 0 00-5.7 2.3M4 14a8 8 0 008 8 8 8 0 005.7-2.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Роль
        </button>
      )}

      {/* Mobile bottom navigation — green gradient with animated pill */}
      {isMobile && (
        <>
          {!noPadding && <div style={{ height: 90 }} />}
          <nav style={s.mobileNav}>
            <div style={s.mobileNavInner} ref={navRef}>
              {/* Animated pill */}
              <div style={{
                ...s.pill,
                left: pillStyle.left ?? 0,
                width: pillStyle.width ?? 50,
                opacity: pillStyle.width ? 1 : 0,
                transition: ready
                  ? 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                  : 'none',
              }} />
              {NAV.map(nav => {
                const active = isActive(nav)
                return (
                  <button key={nav.path}
                    ref={el => { itemRefs.current[nav.path] = el }}
                    style={s.mobileItem}
                    onClick={() => navigate(nav.path)}>
                    <div style={{ color: active ? '#2d7a0f' : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {nav.icon}
                      </div>
                    <span style={{
                      fontSize: 9, fontWeight: active ? 700 : 500,
                      color: active ? '#2d7a0f' : 'rgba(255,255,255,0.85)',
                      lineHeight: 1, whiteSpace: 'nowrap',
                    }}>
                      {nav.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  )
}

const s = {
  // Desktop sidebar
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
    margin: '10px 10px 0',
    background: 'rgba(255,255,255,0.05)', borderRadius: 10,
    padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  userAvatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: GRAD, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 12, flexShrink: 0,
  },
  userName: { color: '#fff', fontWeight: 600, fontSize: 12, lineHeight: 1.2 },
  userRole: { color: C, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  nav: { padding: '6px 0', display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
  },
  navItemActive: { background: 'rgba(141,198,63,0.1)', color: '#fff', borderLeft: `3px solid ${C}` },
  navDot: { width: 6, height: 6, borderRadius: '50%', background: C, flexShrink: 0 },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.3)', padding: '14px 16px',
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
    borderTop: '1px solid rgba(255,255,255,0.06)',
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
    background: `${C}20`, color: '#6CA32F',
    border: `1px solid ${C}40`, borderRadius: 8,
    padding: '4px 10px', fontSize: 11, fontWeight: 700,
  },

  content: { padding: 16, flex: 1, overflowY: 'auto' },

  // Mobile bottom nav — green gradient pill style (matches client BottomNav)
  mobileNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
    padding: '0 6px 8px',
    paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
  },
  mobileNavInner: {
    display: 'flex', maxWidth: 420, margin: '0 auto',
    background: GRAD, borderRadius: 22,
    padding: '8px 0 10px',
    boxShadow: '0 4px 24px rgba(80,140,20,0.35)',
    position: 'relative',
  },
  pill: {
    position: 'absolute', top: 5, bottom: 5,
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    pointerEvents: 'none',
  },
  mobileItem: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 0 0', gap: 0, cursor: 'pointer',
    position: 'relative', zIndex: 1,
    WebkitTapHighlightColor: 'transparent',
  },
  mobileNavBadge: {
    position: 'absolute', top: -4, right: -8,
    background: '#FF3B30', color: '#fff',
    borderRadius: 999, fontSize: 8, fontWeight: 800,
    minWidth: 14, height: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 2px', border: '1.5px solid rgba(255,255,255,0.5)',
  },
  switchFab: {
    position: 'fixed', top: 16, right: 16, zIndex: 300,
    display: 'flex', alignItems: 'center', gap: 6,
    background: GRAD, color: '#fff',
    border: 'none', borderRadius: 20,
    padding: '8px 14px', fontSize: 12, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(80,140,20,0.3)',
  },
}
