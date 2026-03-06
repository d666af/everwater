import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const P = '#8DC63F'

function IconCatalog({ active }) {
  const c = active ? P : '#AAAAAA'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C12 2 4 10 4 15.5C4 19.6 7.6 23 12 23C16.4 23 20 19.6 20 15.5C20 10 12 2 12 2Z"
        fill={active ? '#E8F7D0' : '#F5F5F5'} stroke={c} strokeWidth="1.5"/>
      <path d="M8 16 Q10 13 12 12 Q14 13 16 16" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function IconOrders({ active }) {
  const c = active ? P : '#AAAAAA'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="3" fill={active ? '#E8F7D0' : '#F5F5F5'} stroke={c} strokeWidth="1.5"/>
      <path d="M7 9h10M7 13h6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconProfile({ active }) {
  const c = active ? P : '#AAAAAA'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill={active ? '#E8F7D0' : '#F5F5F5'} stroke={c} strokeWidth="1.5"/>
      <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconCart({ active, count }) {
  const c = active ? P : '#AAAAAA'
  return (
    <div style={{ position: 'relative' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          fill={active ? '#E8F7D0' : '#F5F5F5'} stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -6,
          background: '#E53935', color: '#fff',
          borderRadius: '50%', width: 16, height: 16,
          fontSize: 9, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #fff',
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

  const hidden = ['/cart', '/checkout'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
    || location.pathname.startsWith('/manager')
    || location.pathname === '/login'
  if (hidden) return null

  return (
    <>
      {/* Spacer so content doesn't hide behind nav */}
      <div style={{ height: 68 }} />
      <nav style={styles.nav}>
        <div style={styles.inner}>
          {NAV.map(({ path, label, Icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} style={styles.item} onClick={() => navigate(path)}>
                <Icon active={active} />
                <span style={{ ...styles.label, color: active ? P : '#AAAAAA' }}>{label}</span>
                {active && <span style={styles.activeDot} />}
              </button>
            )
          })}
          {/* Cart button */}
          <button
            style={styles.item}
            onClick={() => navigate('/cart')}
          >
            <IconCart active={location.pathname === '/cart'} count={totalQty} />
            <span style={{ ...styles.label, color: location.pathname === '/cart' ? P : '#AAAAAA' }}>
              Корзина
            </span>
            {location.pathname === '/cart' && <span style={styles.activeDot} />}
          </button>
        </div>
      </nav>
    </>
  )
}

const styles = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(0,0,0,0.06)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
  },
  inner: {
    display: 'flex', maxWidth: 480, margin: '0 auto',
  },
  item: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '10px 4px 6px', gap: 3, cursor: 'pointer',
    position: 'relative', transition: 'opacity 0.15s',
  },
  label: { fontSize: 10, fontWeight: 600, letterSpacing: 0.2 },
  activeDot: {
    position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
    width: 4, height: 4, borderRadius: '50%',
    background: P,
  },
}
