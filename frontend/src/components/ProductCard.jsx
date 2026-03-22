import { useState } from 'react'
import { useCartStore } from '../store'

const C = '#8DC63F'

export default function ProductCard({ product }) {
  const { addToCart, items, updateQuantity } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)
  const [imgError, setImgError] = useState(false)
  const hasPhoto = product.photo_url && !imgError
  const isCarbonated = product.type === 'carbonated' || product.name?.toLowerCase().includes('газированн')

  return (
    <div style={s.card}>
      {/* Image */}
      <div style={s.imgWrap}>
        {hasPhoto ? (
          <img src={product.photo_url} alt={product.name} style={s.img}
            onError={() => setImgError(true)} />
        ) : (
          <div style={s.placeholder}>
            <svg width="36" height="42" viewBox="0 0 40 48" fill="none">
              <path d="M20 4C20 4 6 18 6 28C6 38.5 12 44 20 44C28 44 34 38.5 34 28C34 18 20 4 20 4Z"
                fill={C} opacity="0.15"/>
              <path d="M20 4C20 4 6 18 6 28C6 38.5 12 44 20 44C28 44 34 38.5 34 28C34 18 20 4 20 4Z"
                stroke={C} strokeWidth="1.5" opacity="0.3"/>
            </svg>
          </div>
        )}
        {/* Badge only for carbonated water */}
        {isCarbonated && (
          <div style={s.carbTag}>
            <span style={s.carbIcon}>✦</span> газированная
          </div>
        )}
      </div>

      {/* Content */}
      <div style={s.content}>
        <div style={s.name}>{product.name}</div>
        {product.description && <div style={s.desc}>{product.description}</div>}

        {/* Price + cart */}
        <div style={s.row}>
          <div>
            <span style={s.price}>{product.price.toLocaleString()}</span>
            <span style={s.currency}> сум</span>
          </div>

          {!cartItem ? (
            <button style={s.addBtn} onClick={() => addToCart(product)} aria-label="Добавить">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <div style={s.stepper}>
              <button style={s.stepBtn} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>
                −
              </button>
              <span style={s.qty}>{cartItem.quantity}</span>
              <button style={{ ...s.stepBtn, ...s.stepPlus }} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  card: {
    background: '#fff', borderRadius: 20, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  },
  imgWrap: {
    position: 'relative', width: '100%', aspectRatio: '4/3',
    overflow: 'hidden', background: '#f0f2e8',
  },
  img: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
    background: 'linear-gradient(145deg, #f5f7ef 0%, #edf0e4 100%)',
  },
  carbTag: {
    position: 'absolute', top: 10, left: 10,
    background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 10, padding: '4px 10px',
    fontSize: 11, fontWeight: 700, color: '#2d8a4e',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  carbIcon: { fontSize: 10 },
  content: {
    padding: '10px 12px 12px', display: 'flex', flexDirection: 'column',
    gap: 3, flex: 1,
  },
  name: {
    fontWeight: 700, fontSize: 14, color: '#1a1a1a',
    lineHeight: 1.3, letterSpacing: -0.15,
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  desc: {
    fontSize: 12, color: '#8e8e93', lineHeight: 1.3,
    display: '-webkit-box', WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 'auto', paddingTop: 6,
  },
  price: { fontWeight: 800, fontSize: 17, color: '#1a1a1a', letterSpacing: -0.3 },
  currency: { fontWeight: 500, fontSize: 12, color: '#8e8e93' },

  /* Add button */
  addBtn: {
    width: 38, height: 38, borderRadius: 14,
    background: C, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: `0 4px 12px rgba(141,198,63,0.35)`,
    transition: 'transform 0.15s, box-shadow 0.15s',
  },

  /* Stepper */
  stepper: {
    display: 'flex', alignItems: 'center',
    background: '#f2f2f7', borderRadius: 14,
    overflow: 'hidden', height: 38,
  },
  stepBtn: {
    width: 34, height: 38, border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 18, fontWeight: 600, color: '#8e8e93',
  },
  stepPlus: { color: C, fontWeight: 700 },
  qty: {
    fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: 'center',
    color: '#1a1a1a',
  },
}
