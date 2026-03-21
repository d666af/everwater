import { useState } from 'react'
import { useCartStore } from '../store'

const C = '#8DC63F'

export default function ProductCard({ product }) {
  const { addToCart, items, updateQuantity } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)
  const [imgError, setImgError] = useState(false)
  const hasPhoto = product.photo_url && !imgError

  return (
    <div style={s.card}>
      <div style={s.imgArea}>
        {hasPhoto ? (
          <img src={product.photo_url} alt={product.name} style={s.img} onError={() => setImgError(true)} />
        ) : (
          <div style={s.placeholder}>
            <svg width="32" height="38" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill="rgba(141,198,63,0.2)" />
            </svg>
          </div>
        )}
        <span style={s.volBadge}>{product.volume} л</span>
        {cartItem && <span style={s.qtyBadge}>{cartItem.quantity}</span>}
      </div>

      <div style={s.body}>
        <div style={s.name}>{product.name}</div>
        {product.description && <div style={s.desc}>{product.description}</div>}

        <div style={s.footer}>
          <div style={s.price}>
            {product.price.toLocaleString()}
            <span style={s.currency}> сум</span>
          </div>
          {!cartItem ? (
            <button style={s.addBtn} onClick={() => addToCart(product)} aria-label="Добавить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
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

const s = {
  card: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', border: '1px solid #f0f0f0',
  },
  imgArea: {
    position: 'relative', width: '100%', aspectRatio: '1 / 0.8',
    overflow: 'hidden', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f5f8f0',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
  },
  volBadge: {
    position: 'absolute', top: 8, left: 8,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#fff',
  },
  qtyBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 24, height: 24, borderRadius: 8, background: C,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700,
  },
  body: { padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  name: { fontWeight: 700, fontSize: 14, color: '#1a1a1a', lineHeight: 1.3 },
  desc: {
    fontSize: 12, color: '#888', lineHeight: 1.4,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 },
  price: { fontWeight: 800, fontSize: 15, color: '#1a1a1a', letterSpacing: -0.3 },
  currency: { fontWeight: 400, fontSize: 12, color: '#888' },
  addBtn: {
    background: C, border: 'none', borderRadius: 10,
    width: 36, height: 36, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  counter: {
    display: 'flex', alignItems: 'center', background: '#f2f2f3',
    borderRadius: 10, overflow: 'hidden',
  },
  cBtn: {
    background: C, border: 'none', width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700,
  },
  qty: { fontWeight: 700, fontSize: 14, minWidth: 26, textAlign: 'center', color: '#1a1a1a' },
}
