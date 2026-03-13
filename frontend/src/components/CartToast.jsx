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
      setToasts(prev => [...prev.slice(-2), { id, product }])
      setTimeout(() => dismiss(id), 3000)
    })
  }, [dismiss])

  if (!toasts.length) return null

  return (
    <div style={s.wrap}>
      {toasts.map(t => (
        <div key={t.id} style={s.toast} onClick={() => { dismiss(t.id); navigate('/cart') }}>
          <div style={s.icon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
              <line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="2"/>
              <path d="M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={s.text}>
            <div style={s.title}>Добавлено в корзину</div>
            <div style={s.name}>{t.product.name}</div>
          </div>
          <div style={s.action}>Корзина →</div>
        </div>
      ))}
    </div>
  )
}

const s = {
  wrap: {
    position: 'fixed',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none',
  },
  toast: {
    background: 'rgba(28,28,30,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#fff',
    borderRadius: 16,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    maxWidth: 340,
    width: 'calc(100% - 32px)',
    cursor: 'pointer',
    pointerEvents: 'auto',
    animation: 'slideDown 0.25s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: '#8DC63F',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 1,
  },
  action: {
    fontSize: 12,
    color: '#8DC63F',
    fontWeight: 700,
    flexShrink: 0,
  },
}
