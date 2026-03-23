import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { useUserStore } from '../store/user'
import { useOrdersStore } from '../store/orders'
import { useCartStore } from '../store'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const QUICK_CATS = [
  { key: 'all', label: 'Все' },
  { key: '18.9', label: '18.9л' },
  { key: '10', label: '10л' },
  { key: '5', label: '5л' },
  { key: '1.5', label: '1.5л' },
  { key: '1', label: '1л' },
  { key: '0.5', label: '0.5л' },
  { key: 'carbonated', label: 'Газированная' },
]

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const navigate = useNavigate()
  const { bonus_points, balance } = useUserStore()
  const orders = useOrdersStore(s => s.orders)
  const cartItems = useCartStore(s => s.items)
  const hasCart = cartItems.length > 0

  const activeOrders = useMemo(() => {
    return orders.filter(o => ['awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))
  }, [orders])

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return products
    if (activeCategory === 'carbonated') {
      return products.filter(p => p.type === 'carbonated' || p.name?.toLowerCase().includes('газированн'))
    }
    const vol = parseFloat(activeCategory)
    return products.filter(p => p.volume === vol)
  }, [products, activeCategory])

  return (
    <div style={s.page}>
      {/* Bonus & Balance cards */}
      <div style={s.infoRow}>
        <div style={s.statCard} onClick={() => navigate('/profile')}>
          <div style={s.statIconRow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2Z" fill={C}/>
            </svg>
            <span style={s.statLabel}>Бонусы</span>
          </div>
          <span style={s.statValue}>{bonus_points.toLocaleString()}</span>
        </div>
        <div style={s.statCard} onClick={() => navigate('/profile')}>
          <div style={s.statIconRow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="20" height="12" rx="2" stroke={C} strokeWidth="2" fill={C + '20'}/>
              <path d="M6 10h3M6 14h5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={s.statLabel}>Баланс</span>
          </div>
          <span style={s.statValue}>{balance.toLocaleString()} сум</span>
        </div>
      </div>

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

      {/* Quick categories — no emoji icons */}
      <div style={s.catSection}>
        <div style={s.catScroll}>
          {QUICK_CATS.map(({ key, label }) => (
            <button key={key}
              style={activeCategory === key ? { ...s.catBtn, ...s.catBtnActive } : s.catBtn}
              onClick={() => setActiveCategory(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
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
    background: '#eeeef2', minHeight: '100dvh',
  },

  /* Stats row — compact cards with labels */
  infoRow: {
    display: 'flex', gap: 10, padding: '12px 16px 0',
  },
  statCard: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 3,
    background: '#fff', borderRadius: 16, padding: '10px 14px',
    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statIconRow: { display: 'flex', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 12, fontWeight: 500, color: '#8e8e93' },
  statValue: { fontSize: 18, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.3 },

  /* Active order */
  activeOrder: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    margin: '10px 16px 0', cursor: 'pointer',
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

  /* Categories — no emojis, gradient active */
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
