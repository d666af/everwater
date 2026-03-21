import { useEffect, useState, useMemo } from 'react'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'

const C = '#8DC63F'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [volumeFilter, setVolumeFilter] = useState('all')

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
    if (volumeFilter === 'all') return products
    return products.filter(p => String(p.volume) === String(volumeFilter))
  }, [products, volumeFilter])

  const hours = new Date().getHours()
  const greet = hours < 12 ? 'Доброе утро' : hours < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div style={s.page}>
      {/* Greeting */}
      <div style={s.greetWrap}>
        <h1 style={s.greet}>{greet} 👋</h1>
        <p style={s.greetSub}>Что закажем сегодня?</p>
      </div>

      {/* Delivery info banner */}
      <div style={s.banner}>
        <div style={s.bannerLeft}>
          <div style={s.bannerIcon}>🚀</div>
          <div>
            <div style={s.bannerTitle}>Бесплатная доставка</div>
            <div style={s.bannerSub}>от 1 часа · до двери</div>
          </div>
        </div>
      </div>

      {/* Category filters */}
      {(loading || volumes.length > 1) && (
        <div style={s.filterSection}>
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
            <p style={s.emptySub}>Попробуйте другой объём</p>
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
    background: '#f4f4f8', minHeight: '100dvh',
  },

  /* Greeting */
  greetWrap: { padding: '4px 20px 0' },
  greet: {
    fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: 0,
    letterSpacing: -0.5,
  },
  greetSub: {
    fontSize: 14, color: '#8e8e93', margin: '2px 0 0', fontWeight: 500,
  },

  /* Banner */
  banner: {
    margin: '14px 16px 0', padding: '14px 16px',
    background: 'linear-gradient(135deg, #e8f7d5 0%, #d4edba 100%)',
    borderRadius: 16, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  bannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    background: 'rgba(255,255,255,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 20,
  },
  bannerTitle: { fontSize: 14, fontWeight: 700, color: '#2d5a0f' },
  bannerSub: { fontSize: 12, color: '#5a8a3a', marginTop: 1 },

  /* Filters */
  filterSection: { padding: '16px 16px 0' },
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
    background: '#1a1a1a', color: '#fff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
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
