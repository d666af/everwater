import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

const C = '#8DC63F'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCartStore()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke={C} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M3 6h18" stroke={C} strokeWidth="1.5"/>
            <path d="M16 10a4 4 0 01-8 0" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={s.emptyTitle}>Корзина пуста</div>
        <div style={s.emptyDesc}>Добавьте товары из каталога,<br/>чтобы оформить заказ</div>
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
      {/* Info */}
      <div style={s.infoBar}>
        <span style={s.infoText}>{totalQty} {totalQty === 1 ? 'товар' : totalQty < 5 ? 'товара' : 'товаров'}</span>
        <span style={s.infoDot} />
        <span style={s.infoText}>Доставка от 1 часа</span>
      </div>

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
                      fill={C+'40'}/>
                  </svg>
                </div>
              )}
            </div>

            <div style={s.itemBody}>
              <div style={s.itemTop}>
                <div>
                  <div style={s.itemName}>{product.name}</div>
                  <div style={s.itemVol}>{product.volume} л · {product.price.toLocaleString()} сум</div>
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

      {/* Bottom */}
      <div style={s.bottom}>
        <div style={s.summaryCard}>
          <div style={s.summaryRow}>
            <span style={s.summaryLabel}>Товары ({totalQty})</span>
            <span style={s.summaryVal}>{totalAmt.toLocaleString()} сум</span>
          </div>
          <div style={s.summaryRow}>
            <span style={s.summaryLabel}>Доставка</span>
            <span style={{ ...s.summaryVal, color: C }}>Бесплатно</span>
          </div>
          <div style={s.summaryDivider} />
          <div style={s.summaryRow}>
            <span style={s.summaryTotalLabel}>Итого</span>
            <span style={s.summaryTotal}>{totalAmt.toLocaleString()} сум</span>
          </div>
        </div>
        <button style={s.checkoutBtn} onClick={() => navigate('/checkout')}>
          Оформить заказ
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#fafafa' },
  infoBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 20px 10px', justifyContent: 'center',
  },
  infoText: { fontSize: 12, color: '#999', fontWeight: 500 },
  infoDot: { width: 3, height: 3, borderRadius: '50%', background: '#ddd' },
  list: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  item: {
    background: '#fff', borderRadius: 16, display: 'flex', gap: 12,
    padding: 12, border: '1px solid #f0f0f0',
  },
  itemImg: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: '#f5f8f0' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  imgPlaceholder: {
    width: '100%', height: '100%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  itemBody: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontWeight: 700, fontSize: 14, color: '#1a1a1a', lineHeight: 1.3 },
  itemVol: { fontSize: 12, color: '#999', marginTop: 2 },
  delBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' },
  itemBottom: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  counter: { display: 'flex', alignItems: 'center', background: '#f2f2f3', borderRadius: 10, overflow: 'hidden' },
  cBtn: {
    background: C, border: 'none', width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700,
  },
  qty: { fontWeight: 700, fontSize: 14, minWidth: 28, textAlign: 'center', color: '#1a1a1a' },
  itemPrice: { fontWeight: 700, fontSize: 15, color: '#1a1a1a' },
  bottom: { padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 12 },
  summaryCard: {
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    border: '1px solid #f0f0f0',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: '#888' },
  summaryVal: { fontSize: 14, fontWeight: 600, color: '#1a1a1a' },
  summaryDivider: { height: 1, background: '#f0f0f0' },
  summaryTotalLabel: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  summaryTotal: { fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.3 },
  checkoutBtn: {
    background: C, color: '#fff', border: 'none', borderRadius: 14,
    height: 52, fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 10, minHeight: '75vh', padding: 24,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: '50%', background: '#f0faf0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  emptyDesc: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 1.5 },
  goBtn: {
    background: C, color: '#fff', border: 'none', borderRadius: 14,
    padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8,
  },
}
