import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#8DC63F'

const NAV = [
  { path: '/', label: 'Главная', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'18' : 'none'} strokeLinejoin="round"/>
      <path d="M9 22V12h6v10" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  )},
  { path: '/cart', label: 'Корзина', icon: (a, badge) => (
    <div style={{ position: 'relative' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'18' : 'none'} strokeLinejoin="round"/>
        <path d="M3 6h18" stroke={a ? C : '#bbb'} strokeWidth="1.8"/>
        <path d="M16 10a4 4 0 01-8 0" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -8,
          background: '#ff3b30', color: '#fff', borderRadius: 8,
          minWidth: 16, height: 16, fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px', border: '2px solid #fff',
        }}>{badge > 9 ? '9+' : badge}</span>
      )}
    </div>
  )},
  { path: '/orders', label: 'Заказы', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'18' : 'none'}/>
      <path d="M8 8h8M8 12h5M8 16h3" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/support', label: 'Поддержка', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'18' : 'none'} strokeLinejoin="round"/>
      <path d="M8 9h8M8 13h5" stroke={a ? C : '#bbb'} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
  { path: '/profile', label: 'Профиль', icon: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={a ? C : '#bbb'} strokeWidth="1.8" fill={a ? C+'18' : 'none'}/>
      <path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6" stroke={a ? C : '#bbb'} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )},
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const hidden = ['/checkout'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname === '/login'
  if (hidden) return null

  return (
    <>
      <div style={{ height: 76 }} />
      <nav style={st.nav}>
        <div style={st.inner}>
          {NAV.map(({ path, label, icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} style={st.item} onClick={() => navigate(path)} aria-label={label}>
                <div style={active ? st.activeIconWrap : st.iconWrap}>
                  {path === '/cart' ? icon(active, totalQty) : icon(active)}
                </div>
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
    padding: '0 6px', paddingBottom: 'env(safe-area-inset-bottom, 4px)',
  },
  inner: {
    display: 'flex', maxWidth: 420, margin: '0 auto',
    background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)', borderRadius: 20,
    padding: '4px 0 6px',
    boxShadow: '0 -1px 0 rgba(0,0,0,0.03), 0 4px 24px rgba(0,0,0,0.08)',
  },
  item: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 0 0', gap: 1, cursor: 'pointer',
  },
  iconWrap: {
    width: 40, height: 32, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  activeIconWrap: {
    width: 48, height: 32, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C + '18',
    border: `1.5px solid ${C}40`,
  },
  label: { fontSize: 9, letterSpacing: 0.2 },
}
