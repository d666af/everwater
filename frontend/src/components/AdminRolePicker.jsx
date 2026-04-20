import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useAdminRoleStore } from '../store/adminRole'

const ROLES = [
  { id: 'admin',     label: 'Администратор', icon: '🔧', path: '/admin',     color: '#6366f1' },
  { id: 'manager',   label: 'Менеджер',      icon: '🧑‍💼', path: '/manager',   color: '#0ea5e9' },
  { id: 'courier',   label: 'Курьер',        icon: '🚴', path: '/courier',   color: '#f59e0b' },
  { id: 'warehouse', label: 'Склад',         icon: '🏭', path: '/warehouse', color: '#10b981' },
  { id: 'client',    label: 'Клиент',        icon: '👤', path: '/',          color: '#8b5cf6' },
]

export default function AdminRolePicker() {
  const { user } = useAuthStore()
  const { activeRole, setActiveRole } = useAdminRoleStore()
  const navigate = useNavigate()

  // Only show for admins who haven't picked a role this session
  if (user?.role !== 'admin' || activeRole) return null

  const pick = (role) => {
    setActiveRole(role.id)
    navigate(role.path, { replace: true })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '28px 24px',
        maxWidth: '360px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔧</div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111' }}>
            Выберите режим
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#666' }}>
            Вы вошли как администратор.<br />Как работать в этой сессии?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px',
                border: '2px solid #f0f0f0',
                borderRadius: '12px',
                background: '#fafafa',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600,
                color: '#222',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = r.color
                e.currentTarget.style.background = r.color + '10'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#f0f0f0'
                e.currentTarget.style.background = '#fafafa'
              }}
            >
              <span style={{ fontSize: '22px' }}>{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
