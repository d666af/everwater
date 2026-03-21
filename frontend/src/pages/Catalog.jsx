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

  return (
    <div style={s.page}>
      {/* Compact promo strip */}
      <div style={s.promoStrip}>
        <div style={s.promoItem}>
          <div style={s.promoIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#fff"/>
            </svg>
          </div>
          <span style={s.promoText}>Доставка 1–3 ч</span>
        </div>
        <div style={s.promoDot} />
        <div style={s.promoItem}>
          <div style={s.promoIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" fill="#fff"/>
            </svg>
          </div>
          <span style={s.promoText}>Гарантия качества</span>
        </div>
      </div>

      {/* Volume filters */}
      {(loading || volumes.length > 1) && (
        <div style={s.filterWrap}>
          <div style={s.filters}>
            <button
              style={volumeFilter === 'all' ? { ...s.chip, ...s.chipActive } : s.chip}
              onClick={() => setVolumeFilter('all')}
            >Все</button>
            {volumes.map(v => (
              <button key={v}
                style={String(volumeFilter) === String(v) ? { ...s.chip, ...s.chipActive } : s.chip}
                onClick={() => setVolumeFilter(String(v))}
              >{v} л</button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={s.grid}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !products.length && (
        <div style={s.empty}>
          <div style={s.emptyDrop}>
            <svg width="44" height="52" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill={C + '20'} stroke={C} strokeWidth="1.5"/>
            </svg>
          </div>
          <p style={s.emptyTitle}>Пока пусто</p>
          <p style={s.emptySub}>Товары скоро появятся</p>
        </div>
      )}

      {/* Product grid */}
      {!loading && products.length > 0 && (
        <div style={s.grid}>
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && products.length > 0 && (
        <div style={s.noResults}>Нет товаров по выбранному объёму</div>
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}

const s = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: '#fafafa', minHeight: '100dvh',
  },
  promoStrip: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: '10px 16px',
    background: `linear-gradient(135deg, ${C}, #6daa2e)`,
    margin: '0 12px', borderRadius: 14,
  },
  promoItem: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  promoIcon: {
    width: 24, height: 24, borderRadius: 8,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  promoText: {
    fontSize: 12, fontWeight: 600, color: '#fff',
    whiteSpace: 'nowrap',
  },
  promoDot: {
    width: 3, height: 3, borderRadius: '50%',
    background: 'rgba(255,255,255,0.5)', flexShrink: 0,
  },
  filterWrap: {
    padding: '12px 12px 4px',
  },
  filters: {
    display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none',
  },
  chip: {
    padding: '8px 18px', borderRadius: 12, border: 'none',
    background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, color: '#666',
    transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  chipActive: {
    background: C, color: '#fff',
    boxShadow: `0 2px 8px ${C}50`,
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10, padding: '8px 12px',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '50vh', gap: 8,
  },
  emptyDrop: { marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: 700, color: '#333', margin: 0 },
  emptySub: { fontSize: 13, color: '#999', margin: 0 },
  noResults: { textAlign: 'center', color: '#999', fontSize: 14, padding: 40 },
}
