import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#7CB342'
const GRAY = '#9E9E9E'

const NAV = [
  { path: '/', label: 'Каталог', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={a ? C : GRAY} strokeWidth="1.8" fill={a ? C+'18' : 'none'} strokeLinejoin="round"/>
      <path d="M9 22V12h6v10" stroke={a ? C : GRAY} strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/orders', label: 'Заказы', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={a ? C : GRAY} strokeWidth="1.8" fill={a ? C+'18' : 'none'}/>
      <path d="M8 8h8M8 12h5M8 16h3" stroke={a ? C : GRAY} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/profile', label: 'Профиль', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={a ? C : GRAY} strokeWidth="1.8" fill={a ? C+'18' : 'none'}/>
      <path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke={a ? C : GRAY} strokeWidth="1.8" strokeLinecap="round"/>
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
      <div style={{ height: 88 }} />
      <nav style={st.nav}>
        <div style={st.inner}>
          {NAV.map(({ path, label, icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} style={st.item} onClick={() => navigate(path)} aria-label={label}>
                <div style={st.iconWrap}>
                  {icon(active)}
                </div>
                <span style={{ ...st.label, color: active ? C : GRAY, fontWeight: active ? 700 : 500 }}>
                  {label}
                </span>
              </button>
            )
          })}
          <button style={st.item} onClick={() => navigate('/cart')} aria-label="Корзина">
            <div style={st.iconWrap}>
              <div style={{ position: 'relative' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z" fill={location.pathname === '/cart' ? C : GRAY}/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke={location.pathname === '/cart' ? C : GRAY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {totalQty > 0 && (
                  <span style={st.badge}>{totalQty > 9 ? '9+' : totalQty}</span>
                )}
              </div>
            </div>
            <span style={{ ...st.label, color: location.pathname === '/cart' ? C : GRAY, fontWeight: location.pathname === '/cart' ? 700 : 500 }}>
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
    padding: '0 12px 0',
    paddingBottom: 'env(safe-area-inset-bottom, 8px)',
  },
  inner: {
    display: 'flex',
    maxWidth: 420,
    margin: '0 auto',
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 20,
    padding: '6px 4px 8px',
    boxShadow: '0 4px 30px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)',
    border: '1px solid rgba(255,255,255,0.6)',
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
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    background: '#EF5350',
    color: '#fff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    fontSize: 9,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  },
}
