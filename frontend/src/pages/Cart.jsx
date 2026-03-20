import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCartStore()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2z" fill="#ddd"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="#ddd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={s.emptyTitle}>Корзина пуста</div>
        <div style={s.emptyDesc}>Добавьте товары из каталога</div>
        <button style={s.emptyBtn} onClick={() => navigate('/')}>В каталог</button>
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
                  <svg width="18" height="22" viewBox="0 0 40 48" fill="none">
                    <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                      fill="#ddd"/>
                  </svg>
                </div>
              )}
            </div>

            <div style={s.itemBody}>
              <div style={s.itemTop}>
                <div>
                  <div style={s.itemName}>{product.name}</div>
                  <div style={s.itemVol}>{product.volume} л</div>
                </div>
                <button style={s.delBtn} onClick={() => removeFromCart(product.id)} aria-label="Удалить">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div style={s.itemBottom}>
                <div style={s.counter}>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity - 1)}>−</button>
                  <span style={s.qty}>{quantity}</span>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity + 1)}>+</button>
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
    minHeight: '100dvh',
    background: '#fafafa',
  },
  list: {
    padding: '4px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  item: {
    background: '#fff',
    borderRadius: 14,
    display: 'flex',
    gap: 12,
    padding: 12,
    border: '1px solid #f0f0f0',
  },
  itemImg: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    background: '#f7f7f8',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f0f0',
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
    fontSize: 14,
    color: '#111',
    lineHeight: 1.3,
  },
  itemVol: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
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
    marginTop: 6,
  },
  counter: {
    display: 'flex',
    alignItems: 'center',
    background: '#f2f2f3',
    borderRadius: 10,
    overflow: 'hidden',
  },
  cBtn: {
    background: '#4CAF50',
    border: 'none',
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
  },
  qty: {
    fontWeight: 700,
    fontSize: 14,
    minWidth: 28,
    textAlign: 'center',
    color: '#111',
  },
  itemPrice: {
    fontWeight: 700,
    fontSize: 15,
    color: '#111',
  },
  bottom: {
    padding: '16px 16px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 4px',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: 500,
  },
  summaryTotal: {
    fontSize: 22,
    fontWeight: 800,
    color: '#111',
    letterSpacing: -0.5,
  },
  checkoutBtn: {
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    height: 52,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: '75vh',
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#999',
  },
  emptyBtn: {
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
  },
}
