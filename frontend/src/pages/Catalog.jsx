import { useEffect, useState, useMemo } from 'react'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'
import { SkeletonCard } from '../components/Skeleton'

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
        <h1 style={s.heading}>Свежая вода</h1>
        <p style={s.sub}>с доставкой до двери</p>
      </div>

      {(loading || volumes.length > 1) && (
        <div style={s.filters}>
          <button
            style={volumeFilter === 'all' ? { ...s.chip, ...s.chipActive } : s.chip}
            onClick={() => setVolumeFilter('all')}
          >
            Все
          </button>
          {volumes.map(v => (
            <button
              key={v}
              style={String(volumeFilter) === String(v) ? { ...s.chip, ...s.chipActive } : s.chip}
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
          <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5"/>
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
    background: '#fafafa',
    minHeight: '100dvh',
  },
  hero: {
    padding: '4px 20px 14px',
  },
  heading: {
    fontSize: 28,
    fontWeight: 800,
    color: '#111',
    letterSpacing: -0.8,
    margin: 0,
    lineHeight: 1.1,
  },
  sub: {
    fontSize: 15,
    color: '#999',
    margin: '4px 0 0',
    fontWeight: 400,
  },
  filters: {
    display: 'flex',
    gap: 8,
    padding: '0 20px 14px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  chip: {
    padding: '7px 16px',
    borderRadius: 10,
    border: '1px solid #eee',
    background: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    color: '#666',
    transition: 'all 0.15s',
  },
  chipActive: {
    background: '#111',
    color: '#fff',
    borderColor: '#111',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    padding: '0 20px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '50vh',
    gap: 14,
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
    margin: 0,
  },
  noResults: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    padding: 40,
  },
}
