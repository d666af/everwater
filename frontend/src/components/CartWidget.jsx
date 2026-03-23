import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore, cartEvents } from '../store'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

export default function CartWidget() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore(s => s.items)
  const total = useCartStore(s => s.total())
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)

  const [expanded, setExpanded] = useState(false)
  const [notification, setNotification] = useState(null)
  const [bounce, setBounce] = useState(false)

  useEffect(() => {
    return cartEvents.on((product) => {
      setNotification(product.name)
      setBounce(true)
      setTimeout(() => setBounce(false), 400)
      setTimeout(() => setNotification(null), 2000)
    })
  }, [])

  const hide = location.pathname === '/checkout'
    || location.pathname === '/login'
    || ['/admin', '/courier', '/manager'].some(p => location.pathname.startsWith(p))
  if (hide || totalQty === 0) return null

  return (
    <div style={st.container}>
      {/* Notification toast */}
      {notification && (
        <div style={st.notif}>
          <div style={st.notifCheck}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={st.notifText}>{notification} добавлено</span>
        </div>
      )}

      {/* Expanded cart panel — white bg, green gradient border */}
      {expanded && (
        <div style={st.panel}>
          <div style={st.panelInner}>
            <div style={st.panelHeader}>
              <span style={st.panelTitle}>Корзина</span>
              <button style={st.collapseBtn} onClick={() => setExpanded(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div style={st.panelItems}>
              {items.map(({ product, quantity }) => (
                <div key={product.id} style={st.panelItem}>
                  <div style={st.panelItemInfo}>
                    <span style={st.panelItemName}>{product.name}</span>
                    <span style={st.panelItemPrice}>{(product.price * quantity).toLocaleString()} сум</span>
                  </div>
                  <div style={st.panelStepper}>
                    <button style={st.panelStepBtn}
                      onClick={() => useCartStore.getState().updateQuantity(product.id, quantity - 1)}>−</button>
                    <span style={st.panelQty}>{quantity}</span>
                    <button style={st.panelStepBtn}
                      onClick={() => useCartStore.getState().updateQuantity(product.id, quantity + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={st.panelFooter}>
              <div style={st.panelTotal}>
                <span style={st.panelTotalLabel}>Итого</span>
                <span style={st.panelTotalValue}>{total.toLocaleString()} сум</span>
              </div>
              <button style={st.orderBtn} onClick={() => { setExpanded(false); navigate('/checkout') }}>
                Оформить заказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed bar — white bg, green gradient border */}
      {!expanded && (
        <div
          style={{ ...st.bar, animation: bounce ? 'cartBounce 0.4s ease' : 'cartFloat 3s ease-in-out infinite' }}
          onClick={() => setExpanded(true)}
        >
          <div style={st.barLeft}>
            <div style={st.barBadge}>{totalQty}</div>
            <div style={st.barInfo}>
              <span style={st.barTitle}>Корзина</span>
              <span style={st.barSubtitle}>{totalQty} {totalQty === 1 ? 'товар' : totalQty < 5 ? 'товара' : 'товаров'}</span>
            </div>
          </div>
          <div style={st.barRight}>
            <span style={st.barTotal}>{total.toLocaleString()} сум</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 15l6-6 6 6" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

const st = {
  container: {
    position: 'fixed', bottom: 90, left: 0, right: 0, zIndex: 199,
    padding: '0 12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    pointerEvents: 'none',
  },

  /* Notification */
  notif: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: GRAD, backdropFilter: 'blur(12px)',
    borderRadius: 14, padding: '10px 16px', marginBottom: 8,
    pointerEvents: 'auto',
    animation: 'slideDown 0.25s ease',
    boxShadow: '0 4px 16px rgba(80,140,20,0.3)',
  },
  notifCheck: {
    width: 22, height: 22, borderRadius: 6,
    background: 'rgba(255,255,255,0.25)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifText: {
    color: '#fff', fontSize: 13, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },

  /* Collapsed bar — white with green gradient border */
  bar: {
    maxWidth: 420, width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: 20, padding: '12px 16px',
    cursor: 'pointer', pointerEvents: 'auto',
    border: `2.5px solid ${C}`,
    boxShadow: '0 6px 28px rgba(100,160,30,0.28), 0 2px 8px rgba(0,0,0,0.06)',
    animation: 'slideUp 0.3s ease',
  },
  barLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  barBadge: {
    background: GRAD, color: '#fff', borderRadius: 10,
    width: 28, height: 28, fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  barInfo: { display: 'flex', flexDirection: 'column' },
  barTitle: { color: '#1a1a1a', fontSize: 14, fontWeight: 700 },
  barSubtitle: { color: '#8e8e93', fontSize: 11 },
  barRight: { display: 'flex', alignItems: 'center', gap: 6 },
  barTotal: { color: '#1a1a1a', fontSize: 16, fontWeight: 800, letterSpacing: -0.3 },

  /* Expanded panel — white with green gradient border + shadow */
  panel: {
    maxWidth: 420, width: '100%',
    background: GRAD, borderRadius: 22, padding: 2.5,
    pointerEvents: 'auto',
    boxShadow: '0 10px 40px rgba(100,160,30,0.3), 0 3px 12px rgba(0,0,0,0.08)',
    animation: 'scaleIn 0.25s ease',
  },
  panelInner: {
    background: '#fff', borderRadius: 20, overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px 10px',
  },
  panelTitle: { color: '#1a1a1a', fontSize: 18, fontWeight: 800 },
  collapseBtn: {
    background: '#f2f2f7', border: 'none', cursor: 'pointer',
    width: 32, height: 32, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  panelItems: {
    padding: '0 16px', maxHeight: 200, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  panelItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f8f8fa', borderRadius: 14, padding: '10px 12px',
  },
  panelItemInfo: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  panelItemName: {
    color: '#1a1a1a', fontSize: 13, fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  panelItemPrice: { color: '#8e8e93', fontSize: 12, marginTop: 1 },

  panelStepper: {
    display: 'flex', alignItems: 'center', gap: 2,
    background: `${C}18`, border: `1.5px solid ${C}30`,
    borderRadius: 10, marginLeft: 10, flexShrink: 0,
  },
  panelStepBtn: {
    width: 30, height: 30, border: 'none', background: 'transparent',
    color: '#1a1a1a', fontSize: 16, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panelQty: {
    color: '#1a1a1a', fontSize: 14, fontWeight: 700,
    minWidth: 18, textAlign: 'center',
  },

  panelFooter: { padding: '12px 16px 16px' },
  panelTotal: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  panelTotalLabel: { color: '#8e8e93', fontSize: 14, fontWeight: 500 },
  panelTotalValue: { color: '#1a1a1a', fontSize: 20, fontWeight: 800, letterSpacing: -0.3 },

  orderBtn: {
    width: '100%', padding: '14px 0',
    background: GRAD, border: 'none', borderRadius: 16,
    color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
}
