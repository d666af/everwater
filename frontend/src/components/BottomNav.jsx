import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useAuthStore } from '../store/auth'
import { useAdminRoleStore } from '../store/adminRole'

const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const NAV = [
  { path: '/', label: 'Главная', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/orders', label: 'Заказы', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M8 8h8M8 12h5M8 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/subscription', label: 'Подписка', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M12 22V12M12 12L3.27 7M12 12l8.73-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/profile', label: 'Профиль', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { clearRole } = useAdminRoleStore()
  const hasMultipleRoles = user?.roles?.length > 1
  const itemRefs = useRef({})
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({})
  const [ready, setReady] = useState(false)

  const hidden = ['/checkout', '/support'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname.startsWith('/warehouse')
    || location.pathname === '/login'

  // Calculate pill position — covers the entire button (icon + text)
  useLayoutEffect(() => {
    if (hidden) return
    const activeEl = itemRefs.current[location.pathname]
    const navEl = navRef.current
    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect()
      const itemRect = activeEl.getBoundingClientRect()
      const pillW = 74
      setPillStyle({
        left: itemRect.left - navRect.left + (itemRect.width - pillW) / 2,
        width: pillW,
      })
      if (!ready) setTimeout(() => setReady(true), 50)
    }
  }, [location.pathname, hidden])

  if (hidden) return null

  return (
    <>
      <button style={st.logoutFab} onClick={() => { logout(); navigate('/login') }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Выйти
      </button>
      {hasMultipleRoles && (
        <button style={st.switchFab} onClick={() => clearRole()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 10a8 8 0 00-8-8 8 8 0 00-5.7 2.3M4 14a8 8 0 008 8 8 8 0 005.7-2.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Роль
        </button>
      )}
      <div style={{ height: 90 }} />
      <nav style={st.nav}>
        <div style={st.inner} ref={navRef}>
          {/* Animated white pill — covers icon + text */}
          <div style={{
            ...st.pill,
            left: pillStyle.left ?? 0,
            width: pillStyle.width ?? 60,
            opacity: pillStyle.width ? 1 : 0,
            transition: ready
              ? 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
              : 'none',
          }} />

          {NAV.map(({ path, label, icon }) => {
            const active = location.pathname === path
            return (
              <button
                key={path}
                ref={el => { itemRefs.current[path] = el }}
                style={st.item}
                onClick={() => navigate(path)}
                aria-label={label}
              >
                <div style={{ ...st.iconWrap, color: active ? '#2d7a0f' : 'rgba(255,255,255,0.85)' }}>
                  {icon}
                </div>
                <span style={{
                  ...st.label,
                  color: active ? '#2d7a0f' : 'rgba(255,255,255,0.85)',
                  fontWeight: active ? 700 : 500,
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

const st = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
    padding: '0 6px 8px',
    paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
  },
  inner: {
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
  item: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 0 0', gap: 0, cursor: 'pointer',
    position: 'relative', zIndex: 1,
  },
  iconWrap: {
    width: 28, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.3s ease',
  },
  label: {
    fontSize: 10, letterSpacing: 0.1, marginTop: 1,
    transition: 'color 0.3s ease',
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
  logoutFab: {
    position: 'fixed', top: 16, left: 16, zIndex: 300,
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff', color: '#666',
    border: '1.5px solid #ddd', borderRadius: 20,
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
}
