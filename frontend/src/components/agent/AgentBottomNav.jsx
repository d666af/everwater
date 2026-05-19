import { useNavigate, useLocation } from 'react-router-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { useAdminRoleStore } from '../../store/adminRole'

const GRAD = 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'

const NAV = [
  {
    path: '/agent/checkout',
    label: 'Заказ',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    path: '/agent/orders',
    label: 'История',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 8h8M8 12h5M8 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function AgentBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { clearRole } = useAdminRoleStore()
  const hasMultipleRoles = user?.roles?.length > 1
  const itemRefs = useRef({})
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({})
  const [ready, setReady] = useState(false)

  const visible = location.pathname.startsWith('/agent')

  useLayoutEffect(() => {
    if (!visible) return
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
  }, [location.pathname, visible])

  if (!visible) return null

  return (
    <>
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
                <div style={{ ...st.iconWrap, color: active ? '#be185d' : 'rgba(255,255,255,0.85)' }}>
                  {icon}
                </div>
                <span style={{
                  ...st.label,
                  color: active ? '#be185d' : 'rgba(255,255,255,0.85)',
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
    boxShadow: '0 4px 24px rgba(190,24,93,0.35)',
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
    position: 'fixed', bottom: 106, right: 16, zIndex: 300,
    display: 'flex', alignItems: 'center', gap: 6,
    background: GRAD, color: '#fff',
    border: 'none', borderRadius: 20,
    padding: '8px 14px', fontSize: 12, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(190,24,93,0.3)',
  },
}
