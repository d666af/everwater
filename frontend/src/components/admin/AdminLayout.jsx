import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useAdminRoleStore } from '../../store/adminRole'
import { useState, useRef, useLayoutEffect } from 'react'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const NAV = [
  {
    path: '/admin', label: 'Панель', exactMatch: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    path: '/admin/reviews', label: 'Отзывы',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    path: '/admin/orders', label: 'Заказы',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 8h8M8 12h5M8 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/admin/stats', label: 'Статистика',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const MAIN_PATHS = new Set(['/admin', '/admin/reviews', '/admin/orders', '/admin/stats'])

export default function AdminLayout({ children, noPadding = false, title }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { clearRole } = useAdminRoleStore()
  const itemRefs = useRef({})
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({})
  const [ready, setReady] = useState(false)

  const hasMultipleRoles = user?.roles?.length > 1
  const switchRole = () => clearRole()

  const isActive = (nav) =>
    nav.exactMatch ? location.pathname === nav.path : location.pathname.startsWith(nav.path)

  useLayoutEffect(() => {
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
  }, [location.pathname]) // eslint-disable-line

  const isSubPage = !MAIN_PATHS.has(location.pathname)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: noPadding ? '#fff' : '#e4e4e8' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {isSubPage && !noPadding && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 150, background: '#fff', borderBottom: '1px solid rgba(60,60,67,0.08)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <button onClick={() => navigate('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Назад
            </button>
            {title && <span style={{ fontSize: 16, fontWeight: 800, color: '#1C1C1E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>}
          </div>
        )}
        <div style={{
          ...s.content,
          paddingBottom: 100,
          paddingTop: isSubPage && !noPadding ? 72 : 60,
          ...(noPadding ? { padding: 0, paddingBottom: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
        }}>
          {children}
        </div>
      </div>

      <button style={s.logoutFab} onClick={() => { logout(); navigate('/login') }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Выйти
      </button>

      {hasMultipleRoles && (
        <button style={s.switchFab} onClick={switchRole}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 10a8 8 0 00-8-8 8 8 0 00-5.7 2.3M4 14a8 8 0 008 8 8 8 0 005.7-2.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Роль
        </button>
      )}

      <>
        {!noPadding && <div style={{ height: 90 }} />}
        <nav style={s.mobileNav}>
          <div style={s.mobileNavInner} ref={navRef}>
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
                  <div style={{ color: active ? '#2d7a0f' : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    </div>
  )
}

const s = {
  content: { padding: 16, paddingTop: 60, flex: 1, overflowY: 'auto' },
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
