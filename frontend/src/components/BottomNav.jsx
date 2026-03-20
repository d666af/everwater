import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const NAV = [
  { path: '/', label: 'Каталог', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={a ? '#111' : '#bbb'} strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
      <path d="M9 22V12h6v10" stroke={a ? '#111' : '#bbb'} strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/orders', label: 'Заказы', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={a ? '#111' : '#bbb'} strokeWidth="1.8" fill="none"/>
      <path d="M8 8h8M8 12h5M8 16h3" stroke={a ? '#111' : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/profile', label: 'Профиль', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={a ? '#111' : '#bbb'} strokeWidth="1.8" fill="none"/>
      <path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke={a ? '#111' : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
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

  const isCartActive = location.pathname === '/cart'

  return (
    <>
      <div style={{ height: 76 }} />
      <nav style={st.nav}>
        <div style={st.inner}>
          {NAV.map(({ path, label, icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} style={st.item} onClick={() => navigate(path)} aria-label={label}>
                {icon(active)}
                <span style={{ ...st.label, color: active ? '#111' : '#bbb', fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
              </button>
            )
          })}
          <button style={st.item} onClick={() => navigate('/cart')} aria-label="Корзина">
            <div style={{ position: 'relative' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z" fill={isCartActive ? '#111' : '#bbb'}/>
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke={isCartActive ? '#111' : '#bbb'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {totalQty > 0 && <span style={st.badge}>{totalQty > 9 ? '9+' : totalQty}</span>}
            </div>
            <span style={{ ...st.label, color: isCartActive ? '#111' : '#bbb', fontWeight: isCartActive ? 600 : 400 }}>
              Корзина
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}

const st = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    padding: '0 8px',
    paddingBottom: 'env(safe-area-inset-bottom, 6px)',
  },
  inner: {
    display: 'flex',
    maxWidth: 420,
    margin: '0 auto',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 18,
    padding: '4px 0 6px',
    boxShadow: '0 -1px 0 rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  item: {
    flex: 1,
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 0 2px',
    gap: 2,
    cursor: 'pointer',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    background: '#ef4444',
    color: '#fff',
    borderRadius: 7,
    minWidth: 15,
    height: 15,
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  },
}
