import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { useSubscriptionsEnabled } from '../../hooks/useSubscriptionsEnabled'
import { useSupportChat } from '../../hooks/useSupportChat'

const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'

function SectionTitle({ children, first }) {
  return (
    <div style={{ ...s.sectionTitle, marginTop: first ? 0 : 20 }}>{children}</div>
  )
}

function SquareBtn({ navigate, path, label, icon }) {
  return (
    <button onClick={() => navigate(path)} style={s.sqBtn}>
      <div style={s.sqIcon}>{icon}</div>
      <div style={s.sqLabel}>{label}</div>
    </button>
  )
}

function RowBtn({ navigate, path, label, icon }) {
  return (
    <button onClick={() => navigate(path)} style={s.rowBtn}>
      <div style={s.rowIcon}>{icon}</div>
      <span style={s.rowLabel}>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
        <path d="M9 18l6-6-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

const Icons = {
  products: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  ),
  warehouse: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
  history: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  reviews: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  subscriptions: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  support: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.86 11 19.79 19.79 0 01.77 2.38 2 2 0 012.76.2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const subsEnabled = useSubscriptionsEnabled()
  const support = useSupportChat()

  return (
    <AdminLayout title="Панель">
      <SectionTitle first>Настройки</SectionTitle>
      <div style={s.twoCol}>
        <SquareBtn navigate={navigate} path="/admin/products" label="Продукты" icon={Icons.products} />
        <SquareBtn navigate={navigate} path="/admin/settings" label="Настройки" icon={Icons.settings} />
      </div>

      <SectionTitle>Складской учёт</SectionTitle>
      <div style={s.twoCol}>
        <SquareBtn navigate={navigate} path="/admin/warehouse" label="Склад" icon={Icons.warehouse} />
        <SquareBtn navigate={navigate} path="/admin/warehouse/history" label="История" icon={Icons.history} />
      </div>

      <SectionTitle>Другое</SectionTitle>
      <div style={s.list}>
        <RowBtn navigate={navigate} path="/admin/reviews" label="Отзывы" icon={Icons.reviews} />
        {subsEnabled !== false && (
          <RowBtn navigate={navigate} path="/admin/subscriptions" label="Подписки" icon={Icons.subscriptions} />
        )}
        {!(support?.enabled === false) && (
          <RowBtn navigate={navigate} path="/admin/support" label="Поддержка" icon={Icons.support} />
        )}
      </div>
    </AdminLayout>
  )
}

const s = {
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: TEXT2,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10,
  },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  sqBtn: {
    background: '#fff', border: 'none', borderRadius: 16, padding: '18px 12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    WebkitTapHighlightColor: 'transparent', width: '100%',
  },
  sqIcon: {
    width: 44, height: 44, borderRadius: 14, background: '#F2F2F7',
    color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sqLabel: { fontSize: 13, fontWeight: 700, color: TEXT, textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  rowBtn: {
    background: '#fff', border: 'none', borderRadius: 16, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', WebkitTapHighlightColor: 'transparent',
    width: '100%', textAlign: 'left',
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 12, background: '#F2F2F7',
    color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: 700, color: TEXT },
}
