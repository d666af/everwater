import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'
import { EverLogoMark } from './EverLogo'

const TITLES = {
  '/cart': 'Корзина',
  '/checkout': 'Оформление',
  '/orders': 'Заказы',
  '/profile': 'Профиль',
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  if (location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname.startsWith('/support')) {
    return null
  }

  const isRoot = location.pathname === '/'
  const isCart = location.pathname === '/cart'
  const title = TITLES[location.pathname]

  return (
    <header style={st.header}>
      {!isRoot ? (
        <button style={st.backBtn} onClick={() => navigate(-1)} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <div style={st.logoWrap} onClick={() => navigate('/')}>
          <EverLogoMark width={34} style={{ borderRadius: 10 }} />
        </div>
      )}

      {title && <span style={st.title}>{title}</span>}
      {isRoot && <div style={{ flex: 1 }} />}

      {!isCart && (
        <button style={st.cartBtn} onClick={() => navigate('/cart')} aria-label="Корзина">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z" fill="#111"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {totalQty > 0 && <span style={st.badge}>{totalQty > 9 ? '9+' : totalQty}</span>}
        </button>
      )}
    </header>
  )
}

const st = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(250,250,250,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    gap: 10,
    minHeight: 52,
    borderBottom: '1px solid rgba(0,0,0,0.04)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    width: 38,
    height: 38,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 10,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontWeight: 700,
    fontSize: 17,
    color: '#111',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  cartBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    background: '#4CAF50',
    color: '#fff',
    borderRadius: 8,
    minWidth: 17,
    height: 17,
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
}
