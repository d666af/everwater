import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { useSubscriptionsEnabled } from '../../hooks/useSubscriptionsEnabled'
import { useSupportChat } from '../../hooks/useSupportChat'

const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'

const SHORTCUTS = [
  { path: '/admin/products',        label: 'Продукты',       accent: '#2B8A3E', bg: '#EBFBEE',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { path: '/admin/reviews',         label: 'Отзывы',         accent: '#E67700', bg: '#FFF3D9',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { path: '/admin/warehouse',       label: 'Склад',          accent: '#12B886', bg: '#E6FCF5',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { path: '/admin/subscriptions',   label: 'Подписки',       accent: '#6741D9', bg: '#F3F0FF',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/support',         label: 'Поддержка',      accent: '#862E9C', bg: '#F8F0FC',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-4-7.5L21 3v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { path: '/admin/settings',        label: 'Настройки',      accent: '#8E8E93', bg: '#F2F2F7',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a7.9 7.9 0 0 0 0-6l2-1.2-2-3.5-2.3.8a7.9 7.9 0 0 0-5.2-3L11.5 0h-4l-.4 2.3a7.9 7.9 0 0 0-5.2 3L-.4 4.3l-2 3.5 2 1.2a7.9 7.9 0 0 0 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { path: '/admin/warehouse/history', label: 'История склада', accent: '#2F9E44', bg: '#EBFBEE',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const subsEnabled = useSubscriptionsEnabled()
  const support = useSupportChat()
  const filteredShortcuts = SHORTCUTS.filter(sc => {
    if (subsEnabled === false && sc.path === '/admin/subscriptions') return false
    if (support && support.enabled === false && sc.path === '/admin/support') return false
    return true
  })

  return (
    <AdminLayout title="Панель">
      <div style={{ ...s.cardTitle, margin: '4px 2px 10px' }}>Управление</div>
      <div style={s.shortcutGrid}>
        {filteredShortcuts.map(sc => (
          <button key={sc.path} onClick={() => navigate(sc.path)} style={s.shortcutBtn}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: sc.bg, color: sc.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sc.icon}</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>{sc.label}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}><path d="M9 18l6-6-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        ))}
      </div>
    </AdminLayout>
  )
}

const s = {
  cardTitle: { fontSize: 14, fontWeight: 800, color: TEXT },
  shortcutGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  shortcutBtn: {
    background: '#fff', border: 'none', borderRadius: 16, padding: '13px 16px',
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', WebkitTapHighlightColor: 'transparent',
    textAlign: 'left', width: '100%',
  },
}
