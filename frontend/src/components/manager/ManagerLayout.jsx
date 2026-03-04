import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

const NAV = [
  { path: '/manager', label: 'Заказы', icon: '📦' },
  { path: '/manager/clients', label: 'Клиенты', icon: '👥' },
  { path: '/manager/couriers', label: 'Курьеры', icon: '🚴' },
  { path: '/manager/stats', label: 'Статистика', icon: '📊' },
]

export default function ManagerLayout({ children, title }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const doLogout = () => { logout(); navigate('/login') }

  return (
    <div style={s.layout}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoDrop}>💧</span>
          <div>
            <div style={s.logoText}><b>ever</b>water</div>
            <div style={s.logoBadge}>Менеджер</div>
          </div>
        </div>

        {user && (
          <div style={s.userCard}>
            <div style={s.userAvatar}>{(user.name || 'M')[0]}</div>
            <div>
              <div style={s.userName}>{user.name}</div>
              <div style={s.userPhone}>{user.phone}</div>
            </div>
          </div>
        )}

        <nav style={s.nav}>
          {NAV.map(item => {
            const active = item.path === '/manager'
              ? location.pathname === '/manager'
              : location.pathname.startsWith(item.path)
            return (
              <button key={item.path}
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
                onClick={() => navigate(item.path)}>
                <span style={s.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <button style={s.logoutBtn} onClick={doLogout}>← Выйти</button>
      </aside>

      <div style={s.main}>
        <header style={s.header}>
          <h1 style={s.title}>{title}</h1>
          <div style={s.headerMeta}>Панель менеджера</div>
        </header>
        <div style={s.content}>{children}</div>
      </div>

      {/* Mobile nav */}
      <nav style={s.mobileNav}>
        {NAV.map(item => {
          const active = item.path === '/manager'
            ? location.pathname === '/manager'
            : location.pathname.startsWith(item.path)
          return (
            <button key={item.path}
              style={{ ...s.mobileItem, ...(active ? s.mobileActive : {}) }}
              onClick={() => navigate(item.path)}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          )
        })}
        <button style={s.mobileItem} onClick={doLogout}>
          <span style={{ fontSize: 20 }}>🚪</span>
          <span style={{ fontSize: 10 }}>Выйти</span>
        </button>
      </nav>
    </div>
  )
}

const GREEN = '#2d6a4f'
const LIGHT = '#d8f3dc'

const s = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f5faf7' },
  sidebar: {
    width: 230, background: GREEN, flexShrink: 0,
    display: 'flex', flexDirection: 'column',
    position: 'sticky', top: 0, height: '100vh',
  },
  logo: {
    padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoDrop: { fontSize: 28 },
  logoText: { color: '#fff', fontSize: 17, letterSpacing: -0.5 },
  logoBadge: {
    fontSize: 10, color: '#74c69d', textTransform: 'uppercase',
    letterSpacing: 1, fontWeight: 600,
  },
  userCard: {
    margin: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: '#52b788', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 16, flexShrink: 0,
  },
  userName: { color: '#fff', fontWeight: 600, fontSize: 13 },
  userPhone: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  nav: { padding: '8px 0', flex: 1, display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 18px', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left',
  },
  navActive: {
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    borderLeft: '3px solid #74c69d',
  },
  navIcon: { fontSize: 18, width: 24 },
  logoutBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
    padding: '14px 18px', cursor: 'pointer', fontSize: 13, textAlign: 'left',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    background: '#fff', padding: '16px 24px',
    borderBottom: '1px solid #e0f0e8',
    position: 'sticky', top: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: GREEN },
  headerMeta: { fontSize: 13, color: '#74c69d', fontWeight: 500 },
  content: { padding: '24px', flex: 1, paddingBottom: 80 },
  mobileNav: {
    display: 'none',
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: GREEN, zIndex: 100,
    '@media (max-width: 768px)': { display: 'flex' },
  },
  mobileItem: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '8px 4px', gap: 2, cursor: 'pointer',
    color: 'rgba(255,255,255,0.6)', fontSize: 10,
  },
  mobileActive: { color: '#fff' },
}
