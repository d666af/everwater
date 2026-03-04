import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store'

const TITLES = {
  '/': '💧 Каталог',
  '/cart': '🛒 Корзина',
  '/checkout': '📝 Оформление',
  '/orders': '📦 Мои заказы',
  '/profile': '👤 Профиль',
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  // Скрываем на страницах admin и courier (у них свой layout/header)
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/courier')) {
    return null
  }

  const isRoot = location.pathname === '/'
  const isCart = location.pathname === '/cart'
  const title = TITLES[location.pathname] || ''

  return (
    <header style={styles.header}>
      {!isRoot && (
        <button style={styles.back} onClick={() => navigate(-1)} aria-label="Назад">
          ←
        </button>
      )}
      <span style={styles.title}>{title}</span>
      {!isCart && (
        <button style={styles.cart} onClick={() => navigate('/cart')} aria-label="Корзина">
          🛒
          {totalQty > 0 && <span style={styles.badge}>{totalQty}</span>}
        </button>
      )}
    </header>
  )
}

const styles = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'var(--tg-theme-bg-color, #fff)',
    borderBottom: '1px solid var(--tg-theme-hint-color, #e0e0e0)',
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', gap: 12,
  },
  back: {
    background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
    color: 'var(--tg-theme-text-color, #000)', padding: '0 4px', lineHeight: 1,
  },
  title: { flex: 1, fontWeight: 700, fontSize: 18 },
  cart: {
    background: 'none', border: 'none', fontSize: 22,
    cursor: 'pointer', position: 'relative', padding: '0 4px',
  },
  badge: {
    position: 'absolute', top: -6, right: -6,
    background: '#e53935', color: '#fff',
    borderRadius: '50%', width: 18, height: 18,
    fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
