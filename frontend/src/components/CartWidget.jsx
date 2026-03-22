import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore, cartEvents } from '../store'

const C = '#8DC63F'

export default function CartWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const total = useCartStore(s => s.total())
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const [expanded, setExpanded] = useState(false)
  const [notification, setNotification] = useState(null)
  const [bounce, setBounce] = useState(false)

  // Listen for add-to-cart events
  useEffect(() => {
    return cartEvents.on((product) => {
      setNotification(product.name)
      setBounce(true)
      setTimeout(() => setBounce(false), 400)
      setTimeout(() => setNotification(null), 2000)
    })
  }, [])

  // Hide on checkout/admin/login
  const hide = location.pathname === '/checkout'
    || location.pathname === '/login'
    || ['/admin', '/courier', '/manager'].some(p => location.pathname.startsWith(p))
  if (hide || totalQty === 0) return null

  return (
    <div style={s.container}>
      {/* Notification toast */}
      {notification && (
        <div style={s.notif}>
          <div style={s.notifCheck}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={s.notifText}>{notification} добавлено</span>
        </div>
      )}

      {/* Expanded cart panel */}
      {expanded && (
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Корзина</span>
            <button style={s.closeBtn} onClick={() => setExpanded(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div style={s.panelItems}>
            {items.map(({ product, quantity }) => (
              <div key={product.id} style={s.panelItem}>
                <div style={s.panelItemInfo}>
                  <span style={s.panelItemName}>{product.name}</span>
                  <span style={s.panelItemPrice}>{(product.price * quantity).toLocaleString()} сум</span>
                </div>
                <div style={s.panelStepper}>
                  <button style={s.panelStepBtn}
                    onClick={() => useCartStore.getState().updateQuantity(product.id, quantity - 1)}>−</button>
                  <span style={s.panelQty}>{quantity}</span>
                  <button style={s.panelStepBtn}
                    onClick={() => useCartStore.getState().updateQuantity(product.id, quantity + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div style={s.panelFooter}>
            <div style={s.panelTotal}>
              <span style={s.panelTotalLabel}>Итого</span>
              <span style={s.panelTotalValue}>{total.toLocaleString()} сум</span>
            </div>
            <button style={s.orderBtn} onClick={() => { setExpanded(false); navigate('/checkout') }}>
              Оформить заказ
            </button>
          </div>
        </div>
      )}

      {/* Collapsed bar */}
      {!expanded && (
        <div
          style={{ ...s.bar, animation: bounce ? 'cartBounce 0.4s ease' : 'none' }}
          onClick={() => setExpanded(true)}
        >
          <div style={s.barLeft}>
            <div style={s.barBadge}>{totalQty}</div>
            <div style={s.barInfo}>
              <span style={s.barTitle}>Корзина</span>
              <span style={s.barSubtitle}>{totalQty} {totalQty === 1 ? 'товар' : totalQty < 5 ? 'товара' : 'товаров'}</span>
            </div>
          </div>
          <div style={s.barRight}>
            <span style={s.barTotal}>{total.toLocaleString()} сум</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  container: {
    position: 'fixed', bottom: 82, left: 0, right: 0, zIndex: 199,
    padding: '0 12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    pointerEvents: 'none',
  },

  /* Notification */
  notif: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
    borderRadius: 12, padding: '8px 14px', marginBottom: 8,
    pointerEvents: 'auto',
    animation: 'slideDown 0.25s ease',
  },
  notifCheck: {
    width: 22, height: 22, borderRadius: 6,
    background: C, display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifText: {
    color: '#fff', fontSize: 13, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },

  /* Collapsed bar */
  bar: {
    maxWidth: 420, width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#1a1a1a', borderRadius: 18, padding: '12px 16px',
    cursor: 'pointer', pointerEvents: 'auto',
    boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
    animation: 'slideUp 0.3s ease',
  },
  barLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  barBadge: {
    background: C, color: '#fff', borderRadius: 10,
    width: 28, height: 28, fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  barInfo: { display: 'flex', flexDirection: 'column' },
  barTitle: { color: '#fff', fontSize: 14, fontWeight: 700 },
  barSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  barRight: { display: 'flex', alignItems: 'center', gap: 6 },
  barTotal: { color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: -0.3 },

  /* Expanded panel */
  panel: {
    maxWidth: 420, width: '100%',
    background: '#1a1a1a', borderRadius: 22,
    pointerEvents: 'auto', overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    animation: 'scaleIn 0.25s ease',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px 10px',
  },
  panelTitle: { color: '#fff', fontSize: 18, fontWeight: 800 },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
    width: 32, height: 32, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  panelItems: {
    padding: '0 16px', maxHeight: 200, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  panelItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '10px 12px',
  },
  panelItemInfo: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  panelItemName: {
    color: '#fff', fontSize: 13, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  panelItemPrice: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 },

  panelStepper: {
    display: 'flex', alignItems: 'center', gap: 2,
    background: 'rgba(255,255,255,0.1)', borderRadius: 10,
    marginLeft: 10, flexShrink: 0,
  },
  panelStepBtn: {
    width: 30, height: 30, border: 'none', background: 'transparent',
    color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panelQty: {
    color: '#fff', fontSize: 14, fontWeight: 700,
    minWidth: 18, textAlign: 'center',
  },

  panelFooter: { padding: '12px 16px 16px' },
  panelTotal: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  panelTotalLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 500 },
  panelTotalValue: { color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: -0.3 },

  orderBtn: {
    width: '100%', padding: '14px 0',
    background: C, border: 'none', borderRadius: 16,
    color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: `0 4px 16px rgba(141,198,63,0.4)`,
  },
}
