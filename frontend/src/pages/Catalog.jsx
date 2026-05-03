import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, getSettings } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { useOrdersStore } from '../store/orders'
import { useCartStore } from '../store'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const QUICK_CATS = [
  { key: 'all', label: 'Все' },
  { key: '19', label: '19л' },
  { key: '10', label: '10л' },
  { key: '5', label: '5л' },
  { key: '1.5', label: '1.5л' },
  { key: '1', label: '1л' },
  { key: '0.5', label: '0.5л' },
  { key: 'carbonated', label: 'Газированная' },
]

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({ bottle_discount_type: 'fixed', bottle_discount_value: 0 })
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const navigate = useNavigate()
  const orders = useOrdersStore(s => s.orders)
  const cartItems = useCartStore(s => s.items)
  const hasCart = cartItems.length > 0

  const activeOrders = useMemo(() => {
    return orders.filter(o => ['awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))
  }, [orders])

  useEffect(() => {
    Promise.all([getProducts(), getSettings()])
      .then(([prods, cfg]) => { setProducts(prods); setSettings(cfg) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Only show filter buttons for categories that have at least one product
  const visibleCats = useMemo(() => {
    if (!products.length) return QUICK_CATS.slice(0, 1)
    return QUICK_CATS.filter(({ key }) => {
      if (key === 'all') return true
      if (key === 'carbonated') return products.some(p => p.type === 'carbonated')
      if (key === '19') return products.some(p => p.volume >= 18.9)
      const vol = parseFloat(key)
      return products.some(p => Math.abs(p.volume - vol) < 0.1)
    })
  }, [products])

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return products
    if (activeCategory === 'carbonated') return products.filter(p => p.type === 'carbonated')
    if (activeCategory === '19') return products.filter(p => p.volume >= 18.9)
    const vol = parseFloat(activeCategory)
    return products.filter(p => Math.abs(p.volume - vol) < 0.1)
  }, [products, activeCategory])

  // Compute effective "with return" price — only for products flagged as deposit
  const computeReturnPrice = (product) => {
    if (!product.has_bottle_deposit) return null
    const val = Number(settings.bottle_discount_value || 0)
    if (!val) return null
    if (settings.bottle_discount_type === 'percent') {
      return Math.round(product.price * (1 - val / 100))
    }
    return Math.max(0, product.price - val)
  }

  return (
    <div style={s.page}>
      {/* Active order */}
      {activeOrders.length > 0 && (
        <div style={s.activeOrder} onClick={() => navigate('/orders')}>
          <div style={s.activeOrderLeft}>
            <div style={s.activeOrderDot} />
            <div>
              <div style={s.activeOrderTitle}>
                {activeOrders.length === 1 ? 'Активный заказ' : `${activeOrders.length} активных заказа`}
              </div>
              <div style={s.activeOrderSub}>Нажмите для отслеживания</div>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Quick categories */}
      {visibleCats.length > 1 && (
        <div style={s.catSection}>
          <div style={s.catScroll}>
            {visibleCats.map(({ key, label }) => (
              <button key={key}
                style={activeCategory === key ? { ...s.catBtn, ...s.catBtnActive } : s.catBtn}
                onClick={() => setActiveCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products grid */}
      <div style={s.section}>
        {loading && (
          <div style={s.grid}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && !products.length && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>💧</div>
            <p style={s.emptyTitle}>Скоро здесь появятся товары</p>
            <p style={s.emptySub}>Мы уже работаем над этим</p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div style={s.grid}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p}
                priceWithReturn={computeReturnPrice(p)}
                isDepositProduct={p.has_bottle_deposit || false}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && products.length > 0 && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>🔍</div>
            <p style={s.emptyTitle}>Ничего не найдено</p>
            <p style={s.emptySub}>Попробуйте другую категорию</p>
          </div>
        )}
      </div>

      {/* Extra scroll space when cart widget is visible */}
      <div style={{ height: hasCart ? 90 : 24 }} />
    </div>
  )
}

const s = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: '#e4e4e8', minHeight: '100dvh',
  },

  /* Active order */
  activeOrder: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    margin: '12px 16px 0', cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: `1px solid ${C}30`,
  },
  activeOrderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  activeOrderDot: {
    width: 10, height: 10, borderRadius: 5,
    background: C, flexShrink: 0,
    animation: 'pulse 2s infinite',
  },
  activeOrderTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a1a' },
  activeOrderSub: { fontSize: 12, color: '#8e8e93', marginTop: 1 },

  /* Categories */
  catSection: { padding: '14px 0 0' },
  catScroll: {
    display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch', padding: '0 16px',
  },
  catBtn: {
    display: 'flex', alignItems: 'center',
    padding: '10px 18px', borderRadius: 16, border: 'none',
    background: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    color: '#3c3c43', transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  catBtnActive: {
    background: GRAD, color: '#fff',
    boxShadow: '0 3px 12px rgba(141,198,63,0.35)',
  },

  /* Products */
  section: { padding: '14px 16px 0' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
  },

  /* Empty */
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 20px', gap: 4,
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  emptySub: { fontSize: 13, color: '#8e8e93', margin: 0 },
}
