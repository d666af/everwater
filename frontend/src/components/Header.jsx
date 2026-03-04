import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <header style={styles.header}>
      {location.pathname !== '/' && (
        <button style={styles.back} onClick={() => navigate(-1)}>←</button>
      )}
      <span style={styles.title}>
        {location.pathname === '/' && '💧 Каталог'}
        {location.pathname === '/cart' && '🛒 Корзина'}
        {location.pathname === '/checkout' && '📝 Оформление'}
        {location.pathname === '/orders' && '📦 Мои заказы'}
      </span>
      {location.pathname !== '/cart' && (
        <button style={styles.cart} onClick={() => navigate('/cart')}>
          🛒 {totalQty > 0 && <span style={styles.badge}>{totalQty}</span>}
        </button>
      )}
    </header>
  )
}

const styles = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'var(--tg-theme-bg-color, #fff)',
    borderBottom: '1px solid var(--tg-theme-hint-color, #ddd)',
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', gap: 12,
  },
  back: {
    background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
    color: 'var(--tg-theme-text-color, #000)',
  },
  title: { flex: 1, fontWeight: 700, fontSize: 18 },
  cart: {
    background: 'none', border: 'none', fontSize: 22,
    cursor: 'pointer', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -6, right: -6,
    background: 'red', color: '#fff',
    borderRadius: '50%', width: 18, height: 18,
    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
