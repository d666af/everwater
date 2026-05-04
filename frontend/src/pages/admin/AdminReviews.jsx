import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getReviews, approveReview, hideReview } from '../../api'

const C = '#8DC63F'

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

  return (
    <AdminLayout title="Отзывы">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'approved', 'pending'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: filter === f ? C : '#f2f2f7', color: filter === f ? '#fff' : '#666' }}>
            {f === 'all' ? 'Все' : f === 'approved' ? 'Одобрено' : 'На модерации'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#8e8e93', padding: 40 }}>Загрузка...</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8e8e93', padding: 40 }}>Нет отзывов</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)', opacity: r.is_approved ? 1 : 0.75 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(n => (
                    <span key={n} style={{ color: n <= r.rating ? '#FFA726' : '#ddd', fontSize: 16 }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, fontWeight: 600,
                  background: r.is_approved ? '#EBFBEE' : '#FFF5F5',
                  color: r.is_approved ? '#2B8A3E' : '#E03131' }}>
                  {r.is_approved ? 'Одобрен' : 'Скрыт'}
                </span>
              </div>
              {r.comment && <div style={{ fontSize: 14, color: '#3c3c43', marginBottom: 8, lineHeight: 1.5 }}>{r.comment}</div>}
              {r.photo_url && (
                <img src={r.photo_url} alt="review" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, marginBottom: 8, display: 'block' }} />
              )}
              <div style={{ fontSize: 12, color: '#8e8e93', marginBottom: 12 }}>
                Заказ #{r.order_id} · Пользователь #{r.user_id}
              </div>
              <button onClick={() => toggle(r)}
                style={{ padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: r.is_approved ? '#fef2f2' : `${C}15`,
                  color: r.is_approved ? '#c0392b' : '#2B8A3E' }}>
                {r.is_approved ? 'Скрыть' : 'Одобрить'}
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
