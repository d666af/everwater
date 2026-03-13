import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#8DC63F'
const TEXT2 = '#8E8E93'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

function IconCatalog({ active }) {
  const stroke = active ? C : TEXT2
  const fill = active ? 'rgba(141,198,63,0.12)' : 'none'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C12 2 4 10 4 15.5C4 19.6 7.6 23 12 23C16.4 23 20 19.6 20 15.5C20 10 12 2 12 2Z"
        fill={fill} stroke={stroke} strokeWidth="1.7"/>
      <path d="M8 16 Q10 13 12 12 Q14 13 16 16"
        stroke={stroke} strokeWidth="1.7" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function IconOrders({ active }) {
  const stroke = active ? C : TEXT2
  const fill = active ? 'rgba(141,198,63,0.12)' : 'none'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="3"
        fill={fill} stroke={stroke} strokeWidth="1.7"/>
      <path d="M7 9h10M7 13h7M7 17h4"
        stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}

function IconProfile({ active }) {
  const stroke = active ? C : TEXT2
  const fill = active ? 'rgba(141,198,63,0.12)' : 'none'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill={fill} stroke={stroke} strokeWidth="1.7"/>
      <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20"
        stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}

function IconCart({ active, count }) {
  const stroke = active ? C : TEXT2
  const fill = active ? 'rgba(141,198,63,0.12)' : 'none'
  return (
    <div style={{ position: 'relative' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          fill={fill} stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M3 6h18M16 10a4 4 0 01-8 0"
          stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
      {count > 0 && (
        <span style={{
          position: 'absolute',
          top: -4,
          right: -6,
          background: '#FF3B30',
          color: '#fff',
          borderRadius: '50%',
          minWidth: 16,
          height: 16,
          fontSize: 9,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1.5px solid #fff',
          padding: '0 2px',
        }}>{count > 9 ? '9+' : count}</span>
      )}
    </div>
  )
}

const NAV = [
  { path: '/', label: 'Каталог', Icon: IconCatalog },
  { path: '/orders', label: 'Заказы', Icon: IconOrders },
  { path: '/profile', label: 'Профиль', Icon: IconProfile },
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
      {/* Spacer so content doesn't hide behind nav */}
      <div style={{ height: 72 }} />
      <nav style={styles.nav}>
        <div style={styles.inner}>
          {NAV.map(({ path, label, Icon }) => {
            const active = location.pathname === path
            return (
              <button
                key={path}
                style={styles.item}
                onClick={() => navigate(path)}
                aria-label={label}
              >
                <div style={styles.iconWrap}>
                  <Icon active={active} />
                  {active && <div style={styles.activeIndicator} />}
                </div>
                <span style={{
                  ...styles.label,
                  color: active ? C : TEXT2,
                  fontWeight: active ? 700 : 500,
                }}>{label}</span>
              </button>
            )
          })}
          {/* Cart button */}
          <button
            style={styles.item}
            onClick={() => navigate('/cart')}
            aria-label="Корзина"
          >
            <div style={styles.iconWrap}>
              <IconCart active={location.pathname === '/cart'} count={totalQty} />
              {location.pathname === '/cart' && <div style={styles.activeIndicator} />}
            </div>
            <span style={{
              ...styles.label,
              color: location.pathname === '/cart' ? C : TEXT2,
              fontWeight: location.pathname === '/cart' ? 700 : 500,
            }}>Корзина</span>
          </button>
        </div>
      </nav>
    </>
  )
}

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(60,60,67,0.12)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  inner: {
    display: 'flex',
    maxWidth: 480,
    margin: '0 auto',
  },
  item: {
    flex: 1,
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 4px 8px',
    gap: 3,
    cursor: 'pointer',
    transition: TRANSITION,
    WebkitTapHighlightColor: 'transparent',
  },
  iconWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: C,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
    lineHeight: 1,
  },
}
