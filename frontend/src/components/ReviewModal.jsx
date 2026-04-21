import { useState } from 'react'
import { createReview } from '../api'

const C = '#8DC63F'
const CD = '#6CA32F'

export default function ReviewModal({ order, orderId, onClose, onDone, autoPopup = false }) {
  // Support both old calling style (orderId only) and new (full order)
  const id = order?.id || orderId
  const courier = order?.courier_name
  const courierId = order?.courier_id

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!rating) { setError('Поставьте оценку'); return }
    setLoading(true); setError('')
    try {
      await createReview({ order_id: id, courier_id: courierId, rating, comment: comment || null })
      onDone()
    } catch {
      setError('Не удалось отправить отзыв')
    } finally {
      setLoading(false)
    }
  }

  const ratingText = ['', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'][rating] || ''

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        {autoPopup && (
          <div style={{ background: 'linear-gradient(135deg,#A8D86D,#7EC840)', borderRadius: 12, padding: '10px 14px', textAlign: 'center', marginBottom: -6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Заказ доставлен!</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Оцените доставку ниже</div>
          </div>
        )}
        <h3 style={s.title}>Как прошла доставка?</h3>

        {courier && (
          <div style={s.courierCard}>
            <div style={s.courierAvatar}>{courier[0]?.toUpperCase()}</div>
            <div>
              <div style={s.courierLabel}>Курьер</div>
              <div style={s.courierName}>{courier}</div>
            </div>
          </div>
        )}

        <div style={s.stars}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} style={s.star} onClick={() => setRating(n)}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill={n <= rating ? '#FFA726' : 'none'}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke={n <= rating ? '#FFA726' : '#ddd'} strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
        {ratingText && <div style={s.ratingLabel}>{ratingText}</div>}

        <textarea
          style={s.textarea}
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

        {error && <div style={s.error}>{error}</div>}

        <button style={{ ...s.submitBtn, ...(rating ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }} disabled={loading || !rating} onClick={submit}>
          {loading ? 'Отправка...' : 'Отправить отзыв'}
        </button>
        <button style={s.cancelBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'flex-end',
    backdropFilter: 'blur(4px)',
  },
  sheet: {
    width: '100%', background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '8px 20px 36px',
    display: 'flex', flexDirection: 'column', gap: 14,
    animation: 'slideUp 0.25s ease',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: '#e0e0e0', margin: '4px auto 6px',
  },
  title: {
    fontSize: 20, fontWeight: 700, textAlign: 'center',
    color: '#111', letterSpacing: -0.3, margin: 0,
  },
  courierCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: `linear-gradient(135deg, ${C}, ${CD})`, borderRadius: 14, padding: '12px 16px',
    color: '#fff',
  },
  courierAvatar: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'rgba(255,255,255,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0,
  },
  courierLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: 0.3 },
  courierName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  stars: { display: 'flex', justifyContent: 'center', gap: 4 },
  star: { background: 'none', border: 'none', cursor: 'pointer', padding: 2 },
  ratingLabel: { textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#FFA726', marginTop: -4 },
  textarea: {
    border: '1.5px solid #eee', borderRadius: 14, padding: '12px 14px',
    fontSize: 15, resize: 'none', background: '#f7f7f8',
    color: '#111', outline: 'none', width: '100%', lineHeight: 1.5,
    fontFamily: 'inherit', transition: 'border-color 0.2s', boxSizing: 'border-box',
  },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: 600 },
  submitBtn: {
    width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.35)',
  },
  cancelBtn: {
    width: '100%', padding: '12px 0', borderRadius: 14,
    border: 'none', background: '#f2f2f3',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#888',
  },
}
