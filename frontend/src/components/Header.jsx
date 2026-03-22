import { useNavigate, useLocation } from 'react-router-dom'

const TITLES = {
  '/checkout': 'Оформление',
  '/orders': 'Заказы',
  '/profile': 'Профиль',
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()

  // Hide on catalog, cart, login, admin, courier, manager, support
  const hide = location.pathname === '/'
    || location.pathname === '/cart'
    || location.pathname === '/login'
    || ['/admin', '/courier', '/manager', '/support'].some(p => location.pathname.startsWith(p))
  if (hide) return null

  const title = TITLES[location.pathname]

  return (
    <header style={st.header}>
      <button style={st.backBtn} onClick={() => navigate(-1)} aria-label="Назад">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {title && <span style={st.title}>{title}</span>}
      <div style={{ width: 38 }} />
    </header>
  )
}

const st = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(250,250,250,0.9)', backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', padding: '6px 16px',
    gap: 10, minHeight: 52, borderBottom: '1px solid rgba(0,0,0,0.04)',
  },
  backBtn: {
    background: 'none', border: 'none', width: 38, height: 38,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, borderRadius: 10,
  },
  title: {
    flex: 1, fontWeight: 700, fontSize: 17, color: '#1a1a1a',
    letterSpacing: -0.3, textAlign: 'center',
  },
}
