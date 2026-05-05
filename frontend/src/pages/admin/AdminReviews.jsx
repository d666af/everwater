import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getReviews, approveReview, hideReview } from '../../api'

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'

export default function AdminReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | pending | approved

  const load = () => {
    setLoading(true)
    getReviews(false).then(setReviews).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const visible = reviews.filter(r => {
    if (filter === 'approved') return r.is_approved
    if (filter === 'pending') return !r.is_approved
    return true
  })

  const toggle = async (r) => {
    if (r.is_approved) {
      await hideReview(r.id)
    } else {
      await approveReview(r.id)
    }
    load()
  }

  const pendingCount = reviews.filter(r => !r.is_approved).length

  return (
    <AdminLayout title="Отзывы">
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all', label: 'Все' },
          { key: 'pending', label: `На модерации${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'approved', label: 'Одобрено' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: filter === f.key ? C : '#f2f2f7', color: filter === f.key ? '#fff' : '#666' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: TEXT2, padding: 40 }}>Загрузка...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', color: TEXT2, padding: 40 }}>
          {filter === 'pending' ? 'Нет отзывов на модерации' : 'Нет отзывов'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(r => (
            <div key={r.id} style={{
              background: '#fff', borderRadius: 16, padding: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              borderLeft: r.is_approved ? `3px solid ${C}` : '3px solid #E03131',
            }}>
              {/* Header: stars + status badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ color: n <= r.rating ? '#FFA726' : '#ddd', fontSize: 18 }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, fontWeight: 700,
                  background: r.is_approved ? '#EBFBEE' : '#FFF5F5',
                  color: r.is_approved ? '#2B8A3E' : '#E03131' }}>
                  {r.is_approved ? 'Одобрен' : 'На модерации'}
                </span>
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

              {/* Client info */}
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
              <div style={{ background: '#f8f8fa', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: TEXT2 }}>
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
                {r.created_at && (
                  <div style={{ marginTop: 3, color: '#b0b0b8' }}>
                    {new Date(r.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Action button */}
              <button onClick={() => toggle(r)}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: r.is_approved ? '#fef2f2' : `${C}18`,
                  color: r.is_approved ? '#c0392b' : '#2B8A3E' }}>
                {r.is_approved ? '✕ Скрыть' : '✓ Одобрить'}
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
