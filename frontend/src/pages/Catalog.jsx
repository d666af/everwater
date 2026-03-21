import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'
import { useUserStore } from '../store/user'
import { useOrdersStore } from '../store/orders'

const C = '#8DC63F'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [volumeFilter, setVolumeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'still' | 'carbonated'
  const navigate = useNavigate()
  const { bonus_points, balance } = useUserStore()
  const orders = useOrdersStore(s => s.orders)

  const activeOrders = useMemo(() => {
    return orders.filter(o => ['awaiting_confirmation', 'confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status))
  }, [orders])

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const volumes = useMemo(() => {
    return [...new Set(products.map(p => p.volume))].sort((a, b) => a - b)
  }, [products])

  const filtered = useMemo(() => {
    let result = products
    if (volumeFilter !== 'all') {
      result = result.filter(p => String(p.volume) === String(volumeFilter))
    }
    if (typeFilter !== 'all') {
      result = result.filter(p => {
        const isCarbonated = p.type === 'carbonated' || p.name?.toLowerCase().includes('газированн')
        return typeFilter === 'carbonated' ? isCarbonated : !isCarbonated
      })
    }
    return result
  }, [products, volumeFilter, typeFilter])

  return (
    <div style={s.page}>
      {/* Top info section: bonuses + active orders */}
      <div style={s.infoSection}>
        {/* Bonus & Balance cards */}
        <div style={s.infoCards}>
          <div style={s.infoCard} onClick={() => navigate('/profile')}>
            <div style={s.infoCardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2Z" fill={C} opacity="0.9"/>
              </svg>
            </div>
            <div>
              <div style={s.infoCardValue}>{bonus_points.toLocaleString()}</div>
              <div style={s.infoCardLabel}>бонусов</div>
            </div>
          </div>
          <div style={s.infoCard} onClick={() => navigate('/profile')}>
            <div style={s.infoCardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="12" rx="2" stroke={C} strokeWidth="1.8" fill={C + '20'}/>
                <path d="M6 10h3M6 14h5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={s.infoCardValue}>{balance.toLocaleString()}</div>
              <div style={s.infoCardLabel}>баланс</div>
            </div>
          </div>
        </div>

        {/* Active order indicator */}
        {activeOrders.length > 0 && (
          <div style={s.activeOrder} onClick={() => navigate('/orders')}>
            <div style={s.activeOrderDot} />
            <div style={s.activeOrderText}>
              <span style={s.activeOrderTitle}>
                {activeOrders.length === 1 ? 'Активный заказ' : `Активных заказов: ${activeOrders.length}`}
              </span>
              <span style={s.activeOrderSub}>Нажмите для отслеживания</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* Water type filter */}
      <div style={s.filterSection}>
        <div style={s.filterLabel}>Тип воды</div>
        <div style={s.filters}>
          {[
            { key: 'all', label: 'Все' },
            { key: 'still', label: 'Обычная' },
            { key: 'carbonated', label: 'Газированная' },
          ].map(({ key, label }) => (
            <button key={key}
              style={typeFilter === key ? { ...s.chip, ...s.chipActive } : s.chip}
              onClick={() => setTypeFilter(key)}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Volume filters */}
      {(loading || volumes.length > 1) && (
        <div style={{ ...s.filterSection, paddingTop: 10 }}>
          <div style={s.filterLabel}>Объём</div>
          <div style={s.filters}>
            <button
              style={volumeFilter === 'all' ? { ...s.chip, ...s.chipActive } : s.chip}
              onClick={() => setVolumeFilter('all')}
            >
              <span>Все</span>
            </button>
            {volumes.map(v => (
              <button key={v}
                style={String(volumeFilter) === String(v) ? { ...s.chip, ...s.chipActive } : s.chip}
                onClick={() => setVolumeFilter(String(v))}
              >
                <span>{v} л</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
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
            <p style={s.emptySub}>Попробуйте другой фильтр</p>
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}

const s = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: '#eeeef2', minHeight: '100dvh',
  },

  /* Info section */
  infoSection: { padding: '8px 16px 0' },
  infoCards: { display: 'flex', gap: 10 },
  infoCard: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', borderRadius: 16, padding: '12px 14px',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  infoCardIcon: {
    width: 36, height: 36, borderRadius: 12,
    background: C + '15', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  infoCardValue: { fontWeight: 800, fontSize: 16, color: '#1a1a1a', letterSpacing: -0.3 },
  infoCardLabel: { fontSize: 11, color: '#8e8e93', fontWeight: 500, marginTop: -1 },

  /* Active order */
  activeOrder: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', borderRadius: 16, padding: '12px 14px',
    marginTop: 10, cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  activeOrderDot: {
    width: 10, height: 10, borderRadius: 5,
    background: C, flexShrink: 0,
    boxShadow: `0 0 0 3px ${C}30`,
    animation: 'pulse 2s infinite',
  },
  activeOrderText: { flex: 1, display: 'flex', flexDirection: 'column' },
  activeOrderTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a1a' },
  activeOrderSub: { fontSize: 12, color: '#8e8e93' },

  /* Filters */
  filterSection: { padding: '14px 16px 0' },
  filterLabel: {
    fontSize: 13, fontWeight: 600, color: '#8e8e93',
    marginBottom: 8, paddingLeft: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  filters: {
    display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  },
  chip: {
    padding: '9px 20px', borderRadius: 24, border: 'none',
    background: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    color: '#3c3c43', transition: 'all 0.2s ease',
    boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.06)',
  },
  chipActive: {
    background: C, color: '#fff',
    boxShadow: `0 2px 12px rgba(141,198,63,0.3)`,
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
