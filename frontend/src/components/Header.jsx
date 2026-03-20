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
            <path d="M15 18l-6-6 6-6" stroke="#212121" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <div style={st.logoWrap} onClick={() => navigate('/')}>
          <EverLogoMark width={36} style={{ borderRadius: 10 }} />
        </div>
      )}

      {title && <span style={st.title}>{title}</span>}
      {isRoot && <div style={{ flex: 1 }} />}

      {!isCart && (
        <button style={st.cartBtn} onClick={() => navigate('/cart')} aria-label="Корзина">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z" fill="#212121"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
    background: 'rgba(250,250,250,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    padding: '8px 20px',
    gap: 12,
    minHeight: 56,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    width: 40,
    height: 40,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 12,
    transition: 'background 0.15s',
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
    fontSize: 18,
    color: '#212121',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  cartBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    background: '#7CB342',
    color: '#fff',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    fontSize: 10,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
}
