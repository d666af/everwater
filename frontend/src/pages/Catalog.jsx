import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { useUserStore } from '../store/user'
import { useOrdersStore } from '../store/orders'
import { useAuthStore } from '../store/auth'

const C = '#8DC63F'

const QUICK_CATS = [
  { key: 'all', label: 'Все', emoji: '💧' },
  { key: '18.9', label: '18.9л', emoji: '🏔' },
  { key: '10', label: '10л', emoji: '🚰' },
  { key: '5', label: '5л', emoji: '🧴' },
  { key: '1.5', label: '1.5л', emoji: '🥤' },
  { key: '1', label: '1л', emoji: '💦' },
  { key: '0.5', label: '0.5л', emoji: '✨' },
  { key: 'carbonated', label: 'Газированная', emoji: '🫧' },
]

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const navigate = useNavigate()
  const { bonus_points, balance } = useUserStore()
  const orders = useOrdersStore(s => s.orders)
  const user = useAuthStore(s => s.user)

  const firstName = user?.name?.split(' ')[0] || ''

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

  const hours = new Date().getHours()
  const greet = hours < 6 ? 'Доброй ночи' : hours < 12 ? 'Доброе утро' : hours < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div style={s.page}>
      {/* Greeting + info row */}
      <div style={s.topSection}>
        <div style={s.greetRow}>
          <div>
            <h1 style={s.greet}>{greet}{firstName ? `, ${firstName}` : ''} 👋</h1>
            <p style={s.greetSub}>Что закажем сегодня?</p>
          </div>
        </div>

        {/* Bonus & Balance compact row */}
        <div style={s.statsRow}>
          <div style={s.statChip} onClick={() => navigate('/profile')}>
            <div style={s.bonusIcon}>⭐</div>
            <span style={s.statValue}>{bonus_points.toLocaleString()}</span>
          </div>
          <div style={s.statChip} onClick={() => navigate('/profile')}>
            <div style={s.balanceIconEl}>💳</div>
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
      </div>

      {/* Quick categories — horizontal scroll */}
      <div style={s.catSection}>
        <div style={s.catScroll}>
          {QUICK_CATS.map(({ key, label, emoji }) => (
            <button key={key}
              style={activeCategory === key ? { ...s.catBtn, ...s.catBtnActive } : s.catBtn}
              onClick={() => setActiveCategory(key)}
            >
              <span style={s.catEmoji}>{emoji}</span>
              <span>{label}</span>
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

      <div style={{ height: 24 }} />
    </div>
  )
}

const s = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: '#eeeef2', minHeight: '100dvh',
  },

  /* Top section */
  topSection: { padding: '6px 16px 0' },
  greetRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  greet: {
    fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: 0,
    letterSpacing: -0.5,
  },
  greetSub: {
    fontSize: 14, color: '#8e8e93', margin: '2px 0 0', fontWeight: 500,
  },

  /* Stats row */
  statsRow: {
    display: 'flex', gap: 8, marginTop: 12,
  },
  statChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff', borderRadius: 14, padding: '8px 14px',
    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  bonusIcon: { fontSize: 16 },
  balanceIconEl: { fontSize: 16 },
  statValue: { fontSize: 13, fontWeight: 700, color: '#1a1a1a' },

  /* Active order */
  activeOrder: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    marginTop: 10, cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: `1px solid ${C}30`,
  },
  activeOrderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  activeOrderDot: {
    width: 10, height: 10, borderRadius: 5,
    background: C, flexShrink: 0,
    boxShadow: `0 0 0 3px ${C}30`,
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
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 16, border: 'none',
    background: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    color: '#3c3c43', transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  catBtnActive: {
    background: C, color: '#fff',
    boxShadow: `0 3px 12px rgba(141,198,63,0.35)`,
  },
  catEmoji: { fontSize: 16 },

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
