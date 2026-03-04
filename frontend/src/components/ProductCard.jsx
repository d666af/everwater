import { useState } from 'react'
import { useCartStore } from '../store'

// Colour gradient placeholders by volume
const GRADIENTS = [
  'linear-gradient(135deg,#b7e4c7 0%,#52b788 100%)',
  'linear-gradient(135deg,#74c69d 0%,#2d6a4f 100%)',
  'linear-gradient(135deg,#d8f3dc 0%,#95d5b2 100%)',
  'linear-gradient(135deg,#a9def9 0%,#52b788 100%)',
]

export default function ProductCard({ product }) {
  const { addToCart, items, updateQuantity } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)
  const [imgError, setImgError] = useState(false)

  const gradient = GRADIENTS[product.id % GRADIENTS.length]
  const hasPhoto = product.photo_url && !imgError

  return (
    <div style={s.card}>
      {/* Image / Placeholder */}
      <div style={{ ...s.imgWrap, background: hasPhoto ? '#e8f5e9' : gradient }}>
        {hasPhoto ? (
          <img
            src={product.photo_url}
            alt={product.name}
            style={s.img}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={s.placeholder}>
            <div style={s.dropIcon}>💧</div>
            <div style={s.volBadge}>{product.volume} л</div>
          </div>
        )}
        {cartItem && (
          <div style={s.cartBadge}>{cartItem.quantity}</div>
        )}
      </div>

      {/* Body */}
      <div style={s.body}>
        <div style={s.name}>{product.name}</div>
        <div style={s.volume}>{product.volume} л</div>
        {product.description && (
          <div style={s.desc}>{product.description}</div>
        )}
        <div style={s.footer}>
          <div style={s.price}>{product.price.toLocaleString()} сум</div>
          {!cartItem ? (
            <button style={s.btn} onClick={() => addToCart(product)}>
              + Добавить
            </button>
          ) : (
            <div style={s.counter}>
              <button style={s.cBtn} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>−</button>
              <span style={s.qty}>{cartItem.quantity}</span>
              <button style={s.cBtn} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const C = 'var(--tg-theme-button-color, #2d6a4f)'
const s = {
  card: {
    background: 'var(--tg-theme-bg-color, #fff)',
    borderRadius: 16, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(45,106,79,0.1)',
    border: '1px solid #e8f5e9',
  },
  imgWrap: { position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  dropIcon: { fontSize: 42 },
  volBadge: {
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 10, padding: '3px 10px',
    fontSize: 13, fontWeight: 700, color: '#1b4332',
  },
  cartBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: '50%',
    background: C, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700,
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  body: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 },
  name: { fontWeight: 700, fontSize: 14, color: '#1b4332', lineHeight: 1.3 },
  volume: { color: '#74c69d', fontSize: 12, fontWeight: 600 },
  desc: { fontSize: 11, color: '#888', lineHeight: 1.4, flex: 1 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 4 },
  price: { fontWeight: 800, fontSize: 15, color: C },
  btn: {
    background: C, color: '#fff',
    border: 'none', borderRadius: 8, padding: '7px 12px',
    fontSize: 12, cursor: 'pointer', fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  counter: { display: 'flex', alignItems: 'center', gap: 6 },
  cBtn: {
    background: C, color: '#fff', border: 'none',
    borderRadius: 6, width: 28, height: 28,
    fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qty: { fontWeight: 800, fontSize: 15, minWidth: 18, textAlign: 'center', color: '#1b4332' },
}
