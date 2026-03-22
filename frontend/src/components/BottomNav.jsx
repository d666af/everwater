import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

const C = '#8DC63F'

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
  { path: '/support', label: 'Поддержка', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
  const itemRefs = useRef({})
  const navRef = useRef(null)
  const [pillStyle, setPillStyle] = useState({})

  const hidden = ['/checkout'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname === '/login'

  // Calculate pill position
  useEffect(() => {
    if (hidden) return
    const activeEl = itemRefs.current[location.pathname]
    const navEl = navRef.current
    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect()
      const itemRect = activeEl.getBoundingClientRect()
      setPillStyle({
        left: itemRect.left - navRect.left + (itemRect.width - 52) / 2,
        width: 52,
      })
    }
  }, [location.pathname, hidden])

  if (hidden) return null

  return (
    <>
      <div style={{ height: 76 }} />
      <nav style={st.nav}>
        <div style={st.inner} ref={navRef}>
          {/* Animated pill */}
          <div style={{
            ...st.pill,
            left: pillStyle.left ?? 0,
            width: pillStyle.width ?? 52,
            opacity: pillStyle.width ? 1 : 0,
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
                <div style={{ ...st.iconWrap, color: active ? '#1a1a1a' : 'rgba(0,0,0,0.4)' }}>
                  {icon}
                </div>
                <span style={{
                  ...st.label,
                  color: active ? '#1a1a1a' : 'rgba(0,0,0,0.4)',
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
    padding: '0 6px', paddingBottom: 'env(safe-area-inset-bottom, 4px)',
  },
  inner: {
    display: 'flex', maxWidth: 420, margin: '0 auto',
    background: C, borderRadius: 22,
    padding: '4px 0 6px',
    boxShadow: `0 4px 24px rgba(141,198,63,0.3)`,
    position: 'relative',
  },
  pill: {
    position: 'absolute', top: 4, height: 32,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.3)',
    border: '2px solid rgba(255,255,255,0.7)',
    transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
  },
  item: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 0 0', gap: 1, cursor: 'pointer',
    position: 'relative', zIndex: 1,
  },
  iconWrap: {
    width: 40, height: 32, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.25s ease',
  },
  label: {
    fontSize: 9, letterSpacing: 0.2,
    transition: 'color 0.25s ease',
  },
}
