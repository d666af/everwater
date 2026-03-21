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
      {/* Hero banner */}
      <div style={s.hero}>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Свежая вода</h1>
          <p style={s.heroSub}>с доставкой до двери</p>
        </div>
        <div style={s.heroIcon}>
          <svg width="52" height="62" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
          </svg>
        </div>
      </div>

      {/* Quick info bar */}
      <div style={s.infoBar}>
        <div style={s.infoPill}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" fill={C}/>
          </svg>
          Проверенное качество
        </div>
        <div style={s.infoPill}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.8"/>
            <path d="M12 7v5l3 3" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Доставка 1–3 ч
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

      {loading && <div style={s.grid}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>}

      {!loading && !products.length && (
        <div style={s.empty}>
          <svg width="48" height="56" viewBox="0 0 40 48" fill="none">
            <path d="M20 2C20 2 4 20 4 30C4 39.9 11.2 47 20 47C28.8 47 36 39.9 36 30C36 20 20 2 20 2Z"
              fill="#E8F5E9" stroke={C} strokeWidth="1.5"/>
          </svg>
          <p style={s.emptyText}>Товары пока не добавлены</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div style={s.grid}>{filtered.map(p => <ProductCard key={p.id} product={p} />)}</div>
      )}

      {!loading && filtered.length === 0 && products.length > 0 && (
        <div style={s.noResults}>Нет товаров по выбранному объёму</div>
      )}
      <div style={{ height: 24 }} />
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', background: '#fafafa', minHeight: '100dvh' },
  hero: {
    background: `linear-gradient(135deg, ${C} 0%, #6CA32F 100%)`,
    margin: '0 16px 12px', borderRadius: 18, padding: '20px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  heroContent: { position: 'relative', zIndex: 1 },
  heroTitle: {
    fontSize: 24, fontWeight: 800, color: '#fff', margin: 0,
    letterSpacing: -0.5, lineHeight: 1.1,
  },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0', fontWeight: 400 },
  heroIcon: { opacity: 0.6, marginRight: -4 },
  infoBar: {
    display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none',
  },
  infoPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff', border: '1px solid #E8F5E9', borderRadius: 20,
    padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#555',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  filters: {
    display: 'flex', gap: 8, padding: '0 16px 12px',
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  chip: {
    padding: '8px 18px', borderRadius: 20, border: '1px solid #e8e8e8',
    background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, color: '#666', transition: 'all 0.15s',
  },
  chipActive: { background: C, color: '#fff', borderColor: C },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 16px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '45vh', gap: 14,
  },
  emptyText: { color: '#999', fontSize: 15, margin: 0 },
  noResults: { textAlign: 'center', color: '#999', fontSize: 14, padding: 40 },
}
