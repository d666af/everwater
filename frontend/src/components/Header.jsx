import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'
import { EverLogoMark } from './EverLogo'

const C = '#8DC63F'

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

  if (['/admin', '/courier', '/manager', '/support'].some(p => location.pathname.startsWith(p))) return null

  const isRoot = location.pathname === '/'
  const isCart = location.pathname === '/cart'
  const title = TITLES[location.pathname]

  return (
    <header style={st.header}>
      {!isRoot ? (
        <button style={st.backBtn} onClick={() => navigate(-1)} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ) : (
        <div style={st.logoWrap} onClick={() => navigate('/')}>
          <EverLogoMark width={80} style={{ borderRadius: 16 }} />
        </div>
      )}

      {title && <span style={st.title}>{title}</span>}
      {isRoot && <div style={{ flex: 1 }} />}

      {!isCart && (
        <button style={st.cartBtn} onClick={() => navigate('/cart')} aria-label="Корзина">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round"/>
            <path d="M3 6h18" stroke="#fff" strokeWidth="1.7"/>
            <path d="M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
          {totalQty > 0 && <span style={st.badge}>{totalQty > 9 ? '9+' : totalQty}</span>}
        </button>
      )}
    </header>
  )
}

const st = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(250,250,250,0.9)', backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', padding: '6px 16px',
    gap: 10, minHeight: 56, borderBottom: '1px solid rgba(0,0,0,0.04)',
  },
  backBtn: {
    background: 'none', border: 'none', width: 38, height: 38,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, borderRadius: 10,
  },
  logoWrap: { display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 },
  title: {
    flex: 1, fontWeight: 700, fontSize: 17, color: '#1a1a1a',
    letterSpacing: -0.3, textAlign: 'center',
  },
  cartBtn: {
    background: '#1a1a1a', border: 'none', cursor: 'pointer',
    position: 'relative', padding: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: 'auto', borderRadius: 14,
    width: 42, height: 42,
    boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    background: C, color: '#fff', borderRadius: 9,
    minWidth: 18, height: 18, fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
    border: '2px solid #fff',
  },
}
