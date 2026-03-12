import { useEffect, useState, useMemo } from 'react'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

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
      {/* Page heading */}
      <div style={s.heading}>
        <div>
          <h1 style={s.headingTitle}>Каталог</h1>
          <p style={s.headingSubtitle}>Чистая вода с доставкой</p>
        </div>
        <div style={s.waterIcon}>
          <svg width="36" height="44" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill={C} opacity="0.9"/>
            <path d="M12 30C12 30 14 24 20 22C26 24 28 30 28 30"
              stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Volume filters */}
      {(loading || volumes.length > 1) && (
        <div style={s.filterSection}>
          <div style={s.filterScroll}>
            <button
              style={{ ...s.chip, ...(volumeFilter === 'all' ? s.chipActive : {}) }}
              onClick={() => setVolumeFilter('all')}
            >
              Все
            </button>
            {volumes.map(v => (
              <button
                key={v}
                style={{ ...s.chip, ...(String(volumeFilter) === String(v) ? s.chipActive : {}) }}
                onClick={() => setVolumeFilter(String(v))}
              >
                {v} л
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={s.grid}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !products.length && (
        <div style={s.emptyPage}>
          <div style={s.emptyIconWrap}>
            <svg width="48" height="58" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill="#E8F7D0" stroke={C} strokeWidth="1.5"/>
            </svg>
          </div>
          <p style={s.emptyText}>Товары пока не добавлены</p>
        </div>
      )}

      {/* Product count + grid */}
      {!loading && products.length > 0 && (
        <>
          <div style={s.countBar}>
            <span style={s.countText}>
              {filtered.length} {filtered.length === 1 ? 'товар' : filtered.length < 5 ? 'товара' : 'товаров'}
            </span>
          </div>

          <div style={s.grid}>
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
          </div>

          {filtered.length === 0 && (
            <div style={s.noResults}>Нет товаров по выбранному объёму</div>
          )}
        </>
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    background: BG,
    minHeight: '100vh',
  },
  heading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '20px 16px 12px',
    background: '#FFFFFF',
    borderBottom: `1px solid ${BORDER}`,
  },
  headingTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: -0.5,
    margin: 0,
    lineHeight: 1.1,
  },
  headingSubtitle: {
    fontSize: 14,
    color: TEXT2,
    margin: '4px 0 0',
    fontWeight: 400,
  },
  waterIcon: {
    opacity: 0.85,
    flexShrink: 0,
  },
  filterSection: {
    padding: '12px 16px 8px',
    background: '#FFFFFF',
  },
  filterScroll: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: 2,
  },
  chip: {
    padding: '7px 16px',
    borderRadius: 999,
    border: `1.5px solid ${BORDER}`,
    background: '#FFFFFF',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    color: TEXT2,
    transition: TRANSITION,
    lineHeight: 1,
  },
  chipActive: {
    background: C,
    borderColor: C,
    color: '#fff',
  },
  countBar: {
    padding: '12px 16px 4px',
  },
  countText: {
    fontSize: 13,
    color: TEXT2,
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))',
    gap: 12,
    padding: '8px 16px 0',
  },
  emptyPage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${BORDER}`,
  },
  emptyText: {
    color: TEXT2,
    fontSize: 15,
    margin: 0,
  },
  noResults: {
    textAlign: 'center',
    color: TEXT2,
    fontSize: 14,
    padding: 32,
  },
}
