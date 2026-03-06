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
    return [...new Set(products.map(p => p.volume))].sort((a, b) => a - b)
  }, [products])

  const filtered = useMemo(() => {
    if (volumeFilter === 'all') return products
    return products.filter(p => String(p.volume) === String(volumeFilter))
  }, [products, volumeFilter])

  if (loading) return (
    <div style={s.loadingPage}>
      <div style={s.loadingSpinner} />
      <p style={s.loadingText}>Загружаем каталог...</p>
    </div>
  )

  if (!products.length) return (
    <div style={s.emptyPage}>
      <svg width="64" height="80" viewBox="0 0 40 48" fill="none">
        <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
          fill="#E8F7D0" stroke="#8DC63F" strokeWidth="1.5"/>
      </svg>
      <p style={s.emptyText}>Товары пока не добавлены</p>
    </div>
  )

  return (
    <div style={s.page}>
      {/* Hero banner */}
      <div style={s.hero}>
        <div style={s.heroContent}>
          <div style={s.heroTitle}>Чистая вода</div>
          <div style={s.heroSub}>с доставкой до двери</div>
          <div style={s.heroBadges}>
            <span style={s.heroBadge}>💧 Природная</span>
            <span style={s.heroBadge}>⚡ Быстро</span>
            <span style={s.heroBadge}>✓ Надёжно</span>
          </div>
        </div>
        <div style={s.heroIllustration}>
          <svg width="90" height="110" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
            <path d="M12 30C12 30 14 24 20 22C26 24 28 30 28 30"
              stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Volume filters */}
      {volumes.length > 1 && (
        <div style={s.filterSection}>
          <div style={s.filterLabel}>Объём</div>
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

      {/* Product count */}
      <div style={s.countBar}>
        <span style={s.countText}>{filtered.length} товар{filtered.length === 1 ? '' : filtered.length < 5 ? 'а' : 'ов'}</span>
      </div>

      {/* Grid */}
      <div style={s.grid}>
        {filtered.map(p => <ProductCard key={p.id} product={p} />)}
      </div>

      {filtered.length === 0 && (
        <div style={s.noResults}>Нет товаров по выбранному объёму</div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}

const P = '#8DC63F'

const s = {
  page: { display: 'flex', flexDirection: 'column', background: '#F8F8F8', minHeight: '100vh' },
  loadingPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '60vh', gap: 16,
  },
  loadingSpinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid #E8F7D0',
    borderTop: `3px solid ${P}`,
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#888', fontSize: 14 },
  emptyPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '60vh', gap: 12,
  },
  emptyText: { color: '#888', fontSize: 15 },
  hero: {
    background: `linear-gradient(135deg, ${P} 0%, #6CA32F 100%)`,
    margin: '0 16px 0', marginTop: 12,
    borderRadius: 20,
    padding: '20px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  heroContent: { display: 'flex', flexDirection: 'column', gap: 4 },
  heroTitle: { fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 },
  heroBadges: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  heroBadge: {
    background: 'rgba(255,255,255,0.2)',
    color: '#fff', borderRadius: 20, padding: '3px 10px',
    fontSize: 11, fontWeight: 600, backdropFilter: 'blur(4px)',
  },
  heroIllustration: { opacity: 0.7, flexShrink: 0 },
  filterSection: { padding: '16px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 },
  filterScroll: {
    display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2,
  },
  chip: {
    padding: '7px 16px', borderRadius: 999,
    border: '1.5px solid #E8E8E8',
    background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, color: '#555',
    transition: 'all 0.2s',
  },
  chipActive: { background: P, borderColor: P, color: '#fff' },
  countBar: { padding: '8px 16px 4px' },
  countText: { fontSize: 12, color: '#888', fontWeight: 500 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))',
    gap: 10, padding: '0 16px',
  },
  noResults: { textAlign: 'center', color: '#888', fontSize: 14, padding: 32 },
}
