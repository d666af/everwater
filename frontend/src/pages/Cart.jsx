import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store'

export default function Cart() {
  const { items, updateQuantity, removeFromCart, total } = useCartStore()
  const navigate = useNavigate()

  if (!items.length) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              fill="#F0F0F0" stroke="#CCCCCC" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round"/>
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
      {/* Items */}
      <div style={s.list}>
        {items.map(({ product, quantity }) => (
          <div key={product.id} style={s.item}>
            {/* Product image / placeholder */}
            <div style={s.itemImg}>
              {product.photo_url ? (
                <img src={product.photo_url} alt={product.name} style={s.img} onError={e => { e.target.style.display='none' }} />
              ) : (
                <div style={s.imgPlaceholder}>
                  <svg width="24" height="28" viewBox="0 0 40 48" fill="none">
                    <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                      fill="#8DC63F" opacity="0.8"/>
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
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity - 1)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <span style={s.qty}>{quantity}</span>
                  <button style={s.cBtn} onClick={() => updateQuantity(product.id, quantity + 1)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 4v16M4 12h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div style={s.itemTotal}>{(product.price * quantity).toLocaleString()} сум</div>
                <button style={s.delBtn} onClick={() => removeFromCart(product.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#CCC" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary card */}
      <div style={s.summary}>
        <div style={s.summaryCard}>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Оформить заказ · {totalAmt.toLocaleString()} сум
        </button>

        <button style={s.continueBtn} onClick={() => navigate('/')}>
          ← Продолжить покупки
        </button>
      </div>
    </div>
  )
}

const P = '#8DC63F'

const s = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F8F8F8' },
  list: { flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  item: {
    background: '#fff', borderRadius: 16,
    display: 'flex', gap: 12, padding: 12,
    boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    border: '1px solid #F0F0F0',
  },
  itemImg: {
    width: 72, height: 72, borderRadius: 12, overflow: 'hidden',
    flexShrink: 0, position: 'relative', background: '#F5F5F5',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  imgPlaceholder: {
    width: '100%', height: '100%',
    background: 'linear-gradient(135deg, #EDF7D6, #C8E6A0)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  volTag: {
    position: 'absolute', bottom: 4, right: 4,
    background: 'rgba(0,0,0,0.45)', color: '#fff',
    borderRadius: 6, padding: '1px 5px',
    fontSize: 9, fontWeight: 700,
  },
  itemBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  itemName: { fontWeight: 700, fontSize: 14, color: '#1A1A1A', lineHeight: 1.3 },
  itemUnitPrice: { fontSize: 12, color: '#888' },
  itemFooter: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6 },
  counter: { display: 'flex', alignItems: 'center', gap: 6 },
  cBtn: {
    background: P, color: '#fff', border: 'none',
    borderRadius: 7, width: 26, height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  qty: { fontWeight: 800, fontSize: 15, minWidth: 20, textAlign: 'center', color: '#1A1A1A' },
  itemTotal: { fontWeight: 800, fontSize: 14, color: '#1A1A1A', marginLeft: 'auto' },
  delBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 4 },
  summary: {
    padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    background: '#F8F8F8',
  },
  summaryCard: {
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    border: '1px solid #F0F0F0',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14 },
  summaryLabel: { color: '#888' },
  summaryVal: { fontWeight: 600, color: '#333' },
  divider: { height: 1, background: '#F0F0F0' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: 700, color: '#1A1A1A' },
  totalAmt: { fontSize: 20, fontWeight: 900, color: P },
  checkoutBtn: {
    background: `linear-gradient(135deg, ${P}, #6CA32F)`,
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '15px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 20px rgba(141,198,63,0.4)',
  },
  continueBtn: {
    background: 'none', border: 'none', color: '#888',
    fontSize: 14, cursor: 'pointer', textAlign: 'center', padding: '4px 0',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, minHeight: '70vh',
    padding: 24,
  },
  emptyIcon: {
    width: 96, height: 96, borderRadius: '50%',
    background: '#F5F5F5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: 800, color: '#1A1A1A' },
  emptyDesc: { fontSize: 14, color: '#888' },
  goBtn: {
    background: P, color: '#fff', border: 'none',
    borderRadius: 12, padding: '12px 28px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.4)',
    marginTop: 8,
  },
}
