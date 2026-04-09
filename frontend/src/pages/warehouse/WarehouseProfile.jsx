import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { useState } from 'react'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'

export default function WarehouseProfile() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [confirming, setConfirming] = useState(false)

  const doLogout = () => { logout(); navigate('/login') }
  const initials = (user?.name || 'З').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <WarehouseLayout title="Профиль">
      {/* Avatar + info */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0 16px' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: GRAD, color: '#fff', fontSize: 28, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(100,160,30,0.35)' }}>
          {initials}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{user?.name || 'Завсклад'}</div>
        <span style={{ fontSize: 12, background: `${C}15`, color: CD, padding: '3px 14px', borderRadius: 999, fontWeight: 700 }}>Завсклад</span>
      </div>

      {/* Info card */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {[
          ['Телефон', user?.phone || '—'],
          ['ID', user?.id || '—'],
          ['Роль', 'Завсклад'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(60,60,67,0.08)' }}>
            <span style={{ fontSize: 14, color: TEXT2 }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Logout */}
      {!confirming ? (
        <button style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: '#fff', color: '#E03131', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }} onClick={() => setConfirming(true)}>
          Выйти из аккаунта
        </button>
      ) : (
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#E03131', marginBottom: 10 }}>Выйти из аккаунта?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#F2F2F7', color: TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => setConfirming(false)}>Отмена</button>
            <button style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#E03131', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }} onClick={doLogout}>Выйти</button>
          </div>
        </div>
      )}
    </WarehouseLayout>
  )
}
