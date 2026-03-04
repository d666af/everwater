import { useEffect, useState, useMemo } from 'react'
import { getProducts } from '../api'
import ProductCard from '../components/ProductCard'

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
    const unique = [...new Set(products.map(p => p.volume))].sort((a, b) => a - b)
    return unique
  }, [products])

  const filtered = useMemo(() => {
    if (volumeFilter === 'all') return products
    return products.filter(p => String(p.volume) === String(volumeFilter))
  }, [products, volumeFilter])

  if (loading) return <div style={styles.center}>Загрузка...</div>
  if (!products.length) return (
    <div style={styles.center}>
      <div style={{ fontSize: 48 }}>💧</div>
      <div>Товары пока не добавлены</div>
    </div>
  )

  return (
    <div style={styles.page}>
      {volumes.length > 1 && (
        <div style={styles.filters}>
          <button
            style={{ ...styles.chip, ...(volumeFilter === 'all' ? styles.chipActive : {}) }}
            onClick={() => setVolumeFilter('all')}
          >
            Все
          </button>
          {volumes.map(v => (
            <button
              key={v}
              style={{ ...styles.chip, ...(String(volumeFilter) === String(v) ? styles.chipActive : {}) }}
              onClick={() => setVolumeFilter(String(v))}
            >
              {v} л
            </button>
          ))}
        </div>
      )}

      <div style={styles.grid}>
        {filtered.map(p => <ProductCard key={p.id} product={p} />)}
      </div>

      {filtered.length === 0 && (
        <div style={styles.center}>Нет товаров по выбранному фильтру</div>
      )}

      <div style={{ height: 80 }} />
    </div>
  )
}

const C = 'var(--tg-theme-button-color, #2481cc)'
const BG = 'var(--tg-theme-secondary-bg-color, #f5f5f5)'

const styles = {
  page: { display: 'flex', flexDirection: 'column' },
  filters: {
    display: 'flex', gap: 8, padding: '12px 16px 4px', overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  chip: {
    padding: '6px 16px', borderRadius: 20,
    border: 'var(--tg-theme-hint-color, #ddd) 1px solid',
    background: BG, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    color: 'var(--tg-theme-text-color, #333)',
  },
  chipActive: { background: C, color: '#fff', borderColor: C },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
    padding: '12px 16px',
  },
  center: {
    textAlign: 'center', padding: 40, color: '#888',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
}
