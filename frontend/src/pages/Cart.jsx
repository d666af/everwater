import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#7CB342'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCartStore()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div style={s.empty}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
          <path d="M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z" fill="#E0E0E0"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="#E0E0E0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={s.emptyTitle}>Корзина пуста</div>
        <div style={s.emptyDesc}>Добавьте товары из каталога</div>
        <button style={s.goBtn} onClick={() => navigate('/')}>
          В каталог
        </button>
      </div>
    )
  }

  const totalAmt = total()
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div style={s.page}>
      <div style={s.list}>
        {items.map(({ product, quantity }) => (
          <div key={product.id} style={s.item}>
            <div style={s.itemImg}>
              {product.photo_url ? (
                <img src={product.photo_url} alt={product.name} style={s.img}
                  onError={e => { e.target.style.display = 'none' }} />
              ) : (
                <div style={s.imgPlaceholder}>
                  <svg width="20" height="24" viewBox="0 0 40 48" fill="none">
                    <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                      fill="rgba(124,179,66,0.3)"/>
                  </svg>
                </div>
              )}
            </div>

            <div style={s.itemBody}>
              <div style={s.itemTop}>
                <div>
                  <div style={s.itemName}>{product.name}</div>
                  <div style={s.itemVol}>{product.volume}л</div>
                </div>
                <button style={s.delBtn} onClick={() => removeFromCart(product.id)} aria-label="Удалить">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div style={s.itemBottom}>
                <div style={s.counter}>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity - 1)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <span style={s.qty}>{quantity}</span>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity + 1)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div style={s.itemPrice}>{(product.price * quantity).toLocaleString()} сум</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={s.bottom}>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>{totalQty} {totalQty === 1 ? 'товар' : totalQty < 5 ? 'товара' : 'товаров'}</span>
          <span style={s.summaryTotal}>{totalAmt.toLocaleString()} сум</span>
        </div>

        <button style={s.checkoutBtn} onClick={() => navigate('/checkout')}>
          Оформить заказ
        </button>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#FAFAFA',
  },
  list: {
    padding: '8px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  item: {
    background: '#FFFFFF',
    borderRadius: 18,
    display: 'flex',
    gap: 14,
    padding: 14,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  itemImg: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
    background: '#F5F5F5',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontWeight: 700,
    fontSize: 15,
    color: '#212121',
    lineHeight: 1.3,
  },
  itemVol: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  delBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
  },
  itemBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
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
    minWidth: 28,
    textAlign: 'center',
    color: '#212121',
  },
  itemPrice: {
    fontWeight: 800,
    fontSize: 16,
    color: '#212121',
    letterSpacing: -0.3,
  },
  bottom: {
    padding: '16px 20px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 4px',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#757575',
    fontWeight: 500,
  },
  summaryTotal: {
    fontSize: 24,
    fontWeight: 900,
    color: '#212121',
    letterSpacing: -0.5,
  },
  checkoutBtn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    minHeight: 56,
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(124,179,66,0.3)',
    transition: 'all 0.2s',
    letterSpacing: -0.2,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: '75vh',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#212121',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  goBtn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    padding: '14px 36px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(124,179,66,0.3)',
    marginTop: 8,
  },
}
