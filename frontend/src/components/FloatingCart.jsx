import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#8DC63F'

export default function FloatingCart() {
  const navigate = useNavigate()
  const items = useCartStore(s => s.items)
  const total = useCartStore(s => s.total())
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  if (totalQty === 0) return null

  return (
    <div style={s.wrap}>
      <button style={s.bar} onClick={() => navigate('/cart')}>
        <div style={s.left}>
          <div style={s.badge}>{totalQty}</div>
          <span style={s.text}>Корзина</span>
        </div>
        <span style={s.total}>{total.toLocaleString()} сум</span>
      </button>
    </div>
  )
}

const s = {
  wrap: {
    position: 'fixed', bottom: 82, left: 0, right: 0, zIndex: 199,
    padding: '0 16px',
    pointerEvents: 'none',
  },
  bar: {
    maxWidth: 420, margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#1a1a1a', borderRadius: 16, padding: '14px 18px',
    border: 'none', cursor: 'pointer', width: '100%',
    pointerEvents: 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  },
  left: { display: 'flex', alignItems: 'center', gap: 10 },
  badge: {
    background: C, color: '#fff', borderRadius: 10,
    minWidth: 24, height: 24, fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 6px',
  },
  text: { color: '#fff', fontSize: 15, fontWeight: 600 },
  total: { color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: -0.3 },
}
