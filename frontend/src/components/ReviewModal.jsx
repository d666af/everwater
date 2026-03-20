import { useState } from 'react'
import { createReview } from '../api'

export default function ReviewModal({ orderId, onClose, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!rating) { setError('Поставьте оценку'); return }
    setLoading(true); setError('')
    try {
      await createReview({ order_id: orderId, rating, comment: comment || null })
      onDone()
    } catch {
      setError('Не удалось отправить отзыв')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <h3 style={s.title}>Как прошла доставка?</h3>

        <div style={s.stars}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} style={s.star} onClick={() => setRating(n)}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill={n <= rating ? '#FFA726' : 'none'}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  stroke={n <= rating ? '#FFA726' : '#ddd'} strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>

        <textarea
          style={s.textarea}
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

        {error && <div style={s.error}>{error}</div>}

        <button style={s.submitBtn} onClick={submit} disabled={loading}>
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
  stars: { display: 'flex', justifyContent: 'center', gap: 6 },
  star: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  textarea: {
    border: '1.5px solid #eee', borderRadius: 14, padding: '12px 14px',
    fontSize: 15, resize: 'none', background: '#f7f7f8',
    color: '#111', outline: 'none', width: '100%', lineHeight: 1.5,
    fontFamily: 'inherit', transition: 'border-color 0.2s',
  },
  error: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: 600 },
  submitBtn: {
    width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
    background: '#4CAF50', color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer',
  },
  cancelBtn: {
    width: '100%', padding: '12px 0', borderRadius: 14,
    border: 'none', background: '#f2f2f3',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#888',
  },
}
