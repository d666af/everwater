import { useState } from 'react'
import { createReview } from '../api'

export default function ReviewModal({ orderId, onClose, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!rating) { setError('Поставьте оценку'); return }
    setLoading(true)
    setError('')
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
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={e => e.stopPropagation()}>
        <div style={styles.handle} />
        <h3 style={styles.title}>Оставить отзыв</h3>
        <p style={styles.sub}>Как прошла доставка?</p>

        <div style={styles.stars}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} style={styles.star} onClick={() => setRating(s)}>
              <span style={{ fontSize: 36, opacity: s <= rating ? 1 : 0.3 }}>⭐</span>
            </button>
          ))}
        </div>

        <textarea
          style={styles.textarea}
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>Отмена</button>
          <button style={styles.submitBtn} onClick={submit} disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    background: 'var(--tg-theme-bg-color, #fff)',
    borderRadius: '20px 20px 0 0',
    padding: '12px 20px 32px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    background: 'var(--tg-theme-hint-color, #ddd)',
    margin: '0 auto 8px',
  },
  title: { fontSize: 20, fontWeight: 700, textAlign: 'center' },
  sub: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: -4 },
  stars: { display: 'flex', justifyContent: 'center', gap: 8 },
  star: { background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  textarea: {
    border: '1px solid var(--tg-theme-hint-color, #ddd)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: 14, resize: 'none',
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    color: 'var(--tg-theme-text-color, #000)',
    outline: 'none', width: '100%',
  },
  error: { color: '#e53935', fontSize: 13, textAlign: 'center' },
  actions: { display: 'flex', gap: 10 },
  cancelBtn: {
    flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
    background: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    color: 'var(--tg-theme-text-color, #333)',
  },
  submitBtn: {
    flex: 2, padding: '12px 0', borderRadius: 12, border: 'none',
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
}
