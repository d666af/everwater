import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'
import EverLogo from './EverLogo'

const TITLES = {
  '/cart': 'Корзина',
  '/checkout': 'Оформление',
  '/orders': 'Мои заказы',
  '/profile': 'Профиль',
}

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  // Hide on admin/courier/manager pages
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
    <header style={styles.header}>
      {/* Left: back or logo */}
      {!isRoot ? (
        <button style={styles.backBtn} onClick={() => navigate(-1)} aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <div style={styles.logoWrap} onClick={() => navigate('/')}>
          <EverLogo width={72} />
        </div>
      )}

      {/* Center title */}
      {title && <span style={styles.title}>{title}</span>}
      {isRoot && <div style={{ flex: 1 }} />}

      {/* Right: cart icon (on non-cart pages) */}
      {!isCart && (
        <button style={styles.cartBtn} onClick={() => navigate('/cart')} aria-label="Корзина">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              stroke={TEXT} strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
            <path d="M3 6h18M16 10a4 4 0 01-8 0"
              stroke={TEXT} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {totalQty > 0 && <span style={styles.badge}>{totalQty > 9 ? '9+' : totalQty}</span>}
        </button>
      )}
    </header>
  )
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: `1px solid ${BORDER}`,
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    gap: 12,
    minHeight: 56,
  },
  backBtn: {
    background: 'rgba(118,118,128,0.12)',
    border: 'none',
    borderRadius: 50,
    width: 34,
    height: 34,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: TRANSITION,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    lineHeight: 1,
  },
  title: {
    flex: 1,
    fontWeight: 600,
    fontSize: 17,
    color: TEXT,
    letterSpacing: -0.3,
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
    transition: TRANSITION,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    background: C,
    color: '#fff',
    borderRadius: '50%',
    minWidth: 18,
    height: 18,
    fontSize: 10,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #fff',
    padding: '0 2px',
  },
}
