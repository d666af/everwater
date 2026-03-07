import { useState } from 'react'
import { useCartStore } from '../store'

const GRADIENTS = [
  { bg: 'linear-gradient(145deg, #C8E6A0 0%, #8DC63F 100%)', text: '#2D5A10' },
  { bg: 'linear-gradient(145deg, #B3E0D0 0%, #52B788 100%)', text: '#1B4332' },
  { bg: 'linear-gradient(145deg, #D4F0B0 0%, #78C44A 100%)', text: '#2D5A10' },
  { bg: 'linear-gradient(145deg, #A8D8EA 0%, #52B4D4 100%)', text: '#0D3B5E' },
]

function WaterDropIcon({ size = 40, color = '#fff' }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" fill="none">
      <path d="M20 2 C20 2 4 20 4 30 C4 39.9 11.2 47 20 47 C28.8 47 36 39.9 36 30 C36 20 20 2 20 2Z"
        fill={color} opacity="0.9" />
      <path d="M12 30 C12 30 14 24 20 22 C26 24 28 30 28 30"
        stroke={color === '#fff' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)'}
        strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function ProductCard({ product }) {
  const { addToCart, items, updateQuantity } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)
  const [imgError, setImgError] = useState(false)

  const grad = GRADIENTS[product.id % GRADIENTS.length]
  const hasPhoto = product.photo_url && !imgError

  return (
    <div style={s.card}>
      {/* Image area */}
      <div style={{ ...s.imgWrap, background: hasPhoto ? '#F5F5F5' : grad.bg }}>
        {hasPhoto ? (
          <img
            src={product.photo_url}
            alt={product.name}
            style={s.img}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={s.placeholder}>
            <WaterDropIcon size={44} color="rgba(255,255,255,0.9)" />
            <div style={{ ...s.volBadge, color: grad.text }}>{product.volume} л</div>
          </div>
        )}

        {/* Cart count badge */}
        {cartItem && (
          <div style={s.cartBadge}>{cartItem.quantity}</div>
        )}

        {/* Volume tag on photo */}
        {hasPhoto && (
          <div style={s.photoVolTag}>{product.volume} л</div>
        )}
      </div>

      {/* Content */}
      <div style={s.body}>
        <div style={s.name}>{product.name}</div>
        {product.description && (
          <div style={s.desc}>{product.description}</div>
        )}

        <div style={s.footer}>
          <div style={s.price}>
            {product.price.toLocaleString()}
            <span style={s.currency}> сум</span>
          </div>

          {!cartItem ? (
            <button style={s.addBtn} onClick={() => addToCart(product)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <div style={s.counter}>
              <button style={s.cBtn}
                onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
              <span style={s.qty}>{cartItem.quantity}</span>
              <button style={s.cBtn}
                onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const P = '#8DC63F'

const s = {
  card: {
    background: '#fff',
    borderRadius: 16, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    border: '1px solid #F0F0F0',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  imgWrap: {
    position: 'relative', width: '100%', aspectRatio: '1/1', overflow: 'hidden',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  volBadge: {
    background: 'rgba(255,255,255,0.85)',
    borderRadius: 8, padding: '3px 10px',
    fontSize: 13, fontWeight: 800,
    backdropFilter: 'blur(4px)',
  },
  cartBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: '50%',
    background: P, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 800,
    boxShadow: '0 2px 8px rgba(141,198,63,0.5)',
    border: '2px solid #fff',
  },
  photoVolTag: {
    position: 'absolute', bottom: 8, left: 8,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    borderRadius: 8, padding: '3px 8px',
    fontSize: 11, fontWeight: 700, color: '#fff',
  },
  body: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  name: { fontWeight: 700, fontSize: 13, color: '#1A1A1A', lineHeight: 1.3 },
  desc: { fontSize: 11, color: '#888', lineHeight: 1.4 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 },
  price: { fontWeight: 800, fontSize: 14, color: '#1A1A1A' },
  currency: { fontWeight: 400, fontSize: 11, color: '#888' },
  addBtn: {
    background: P, color: '#fff', border: 'none',
    borderRadius: 10, width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(141,198,63,0.4)',
    transition: 'transform 0.15s',
    flexShrink: 0,
  },
  counter: { display: 'flex', alignItems: 'center', gap: 6 },
  cBtn: {
    background: P, color: '#fff', border: 'none',
    borderRadius: 8, width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  qty: { fontWeight: 800, fontSize: 15, minWidth: 20, textAlign: 'center', color: '#1A1A1A' },
}
