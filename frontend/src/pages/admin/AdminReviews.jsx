import { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getReviews } from '../../api'

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

export default function AdminReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const [filterCourier, setFilterCourier] = useState('all')
  const [filterRating, setFilterRating] = useState(0)   // 0 = all
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    getReviews(false).then(setReviews).catch(console.error).finally(() => setLoading(false))
  }, [])

  const couriers = useMemo(() => {
    const names = [...new Set(reviews.map(r => r.courier_name).filter(Boolean))]
    return names.sort()
  }, [reviews])

  const visible = useMemo(() => {
    return reviews.filter(r => {
      if (filterCourier !== 'all' && r.courier_name !== filterCourier) return false
      if (filterRating > 0 && r.rating !== filterRating) return false
      if (dateFrom) {
        const d = new Date(r.created_at)
        if (d < new Date(dateFrom)) return false
      }
      if (dateTo) {
        const d = new Date(r.created_at)
        if (d > new Date(dateTo + 'T23:59:59')) return false
      }
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase()
        if (!(r.order_items || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [reviews, filterCourier, filterRating, dateFrom, dateTo, productSearch])

  const clearFilters = () => {
    setFilterCourier('all')
    setFilterRating(0)
    setDateFrom('')
    setDateTo('')
    setProductSearch('')
  }

  const hasFilter = filterCourier !== 'all' || filterRating > 0 || dateFrom || dateTo || productSearch.trim()

  return (
    <AdminLayout title="Отзывы">
      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>

        {/* Courier chips */}
        {couriers.length > 0 && (
          <div>
            <div style={s.filterLabel}>Курьер</div>
            <div style={s.chipRow}>
              <button style={{ ...s.chip, ...(filterCourier === 'all' ? s.chipActive : {}) }}
                onClick={() => setFilterCourier('all')}>Все</button>
              {couriers.map(name => (
                <button key={name}
                  style={{ ...s.chip, ...(filterCourier === name ? s.chipActive : {}) }}
                  onClick={() => setFilterCourier(filterCourier === name ? 'all' : name)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rating chips */}
        <div>
          <div style={s.filterLabel}>Оценка</div>
          <div style={s.chipRow}>
            <button style={{ ...s.chip, ...(filterRating === 0 ? s.chipActive : {}) }}
              onClick={() => setFilterRating(0)}>Все</button>
            {[5, 4, 3, 2, 1].map(n => (
              <button key={n}
                style={{ ...s.chip, ...(filterRating === n ? s.chipStar : {}) }}
                onClick={() => setFilterRating(filterRating === n ? 0 : n)}>
                {'★'.repeat(n)}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <div style={s.filterLabel}>Дата</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={s.dateInput} placeholder="От" />
            <span style={{ color: TEXT2, fontSize: 13 }}>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={s.dateInput} placeholder="До" />
          </div>
        </div>

        {/* Product search */}
        <div>
          <div style={s.filterLabel}>Товар</div>
          <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
            placeholder="Поиск по товарам..." style={{ ...s.dateInput, width: '100%' }} />
        </div>

        {hasFilter && (
          <button onClick={clearFilters} style={s.clearBtn}>Сбросить фильтры</button>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: 13, color: TEXT2, marginBottom: 12, fontWeight: 600 }}>
        Показано: {visible.length} из {reviews.length}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: TEXT2, padding: 40 }}>Загрузка...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', color: TEXT2, padding: 40 }}>Нет отзывов</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(r => (
            <div key={r.id} style={s.card}>
              {/* Stars + date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ color: n <= r.rating ? '#FFA726' : '#ddd', fontSize: 20 }}>★</span>
                  ))}
                </div>
                {r.created_at && (
                  <span style={{ fontSize: 12, color: TEXT2 }}>
                    {new Date(r.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Comment */}
              {r.comment && (
                <div style={{ fontSize: 14, color: TEXT, marginBottom: 10, lineHeight: 1.5,
                  background: '#f8f8fa', borderRadius: 10, padding: '10px 12px' }}>
                  "{r.comment}"
                </div>
              )}

              {/* Photo */}
              {r.photo_url && (
                <img src={r.photo_url} alt="review"
                  style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, marginBottom: 10, display: 'block', cursor: 'pointer' }}
                  onClick={() => window.open(r.photo_url, '_blank')}
                />
              )}

              {/* Client + courier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {r.client_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke={TEXT2} strokeWidth="1.8"/>
                      <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{r.client_name}</span>
                    {r.client_phone && <span style={{ fontSize: 12, color: TEXT2 }}>{r.client_phone}</span>}
                  </div>
                )}
                {r.courier_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" stroke="#1971C2" strokeWidth="1.8"/>
                      <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="#1971C2" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize: 13, color: '#1971C2', fontWeight: 600 }}>Курьер: {r.courier_name}</span>
                    {r.courier_phone && <span style={{ fontSize: 12, color: TEXT2 }}>{r.courier_phone}</span>}
                  </div>
                )}
              </div>

              {/* Order info */}
              <div style={{ background: '#f8f8fa', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: TEXT2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: TEXT }}>Заказ #{r.order_id}</span>
                  {r.order_total != null && (
                    <span style={{ fontWeight: 700, color: C }}>{Number(r.order_total).toLocaleString('ru-RU')} сум</span>
                  )}
                </div>
                {r.order_items && (
                  <div style={{ marginTop: 3, color: TEXT2 }}>{r.order_items}</div>
                )}
                {r.order_address && (
                  <div style={{ marginTop: 2, color: TEXT2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📍 {r.order_address}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const s = {
  filterLabel: { fontSize: 11, fontWeight: 700, color: TEXT2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  chipActive: { background: C, color: '#fff', border: `1.5px solid ${C}` },
  chipStar: { background: '#FFF8E6', color: '#E67700', border: '1.5px solid #FFD94A' },
  dateInput: {
    padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`,
    fontSize: 13, color: TEXT, background: '#fff', outline: 'none',
  },
  clearBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: '#FFF5F5', color: '#E03131', fontSize: 13, fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: 16,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
}
