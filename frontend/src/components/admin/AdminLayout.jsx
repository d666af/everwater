import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { EverLogoMark } from '../EverLogo'

const NAV = [
  { path: '/admin', label: 'Дашборд', exactMatch: true,
    Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.8"/><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.5"/><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.5"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.3"/></svg> },
  { path: '/admin/orders', label: 'Заказы',
    Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { path: '/admin/products', label: 'Товары',
    Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 4 10 4 15.5C4 19.6 7.6 23 12 23C16.4 23 20 19.6 20 15.5C20 10 12 2 12 2Z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { path: '/admin/couriers', label: 'Курьеры',
    Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { path: '/admin/settings', label: 'Настройки',
    Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const doLogout = () => { logout(); navigate('/login') }

  return (
    <div style={s.layout}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.logo} onClick={() => navigate('/admin')}>
            <EverLogoMark width={38} />
            <div>
              <div style={s.logoName}>ever</div>
              <div style={s.logoBadge}>Администратор</div>
            </div>
          </div>

          {user && (
            <div style={s.userCard}>
              <div style={s.userAvatar}>{(user.name || 'A')[0].toUpperCase()}</div>
              <div style={s.userInfo}>
                <div style={s.userName}>{user.name}</div>
                <div style={s.userRole}>Администратор</div>
              </div>
            </div>
          )}

          <nav style={s.nav}>
            {NAV.map(({ path, label, exactMatch, Icon }) => {
              const active = exactMatch
                ? location.pathname === path
                : location.pathname.startsWith(path)
              return (
                <button
                  key={path}
                  style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                  onClick={() => navigate(path)}
                >
                  <span style={{ color: active ? '#8DC63F' : 'rgba(255,255,255,0.5)' }}>
                    <Icon />
                  </span>
                  <span>{label}</span>
                  {active && <span style={s.navDot} />}
                </button>
              )
            })}
          </nav>
        </div>

        <button style={s.logoutBtn} onClick={doLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Выйти
        </button>
      </aside>

      {/* Main */}
      <div style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.title}>{title}</h1>
          </div>
          <div style={s.headerActions}>
            <div style={s.headerBadge}>Admin Panel</div>
          </div>
        </header>
        <div style={s.content}>{children}</div>
      </div>

      {/* Mobile bottom nav */}
      <nav style={s.mobileNav}>
        {NAV.map(({ path, label, exactMatch, Icon }) => {
          const active = exactMatch
            ? location.pathname === path
            : location.pathname.startsWith(path)
          return (
            <button key={path} style={{ ...s.mobileItem, color: active ? '#8DC63F' : 'rgba(255,255,255,0.5)' }}
              onClick={() => navigate(path)}>
              <Icon />
              <span style={{ fontSize: 9 }}>{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const s = {
  layout: { display: 'flex', minHeight: '100vh', background: '#F5F5F5' },
  sidebar: {
    width: 240, background: '#111827', flexShrink: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    position: 'sticky', top: 0, height: '100vh',
  },
  sidebarTop: { display: 'flex', flexDirection: 'column' },
  logo: {
    padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
  },
  logoName: { color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: -0.5 },
  logoBadge: { fontSize: 10, color: '#8DC63F', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 },
  userCard: {
    margin: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, #8DC63F, #6CA32F)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15, flexShrink: 0,
  },
  userInfo: {},
  userName: { color: '#fff', fontWeight: 600, fontSize: 13 },
  userRole: { color: '#8DC63F', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  nav: { padding: '8px 0', display: 'flex', flexDirection: 'column' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 18px', background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
    position: 'relative', borderRadius: 0,
  },
  navItemActive: {
    background: 'rgba(141,198,63,0.12)', color: '#fff',
    borderLeft: '3px solid #8DC63F',
  },
  navDot: {
    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
    width: 6, height: 6, borderRadius: '50%', background: '#8DC63F',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.3)', padding: '16px 18px',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    transition: 'color 0.15s',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#F5F5F5' },
  header: {
    background: '#fff', padding: '16px 24px',
    borderBottom: '1px solid #EBEBEB',
    position: 'sticky', top: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#1A1A1A' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 12 },
  headerBadge: {
    background: '#8DC63F20', color: '#6CA32F',
    border: '1px solid #8DC63F40', borderRadius: 8,
    padding: '4px 10px', fontSize: 12, fontWeight: 700,
  },
  content: { padding: 24, flex: 1, paddingBottom: 80 },
  mobileNav: {
    display: 'flex',
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#111827', zIndex: 200,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  mobileItem: {
    flex: 1, background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '10px 4px 6px', gap: 3, cursor: 'pointer',
    fontSize: 10, fontWeight: 500,
    transition: 'color 0.15s',
  },
}
