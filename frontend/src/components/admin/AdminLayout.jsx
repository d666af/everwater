import { useNavigate, useLocation } from 'react-router-dom'

const NAV = [
  { path: '/admin', label: 'Дашборд', icon: '📊' },
  { path: '/admin/orders', label: 'Заказы', icon: '📦' },
  { path: '/admin/products', label: 'Товары', icon: '🛍️' },
  { path: '/admin/couriers', label: 'Курьеры', icon: '🚴' },
  { path: '/admin/settings', label: 'Настройки', icon: '⚙️' },
]

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={{ fontSize: 24 }}>💧</span>
          <span style={styles.logoText}>Everwater</span>
          <span style={styles.adminBadge}>ADMIN</span>
        </div>
        <nav style={styles.nav}>
          {NAV.map(item => {
            const active = item.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                style={{ ...styles.navItem, ...(active ? styles.navActive : {}) }}
                onClick={() => navigate(item.path)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>{title}</h1>
        </header>
        <div style={styles.content}>{children}</div>
      </div>

      {/* Mobile bottom nav */}
      <nav style={styles.mobileNav}>
        {NAV.map(item => {
          const active = item.path === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              style={{ ...styles.mobileItem, ...(active ? styles.mobileActive : {}) }}
              onClick={() => navigate(item.path)}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10 }}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const styles = {
  layout: { display: 'flex', minHeight: '100vh', background: '#f0f2f5' },
  sidebar: {
    width: 220, background: '#1a237e', flexShrink: 0,
    display: 'flex', flexDirection: 'column',
    position: 'sticky', top: 0, height: '100vh',
    '@media (max-width: 768px)': { display: 'none' },
  },
  logo: {
    padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoText: { color: '#fff', fontWeight: 700, fontSize: 18, flex: 1 },
  adminBadge: {
    background: '#ff6f00', color: '#fff', fontSize: 10,
    padding: '2px 6px', borderRadius: 4, fontWeight: 700,
  },
  nav: { padding: '12px 0', display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
    transition: 'all 0.15s',
  },
  navActive: { background: 'rgba(255,255,255,0.15)', color: '#fff', borderLeft: '3px solid #64b5f6' },
  navIcon: { fontSize: 18, width: 24 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    background: '#fff', padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0, zIndex: 10,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#1a237e', margin: 0 },
  content: { padding: '24px', flex: 1, paddingBottom: 80 },
  mobileNav: {
    display: 'none',
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#1a237e', zIndex: 100,
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
