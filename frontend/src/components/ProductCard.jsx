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
            <svg width="28" height="34" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill="rgba(141,198,63,0.15)" stroke="rgba(141,198,63,0.3)" strokeWidth="1.5"/>
            </svg>
          </div>
        )}
      </div>

      <div style={s.body}>
        <div style={s.top}>
          <div style={s.name}>{product.name}</div>
          <span style={s.volBadge}>{product.volume} л</span>
        </div>
        {product.description && <div style={s.desc}>{product.description}</div>}

        <div style={s.footer}>
          <div style={s.price}>
            {product.price.toLocaleString()}
            <span style={s.currency}> сум</span>
          </div>
          {!cartItem ? (
            <button style={s.addBtn} onClick={() => addToCart(product)}>
              В корзину
            </button>
          ) : (
            <div style={s.counter}>
              <button style={s.cBtn} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>−</button>
              <span style={s.qty}>{cartItem.quantity}</span>
              <button style={{ ...s.cBtn, ...s.cBtnPlus }} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>+</button>
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
    display: 'flex', flexDirection: 'row', alignItems: 'stretch',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  imgArea: {
    width: 110, minHeight: 110, flexShrink: 0,
    overflow: 'hidden', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f5f5f7',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
  },
  body: {
    padding: '12px 14px', display: 'flex', flexDirection: 'column',
    flex: 1, minWidth: 0,
  },
  top: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  name: {
    fontWeight: 700, fontSize: 15, color: '#111', lineHeight: 1.3,
    flex: 1, minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  volBadge: {
    background: '#f0f0f2', borderRadius: 8,
    padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#666',
    flexShrink: 0,
  },
  desc: {
    fontSize: 12, color: '#999', lineHeight: 1.4, marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  footer: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 'auto', paddingTop: 8,
  },
  price: { fontWeight: 800, fontSize: 16, color: '#111', letterSpacing: -0.3 },
  currency: { fontWeight: 400, fontSize: 12, color: '#888' },
  addBtn: {
    background: C, border: 'none', borderRadius: 10,
    padding: '7px 14px', fontSize: 13, fontWeight: 700, color: '#fff',
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  },
  counter: {
    display: 'flex', alignItems: 'center', background: '#f2f2f3',
    borderRadius: 10, overflow: 'hidden',
  },
  cBtn: {
    background: 'none', border: 'none', width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#888', fontSize: 17, fontWeight: 700,
  },
  cBtnPlus: { color: C },
  qty: { fontWeight: 700, fontSize: 14, minWidth: 22, textAlign: 'center', color: '#111' },
}
