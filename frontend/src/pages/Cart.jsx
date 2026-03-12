import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCartStore()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIconWrap}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              fill="#F2F2F7" stroke="#C7C7CC" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M3 6h18M16 10a4 4 0 01-8 0"
              stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={s.emptyTitle}>Корзина пуста</div>
        <div style={s.emptyDesc}>Добавьте товары из каталога</div>
        <button style={s.goBtn} onClick={() => navigate('/')}>
          Перейти в каталог
        </button>
      </div>
    )
  }

  const totalAmt = total()
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div style={s.page}>
      {/* Items list */}
      <div style={s.list}>
        {items.map(({ product, quantity }) => (
          <div key={product.id} style={s.item}>
            {/* Product image */}
            <div style={s.itemImg}>
              {product.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.name}
                  style={s.img}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div style={s.imgPlaceholder}>
                  <svg width="24" height="29" viewBox="0 0 40 48" fill="none">
                    <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                      fill={C} opacity="0.7"/>
                  </svg>
                </div>
              )}
              <div style={s.volTag}>{product.volume}л</div>
            </div>

            {/* Info */}
            <div style={s.itemBody}>
              <div style={s.itemName}>{product.name}</div>
              <div style={s.itemUnitPrice}>{product.price.toLocaleString()} сум/шт</div>

              <div style={s.itemFooter}>
                <div style={s.counter}>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity - 1)} aria-label="Уменьшить">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <span style={s.qty}>{quantity}</span>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity + 1)} aria-label="Увеличить">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div style={s.itemTotal}>{(product.price * quantity).toLocaleString()} сум</div>
                <button style={s.delBtn} onClick={() => removeFromCart(product.id)} aria-label="Удалить">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                      stroke="#C7C7CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Summary + checkout */}
      <div style={s.summary}>
        <div style={s.summaryCard}>
          <div style={s.summaryRow}>
            <span style={s.summaryLabel}>Позиций</span>
            <span style={s.summaryVal}>{items.length}</span>
          </div>
          <div style={s.summaryRow}>
            <span style={s.summaryLabel}>Товаров</span>
            <span style={s.summaryVal}>{totalQty} шт</span>
          </div>
          <div style={s.divider} />
          <div style={s.totalRow}>
            <span style={s.totalLabel}>Итого</span>
            <span style={s.totalAmt}>{totalAmt.toLocaleString()} сум</span>
          </div>
        </div>

        <button style={s.checkoutBtn} onClick={() => navigate('/checkout')}>
          Оформить заказ · {totalAmt.toLocaleString()} сум
        </button>

        <button style={s.continueBtn} onClick={() => navigate('/')}>
          Продолжить покупки
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
    background: BG,
  },
  list: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  item: {
    background: '#FFFFFF',
    borderRadius: 16,
    display: 'flex',
    gap: 12,
    padding: 12,
    border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    transition: TRANSITION,
  },
  itemImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
    background: '#F2F2F7',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #EDF7D6, #C8E6A0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    background: 'rgba(0,0,0,0.4)',
    color: '#fff',
    borderRadius: 6,
    padding: '1px 5px',
    fontSize: 9,
    fontWeight: 700,
  },
  itemBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  itemName: {
    fontWeight: 700,
    fontSize: 14,
    color: TEXT,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemUnitPrice: {
    fontSize: 12,
    color: TEXT2,
  },
  itemFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 6,
  },
  counter: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  cBtn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 50,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: TRANSITION,
  },
  qty: {
    fontWeight: 800,
    fontSize: 15,
    minWidth: 20,
    textAlign: 'center',
    color: TEXT,
  },
  itemTotal: {
    fontWeight: 800,
    fontSize: 14,
    color: TEXT,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },
  delBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: TRANSITION,
  },
  summary: {
    padding: '12px 16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  summaryCard: {
    background: '#FFFFFF',
    borderRadius: 16,
    padding: '14px 16px',
    border: `1px solid ${BORDER}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: TEXT2,
  },
  summaryLabel: {
    color: TEXT2,
  },
  summaryVal: {
    fontWeight: 600,
    color: TEXT,
  },
  divider: {
    height: 1,
    background: BORDER,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: 700,
    color: TEXT,
  },
  totalAmt: {
    fontSize: 22,
    fontWeight: 800,
    color: C,
  },
  checkoutBtn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    minHeight: 52,
    padding: '0 20px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
    transition: TRANSITION,
    letterSpacing: 0.1,
  },
  continueBtn: {
    background: 'none',
    border: 'none',
    color: TEXT2,
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'center',
    padding: '6px 0',
    fontWeight: 500,
    transition: TRANSITION,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: '70vh',
    padding: 24,
    background: '#FFFFFF',
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: BG,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${BORDER}`,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 14,
    color: TEXT2,
  },
  goBtn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
    transition: TRANSITION,
    marginTop: 8,
  },
}
