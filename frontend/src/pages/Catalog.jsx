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
      {/* Greeting section */}
      <div style={s.greeting}>
        <div>
          <h1 style={s.greetTitle}>Доставка воды</h1>
          <p style={s.greetSub}>Выберите воду — привезём за 1–3 часа</p>
        </div>
      </div>

      {/* Filters */}
      {(loading || volumes.length > 1) && (
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
      )}

      {loading && (
        <div style={s.list}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && !products.length && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>
            <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
              <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
                fill="#E8F5E9" stroke={C} strokeWidth="1.5"/>
            </svg>
          </div>
          <p style={s.emptyText}>Товары пока не добавлены</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div style={s.list}>{filtered.map(p => <ProductCard key={p.id} product={p} />)}</div>
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
    display: 'flex', flexDirection: 'column', background: '#f7f7f8',
    minHeight: '100dvh',
  },
  greeting: {
    padding: '8px 20px 4px',
  },
  greetTitle: {
    fontSize: 26, fontWeight: 800, color: '#111', margin: 0,
    letterSpacing: -0.5, lineHeight: 1.15,
  },
  greetSub: {
    fontSize: 14, color: '#888', margin: '4px 0 0', fontWeight: 400,
  },
  filters: {
    display: 'flex', gap: 8, padding: '14px 20px 6px',
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  chip: {
    padding: '7px 18px', borderRadius: 12, border: 'none',
    background: '#ebebed', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, color: '#555', transition: 'all 0.15s',
  },
  chipActive: { background: '#111', color: '#fff' },
  list: {
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: '10px 16px',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '50vh', gap: 16,
  },
  emptyIcon: { opacity: 0.6 },
  emptyText: { color: '#999', fontSize: 15, margin: 0 },
  noResults: { textAlign: 'center', color: '#999', fontSize: 14, padding: 40 },
}
