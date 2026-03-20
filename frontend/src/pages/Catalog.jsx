import { useEffect, useState, useMemo } from 'react'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'

const C = '#7CB342'

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
      <div style={s.hero}>
        <h1 style={s.greeting}>Свежая вода</h1>
        <p style={s.tagline}>с доставкой до двери</p>
      </div>

      {(loading || volumes.length > 1) && (
        <div style={s.filters}>
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
      )}

      {loading && (
        <div style={s.grid}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && !products.length && (
        <div style={s.empty}>
          <svg width="48" height="58" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill="#F1F8E9" stroke={C} strokeWidth="1.5"/>
          </svg>
          <p style={s.emptyText}>Товары пока не добавлены</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div style={s.grid}>
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && products.length > 0 && (
        <div style={s.noResults}>Нет товаров по выбранному объёму</div>
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    background: '#FAFAFA',
    minHeight: '100vh',
  },
  hero: {
    padding: '8px 24px 16px',
  },
  greeting: {
    fontSize: 32,
    fontWeight: 900,
    color: '#212121',
    letterSpacing: -1,
    margin: 0,
    lineHeight: 1.1,
  },
  tagline: {
    fontSize: 16,
    color: '#9E9E9E',
    margin: '4px 0 0',
    fontWeight: 400,
  },
  filters: {
    display: 'flex',
    gap: 8,
    padding: '0 24px 16px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  chip: {
    padding: '8px 18px',
    borderRadius: 12,
    border: 'none',
    background: '#F5F5F5',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    color: '#757575',
    transition: 'all 0.2s',
  },
  chipActive: {
    background: C,
    color: '#fff',
    boxShadow: '0 3px 12px rgba(124,179,66,0.3)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 14,
    padding: '0 20px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    gap: 16,
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 15,
    margin: 0,
  },
  noResults: {
    textAlign: 'center',
    color: '#9E9E9E',
    fontSize: 14,
    padding: 40,
  },
}
