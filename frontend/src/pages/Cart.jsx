import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCartStore()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: 48 }}>🛒</div>
        <div>Корзина пуста</div>
        <button style={styles.btn} onClick={() => navigate('/')}>В каталог</button>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.list}>
        {items.map(({ product, quantity }) => (
          <div key={product.id} style={styles.item}>
            <div style={styles.itemInfo}>
              <div style={styles.itemName}>{product.name}</div>
              <div style={styles.itemPrice}>{product.price} ₽/шт</div>
            </div>
            <div style={styles.itemControls}>
              <div style={styles.counter}>
                <button style={styles.cb} onClick={() => updateQuantity(product.id, quantity - 1)}>−</button>
                <span style={styles.qty}>{quantity}</span>
                <button style={styles.cb} onClick={() => updateQuantity(product.id, quantity + 1)}>+</button>
              </div>
              <div style={styles.itemTotal}>{product.price * quantity} ₽</div>
              <button style={styles.del} onClick={() => removeFromCart(product.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.summary}>
        <div style={styles.totalRow}>
          <span>Итого:</span>
          <span style={styles.totalAmt}>{total()} ₽</span>
        </div>
        <button style={styles.btn} onClick={() => navigate('/checkout')}>
          Оформить заказ
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  list: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  item: {
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 12, padding: 12,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  itemInfo: { display: 'flex', justifyContent: 'space-between' },
  itemName: { fontWeight: 600, fontSize: 15 },
  itemPrice: { color: '#888', fontSize: 13 },
  itemControls: { display: 'flex', alignItems: 'center', gap: 12 },
  counter: { display: 'flex', alignItems: 'center', gap: 8 },
  cb: {
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: '#fff', border: 'none', borderRadius: 6,
    width: 28, height: 28, fontSize: 16, cursor: 'pointer',
  },
  qty: { fontWeight: 700, minWidth: 24, textAlign: 'center' },
  itemTotal: { fontWeight: 700, fontSize: 15, marginLeft: 'auto' },
  del: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' },
  summary: {
    borderTop: '1px solid var(--tg-theme-hint-color, #ddd)',
    padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
  },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 18 },
  totalAmt: { fontWeight: 700, color: 'var(--tg-theme-button-color, #2481cc)' },
  btn: {
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: 'var(--tg-theme-button-text-color, #fff)',
    border: 'none', borderRadius: 12, padding: '14px 0',
    fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, height: '70vh',
    color: '#888', fontSize: 16,
  },
}
