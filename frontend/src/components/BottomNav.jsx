import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#8DC63F'

const NAV = [
  { path: '/', label: 'Каталог', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'20' : 'none'} strokeLinejoin="round"/>
      <path d="M9 22V12h6v10" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/orders', label: 'Заказы', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'20' : 'none'}/>
      <path d="M8 8h8M8 12h5M8 16h3" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/support', label: 'Помощь', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'20' : 'none'} strokeLinejoin="round"/>
      <path d="M8 9h8M8 13h5" stroke={a ? C : '#bbb'} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/profile', label: 'Профиль', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'20' : 'none'}/>
      <path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const hidden = ['/cart', '/checkout', '/support'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname === '/login'
  if (hidden) return null

  return (
    <>
      <div style={{ height: 80 }} />
      <nav style={st.nav}>
        <div style={st.inner}>
          {NAV.map(({ path, label, icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} style={st.item} onClick={() => navigate(path)} aria-label={label}>
                {icon(active)}
                <span style={{ ...st.label, color: active ? C : '#bbb', fontWeight: active ? 700 : 400 }}>
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
    padding: '0 8px', paddingBottom: 'env(safe-area-inset-bottom, 6px)',
  },
  inner: {
    display: 'flex', maxWidth: 420, margin: '0 auto',
    background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)', borderRadius: 20,
    padding: '6px 0 8px',
    boxShadow: '0 -1px 0 rgba(0,0,0,0.03), 0 4px 24px rgba(0,0,0,0.08)',
  },
  item: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 0 0', gap: 2, cursor: 'pointer',
  },
  label: { fontSize: 10, letterSpacing: 0.2 },
}
