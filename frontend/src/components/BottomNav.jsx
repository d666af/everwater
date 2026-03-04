import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const NAV_ITEMS = [
  { path: '/', label: 'Каталог', icon: '💧' },
  { path: '/orders', label: 'Заказы', icon: '📦' },
  { path: '/profile', label: 'Профиль', icon: '👤' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  // Не показываем на страницах корзины, чекаута, деталей заказа, admin, courier
  const hidden = ['/cart', '/checkout'].some(p => location.pathname.startsWith(p))
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/courier')
  if (hidden) return null

  return (
    <nav style={styles.nav}>
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.path
        return (
          <button
            key={item.path}
            style={{ ...styles.item, ...(active ? styles.active : {}) }}
            onClick={() => navigate(item.path)}
          >
            <span style={styles.icon}>{item.icon}</span>
            <span style={styles.label}>{item.label}</span>
            {active && <span style={styles.dot} />}
          </button>
        )
      })}
      <button
        style={{ ...styles.item, ...(location.pathname === '/cart' ? styles.active : {}) }}
        onClick={() => navigate('/cart')}
      >
        <span style={styles.icon}>
          🛒
          {totalQty > 0 && <span style={styles.badge}>{totalQty}</span>}
        </span>
        <span style={styles.label}>Корзина</span>
        {location.pathname === '/cart' && <span style={styles.dot} />}
      </button>
    </nav>
  )
}

const styles = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
    background: 'var(--tg-theme-bg-color, #fff)',
    borderTop: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
    display: 'flex',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  item: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '8px 4px', gap: 2, cursor: 'pointer',
    color: 'var(--tg-theme-hint-color, #999)',
    position: 'relative',
    fontSize: 10,
  },
  active: {
    color: 'var(--tg-theme-button-color, #2481cc)',
  },
  icon: { fontSize: 22, position: 'relative', lineHeight: 1 },
  label: { fontSize: 10, fontWeight: 500 },
  dot: {
    position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
    width: 4, height: 4, borderRadius: '50%',
    background: 'var(--tg-theme-button-color, #2481cc)',
  },
  badge: {
    position: 'absolute', top: -4, right: -8,
    background: '#e53935', color: '#fff',
    borderRadius: '50%', width: 16, height: 16,
    fontSize: 10, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
}
