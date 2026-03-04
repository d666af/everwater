import { useCartStore } from '../store'

export default function ProductCard({ product }) {
  const { addToCart, items, updateQuantity, removeFromCart } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)

  return (
    <div style={styles.card}>
      {product.photo_url && (
        <img src={product.photo_url} alt={product.name} style={styles.img} />
      )}
      <div style={styles.body}>
        <div style={styles.name}>{product.name}</div>
        <div style={styles.volume}>{product.volume} л</div>
        {product.description && <div style={styles.desc}>{product.description}</div>}
        <div style={styles.footer}>
          <div style={styles.price}>{product.price} ₽</div>
          {!cartItem ? (
            <button style={styles.btn} onClick={() => addToCart(product)}>
              + В корзину
            </button>
          ) : (
            <div style={styles.counter}>
              <button style={styles.counterBtn} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>−</button>
              <span style={styles.qty}>{cartItem.quantity}</span>
              <button style={styles.counterBtn} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  img: { width: '100%', height: 160, objectFit: 'cover' },
  body: { padding: '12px' },
  name: { fontWeight: 600, fontSize: 16, marginBottom: 4 },
  volume: { color: '#888', fontSize: 13, marginBottom: 4 },
  desc: { fontSize: 13, color: '#666', marginBottom: 8 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontWeight: 700, fontSize: 18, color: 'var(--tg-theme-button-color, #2481cc)' },
  btn: {
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: 'var(--tg-theme-button-text-color, #fff)',
    border: 'none', borderRadius: 8, padding: '8px 14px',
    fontSize: 14, cursor: 'pointer', fontWeight: 600,
  },
  counter: { display: 'flex', alignItems: 'center', gap: 10 },
  counterBtn: {
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: '#fff', border: 'none', borderRadius: 6,
    width: 30, height: 30, fontSize: 18, cursor: 'pointer',
  },
  qty: { fontWeight: 700, fontSize: 16, minWidth: 20, textAlign: 'center' },
}
