import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'

const GRAD = 'linear-gradient(135deg, #9DD44D 0%, #6DBE1E 50%, #4FA812 100%)'

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
  const [ready, setReady] = useState(false)

  const hidden = ['/checkout'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname === '/login'

  // Calculate pill position — covers the entire button (icon + text)
  useLayoutEffect(() => {
    if (hidden) return
    const activeEl = itemRefs.current[location.pathname]
    const navEl = navRef.current
    if (activeEl && navEl) {
      const navRect = navEl.getBoundingClientRect()
      const itemRect = activeEl.getBoundingClientRect()
      setPillStyle({
        left: itemRect.left - navRect.left + 4,
        width: itemRect.width - 8,
      })
      if (!ready) setTimeout(() => setReady(true), 50)
    }
  }, [location.pathname, hidden])

  if (hidden) return null

  return (
    <>
      <div style={{ height: 84 }} />
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
    padding: '6px 0 8px',
    boxShadow: '0 4px 24px rgba(80,140,20,0.35)',
    position: 'relative',
  },
  pill: {
    position: 'absolute', top: 4, bottom: 4,
    borderRadius: 18,
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
}
