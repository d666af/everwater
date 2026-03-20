import { useEffect, useState, useCallback } from 'react'
import { cartEvents } from '../store'
import { useNavigate } from 'react-router-dom'

export default function CartToast() {
  const [toasts, setToasts] = useState([])
  const navigate = useNavigate()

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    return cartEvents.on((product) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev.slice(-1), { id, product }])
      setTimeout(() => dismiss(id), 2500)
    })
  }, [dismiss])

  if (!toasts.length) return null

  return (
    <div style={s.wrap}>
      {toasts.map(t => (
        <div key={t.id} style={s.toast} onClick={() => { dismiss(t.id); navigate('/cart') }}>
          <div style={s.check}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={s.text}>
            <span style={s.name}>{t.product.name}</span>
            <span style={s.sub}>добавлено в корзину</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const s = {
  wrap: {
    position: 'fixed',
    bottom: 100,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none',
    padding: '0 20px',
  },
  toast: {
    background: '#212121',
    color: '#fff',
    borderRadius: 14,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 360,
    cursor: 'pointer',
    pointerEvents: 'auto',
    animation: 'slideDown 0.3s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: '#7CB342',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
}
