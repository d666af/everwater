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
  const [filterRating, setFilterRating] = useState(0)
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

  const visible = useMemo(() => reviews.filter(r => {
    if (filterCourier !== 'all' && r.courier_name !== filterCourier) return false
    if (filterRating > 0 && r.rating !== filterRating) return false
    if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(r.created_at) > new Date(dateTo + 'T23:59:59')) return false
    if (productSearch.trim() && !(r.order_items || '').toLowerCase().includes(productSearch.trim().toLowerCase())) return false
    return true
  }), [reviews, filterCourier, filterRating, dateFrom, dateTo, productSearch])

  const hasFilter = filterCourier !== 'all' || filterRating > 0 || dateFrom || dateTo || productSearch.trim()

  return (
    <AdminLayout title="Отзывы">

      {/* Filter card */}
      <div style={s.filterCard}>

        {/* Rating row */}
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Оценка</span>
          <div style={s.chipRow}>
            {[0,5,4,3,2,1].map(n => (
              <button key={n}
                onClick={() => setFilterRating(filterRating === n ? 0 : n)}
                style={{
                  ...s.ratingBtn,
                  ...(filterRating === n
                    ? (n === 0 ? s.ratingBtnActiveNeutral : s.ratingBtnActiveStar)
                    : {}),
                }}>
                {n === 0 ? 'Все' : '★'.repeat(n)}
              </button>
            ))}
          </div>
        </div>

        {/* Courier row */}
        {couriers.length > 0 && (
          <div style={s.filterRow}>
            <span style={s.filterLabel}>Курьер</span>
            <div style={{ ...s.chipRow, flexWrap: 'wrap' }}>
              <button
                onClick={() => setFilterCourier('all')}
                style={{ ...s.pill, ...(filterCourier === 'all' ? s.pillActive : {}) }}>
                Все
              </button>
              {couriers.map(name => (
                <button key={name}
                  onClick={() => setFilterCourier(filterCourier === name ? 'all' : name)}
                  style={{ ...s.pill, ...(filterCourier === name ? s.pillActive : {}) }}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dates row */}
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Дата</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={s.dateInput} />
            <span style={{ color: TEXT2, fontSize: 12, flexShrink: 0 }}>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={s.dateInput} />
          </div>
        </div>

        {/* Product search */}
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Товар</span>
          <input
            type="text" value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Фильтр по товарам…"
            style={{ ...s.dateInput, flex: 1 }} />
        </div>

        {hasFilter && (
          <button onClick={() => { setFilterCourier('all'); setFilterRating(0); setDateFrom(''); setDateTo(''); setProductSearch('') }}
            style={s.clearBtn}>
            Сбросить фильтры
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: TEXT2, marginBottom: 12, fontWeight: 600 }}>
        {visible.length} из {reviews.length} отзывов
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: TEXT2, padding: 40 }}>Загрузка...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', color: TEXT2, padding: 40 }}>Нет отзывов</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(r => (
            <div key={r.id} style={s.card}>
              {/* Stars + date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 1 }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ color: n <= r.rating ? '#FFA726' : '#E0E0E0', fontSize: 18, lineHeight: 1 }}>★</span>
                  ))}
                </div>
                {r.created_at && (
                  <span style={{ fontSize: 11, color: TEXT2 }}>
                    {new Date(r.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Comment */}
              {r.comment && (
                <div style={{ fontSize: 14, color: TEXT, marginBottom: 10, lineHeight: 1.5,
                  background: '#F8F9FA', borderRadius: 10, padding: '9px 12px' }}>
                  "{r.comment}"
                </div>
              )}

              {/* Photo */}
              {r.photo_url && (
                <img src={r.photo_url} alt="review"
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, marginBottom: 10, display: 'block', cursor: 'pointer' }}
                  onClick={() => window.open(r.photo_url, '_blank')} />
              )}

              {/* People */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                {r.client_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={s.avatar}>{(r.client_name[0] || '?').toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{r.client_name}</div>
                      {r.client_phone && <div style={{ fontSize: 11, color: TEXT2 }}>{r.client_phone}</div>}
                    </div>
                  </div>
                )}
                {r.courier_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ ...s.avatar, background: '#EDF3FF', color: '#3B5BDB' }}>{(r.courier_name[0] || '?').toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1971C2' }}>{r.courier_name}</div>
                      {r.courier_phone && <div style={{ fontSize: 11, color: TEXT2 }}>{r.courier_phone}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Order chip */}
              <div style={s.orderRow}>
                <span style={s.orderBadge}>#{r.order_id}</span>
                {r.order_total != null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: C }}>{Number(r.order_total).toLocaleString('ru-RU')} сум</span>
                )}
                {r.order_items && <span style={{ fontSize: 12, color: TEXT2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.order_items}</span>}
              </div>
              {r.order_address && (
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📍 {r.order_address}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const s = {
  filterCard: {
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  filterRow: { display: 'flex', alignItems: 'center', gap: 10 },
  filterLabel: { fontSize: 12, fontWeight: 700, color: TEXT2, width: 52, flexShrink: 0 },
  chipRow: { display: 'flex', gap: 5, flex: 1, overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  ratingBtn: {
    padding: '5px 9px', borderRadius: 10,
    border: `1.5px solid ${BORDER}`, background: 'transparent',
    color: TEXT2, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    flexShrink: 0, WebkitTapHighlightColor: 'transparent',
  },
  ratingBtnActiveNeutral: { background: C, color: '#fff', borderColor: C },
  ratingBtnActiveStar: { background: '#FFF8E6', color: '#E67700', borderColor: '#FFD94A' },
  pill: {
    padding: '5px 11px', borderRadius: 20,
    border: `1.5px solid ${BORDER}`, background: 'transparent',
    color: TEXT2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    flexShrink: 0, WebkitTapHighlightColor: 'transparent',
  },
  pillActive: { background: C, color: '#fff', borderColor: C },
  dateInput: {
    padding: '6px 10px', borderRadius: 10,
    border: `1.5px solid ${BORDER}`, fontSize: 12,
    color: TEXT, background: '#F8F9FA', outline: 'none',
    flex: 1, minWidth: 0,
  },
  clearBtn: {
    alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 10,
    border: 'none', cursor: 'pointer',
    background: '#FFF5F5', color: '#E03131',
    fontSize: 12, fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 28, height: 28, borderRadius: 9,
    background: '#F2F2F7', color: TEXT2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 800, flexShrink: 0,
  },
  orderRow: { display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' },
  orderBadge: {
    fontSize: 11, fontWeight: 800, color: TEXT2,
    background: '#F2F2F7', padding: '3px 8px', borderRadius: 8, flexShrink: 0,
  },
}
