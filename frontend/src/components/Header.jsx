import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const TITLES = {
  '/cart': 'Корзина',
  '/checkout': 'Оформление заказа',
  '/orders': 'Мои заказы',
  '/profile': 'Профиль',
}

// Everwater logo inline
function EverMark({ size = 26 }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 102" fill="none">
      <path d="M60 8 C48 8 14 28 10 52 C8 64 18 72 30 68 C42 64 54 44 60 36" fill="#8DC63F"/>
      <path d="M60 36 C66 44 78 64 90 68 C102 72 112 64 110 52 C106 28 72 8 60 8" fill="#6CA32F"/>
      <path d="M60 36 L60 88" stroke="#8DC63F" strokeWidth="5" strokeLinecap="round"/>
      <path d="M46 88 Q60 82 74 88" stroke="#8DC63F" strokeWidth="4" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  // Hide on admin/courier/manager pages (they have their own layout)
  if (location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')) {
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <div style={styles.logoWrap} onClick={() => navigate('/')}>
          <EverMark size={28} />
          <span style={styles.logoText}>ever</span>
        </div>
      )}

      {/* Center title */}
      {title && <span style={styles.title}>{title}</span>}
      {isRoot && <div style={{ flex: 1 }} />}

      {/* Right: cart */}
      {!isCart && (
        <button style={styles.cartBtn} onClick={() => navigate('/cart')} aria-label="Корзина">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#1A1A1A" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {totalQty > 0 && <span style={styles.badge}>{totalQty}</span>}
        </button>
      )}
    </header>
  )
}

const styles = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid #F0F0F0',
    display: 'flex', alignItems: 'center',
    padding: '10px 16px', gap: 12, minHeight: 56,
  },
  backBtn: {
    background: '#F5F5F5', border: 'none', borderRadius: 10,
    width: 36, height: 36, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    flexShrink: 0,
  },
  logoText: { fontSize: 22, fontWeight: 900, color: '#1A1A1A', letterSpacing: -0.5 },
  title: {
    flex: 1, fontWeight: 700, fontSize: 17, color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  cartBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    position: 'relative', padding: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: 'auto',
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    background: '#8DC63F', color: '#fff',
    borderRadius: '50%', width: 18, height: 18,
    fontSize: 10, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid #fff',
  },
}
