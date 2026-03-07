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

const P = '#8DC63F'
const PD = '#6CA32F'

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end',
    backdropFilter: 'blur(4px)',
  },
  sheet: {
    width: '100%', background: '#fff',
    borderRadius: '24px 24px 0 0',
    padding: '8px 20px 36px',
    display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: '#E0E0E0', margin: '4px auto 6px',
  },
  title: { fontSize: 22, fontWeight: 800, textAlign: 'center', color: '#1A1A1A' },
  sub: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: -8 },
  stars: { display: 'flex', justifyContent: 'center', gap: 6 },
  star: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  textarea: {
    border: '2px solid #E8E8E8', borderRadius: 14, padding: '12px 14px',
    fontSize: 14, resize: 'none', background: '#FAFAFA',
    color: '#1A1A1A', outline: 'none', width: '100%', lineHeight: 1.5,
    fontFamily: 'inherit',
  },
  error: { color: '#E53935', fontSize: 13, textAlign: 'center', fontWeight: 600 },
  actions: { display: 'flex', gap: 10 },
  cancelBtn: {
    flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid #E8E8E8',
    background: '#F5F5F5', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#555',
  },
  submitBtn: {
    flex: 2, padding: '13px 0', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
  },
}
