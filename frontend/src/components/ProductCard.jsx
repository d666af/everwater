import { useState } from 'react'
import { useCartStore } from '../store'

const C = '#7CB342'

const BG_COLORS = [
  'linear-gradient(145deg, #E8F5E9 0%, #C8E6C9 100%)',
  'linear-gradient(145deg, #F1F8E9 0%, #DCEDC8 100%)',
  'linear-gradient(145deg, #E0F2F1 0%, #B2DFDB 100%)',
  'linear-gradient(145deg, #F3E5F5 0%, #E1BEE7 100%)',
]

export default function ProductCard({ product }) {
  const { addToCart, items, updateQuantity } = useCartStore()
  const cartItem = items.find(i => i.product.id === product.id)
  const [imgError, setImgError] = useState(false)

  const bg = BG_COLORS[product.id % BG_COLORS.length]
  const hasPhoto = product.photo_url && !imgError

  return (
    <div style={s.card}>
      <div style={{ ...s.imgArea, background: hasPhoto ? '#F5F5F5' : bg }}>
        {hasPhoto ? (
          <img src={product.photo_url} alt={product.name} style={s.img} onError={() => setImgError(true)} />
        ) : (
          <div style={s.placeholder}>
            <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
        )}
        <div style={s.volBadge}>{product.volume}л</div>
        {cartItem && <div style={s.qtyBadge}>{cartItem.quantity}</div>}
      </div>

      <div style={s.body}>
        <div style={s.name}>{product.name}</div>
        {product.description && <div style={s.desc}>{product.description}</div>}

        <div style={s.footer}>
          <div style={s.price}>{product.price.toLocaleString()} <span style={s.currency}>сум</span></div>

          {!cartItem ? (
            <button style={s.addBtn} onClick={() => addToCart(product)} aria-label="Добавить">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <div style={s.counter}>
              <button style={s.cBtn} onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
              <span style={s.qty}>{cartItem.quantity}</span>
              <button style={s.cBtn} onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
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
    background: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  imgArea: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1/0.85',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  volBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(8px)',
    borderRadius: 8,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    color: '#212121',
  },
  qtyBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 9,
    background: C,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    boxShadow: '0 2px 8px rgba(124,179,66,0.4)',
  },
  body: {
    padding: '12px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  name: {
    fontWeight: 700,
    fontSize: 14,
    color: '#212121',
    lineHeight: 1.3,
  },
  desc: {
    fontSize: 12,
    color: '#757575',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 8,
  },
  price: {
    fontWeight: 800,
    fontSize: 16,
    color: '#212121',
    letterSpacing: -0.3,
  },
  currency: {
    fontWeight: 500,
    fontSize: 12,
    color: '#757575',
  },
  addBtn: {
    background: C,
    border: 'none',
    borderRadius: 12,
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 12px rgba(124,179,66,0.35)',
    cursor: 'pointer',
    transition: 'transform 0.15s',
    flexShrink: 0,
  },
  counter: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    background: '#F5F5F5',
    borderRadius: 12,
    padding: 2,
  },
  cBtn: {
    background: C,
    border: 'none',
    borderRadius: 10,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  qty: {
    fontWeight: 800,
    fontSize: 15,
    minWidth: 24,
    textAlign: 'center',
    color: '#212121',
  },
}
