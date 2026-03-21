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
      {/* Image */}
      <div style={s.imgWrap}>
        {hasPhoto ? (
          <img src={product.photo_url} alt={product.name} style={s.img}
            onError={() => setImgError(true)} />
        ) : (
          <div style={s.placeholder}>
            <svg width="30" height="36" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill={C + '25'} stroke={C + '40'} strokeWidth="1.5"/>
            </svg>
          </div>
        )}
        <span style={s.badge}>{product.volume} л</span>
      </div>

      {/* Info */}
      <div style={s.info}>
        <div style={s.name}>{product.name}</div>
        {product.description && <div style={s.desc}>{product.description}</div>}
      </div>

      {/* Bottom: price + action */}
      <div style={s.bottom}>
        <div style={s.priceBlock}>
          <span style={s.price}>{product.price.toLocaleString()}</span>
          <span style={s.currency}> сум</span>
        </div>

        {!cartItem ? (
          <button style={s.addBtn} onClick={() => addToCart(product)} aria-label="Добавить">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        ) : (
          <div style={s.stepper}>
            <button style={s.stepBtn} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 12h14" stroke={C} strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
            <span style={s.qty}>{cartItem.quantity}</span>
            <button style={{ ...s.stepBtn, ...s.stepBtnPlus }} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  card: {
    background: '#fff', borderRadius: 18, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    transition: 'transform 0.15s',
  },
  imgWrap: {
    position: 'relative', width: '100%', aspectRatio: '1 / 0.85',
    overflow: 'hidden', background: '#f3f6ef',
  },
  img: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
  },
  badge: {
    position: 'absolute', top: 8, left: 8,
    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
    borderRadius: 8, padding: '3px 8px',
    fontSize: 11, fontWeight: 700, color: '#444',
  },
  info: {
    padding: '10px 12px 0', flex: 1,
  },
  name: {
    fontWeight: 700, fontSize: 14, color: '#1a1a1a',
    lineHeight: 1.25, letterSpacing: -0.2,
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  desc: {
    fontSize: 11, color: '#999', lineHeight: 1.35, marginTop: 3,
    display: '-webkit-box', WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  bottom: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px 10px',
  },
  priceBlock: { display: 'flex', alignItems: 'baseline' },
  price: { fontWeight: 800, fontSize: 16, color: '#1a1a1a', letterSpacing: -0.3 },
  currency: { fontWeight: 500, fontSize: 11, color: '#999' },
  addBtn: {
    width: 36, height: 36, borderRadius: 12,
    background: C, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: `0 2px 8px ${C}40`,
  },
  stepper: {
    display: 'flex', alignItems: 'center', gap: 0,
    borderRadius: 12, overflow: 'hidden',
    background: C + '12',
  },
  stepBtn: {
    width: 32, height: 32, border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  stepBtnPlus: {
    background: C, borderRadius: 10,
  },
  qty: {
    fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center',
    color: '#1a1a1a',
  },
}
