import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers } from '../../api'

export default function ManagerCouriers() {
  const [couriers, setCouriers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminCouriers().then(setCouriers).catch(console.error).finally(() => setLoading(false))
  }, [])

  const active = couriers.filter(c => c.is_active)
  const inactive = couriers.filter(c => !c.is_active)

  return (
    <ManagerLayout title="Курьеры">
      <div style={s.page}>
        <div style={s.stats}>
          <div style={s.statCard}>
            <div style={s.statVal}>{active.length}</div>
            <div style={s.statLbl}>Активных</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{couriers.reduce((a, c) => a + (c.delivery_count || 0), 0)}</div>
            <div style={s.statLbl}>Всего доставок</div>
          </div>
        </div>

        {loading ? <div style={s.center}>Загрузка...</div> : (
          <>
            {active.length > 0 && (
              <div>
                <div style={s.sectionTitle}>Активные ({active.length})</div>
                {active.map(c => <CourierCard key={c.id} courier={c} />)}
              </div>
            )}
            {inactive.length > 0 && (
              <div>
                <div style={s.sectionTitle}>Неактивные</div>
                {inactive.map(c => <CourierCard key={c.id} courier={c} />)}
              </div>
            )}
          </>
        )}
      </div>
    </ManagerLayout>
  )
}

function CourierCard({ courier: c }) {
  return (
    <div style={{ ...s.card, opacity: c.is_active ? 1 : 0.6 }}>
      <div style={s.avatar}>{(c.name || 'K')[0]}</div>
      <div style={s.info}>
        <div style={s.name}>{c.name}</div>
        <div style={s.meta}>
          {c.phone && <span>📱 {c.phone}</span>}
          <span>🆔 {c.telegram_id}</span>
        </div>
        <div style={s.chips}>
          <span style={s.delivChip}>📦 {c.delivery_count || 0} доставок</span>
          {c.earnings > 0 && <span style={s.earnChip}>💰 {c.earnings} ₽</span>}
          <span style={{ ...s.activeBadge, background: c.is_active ? '#d8f3dc' : '#fce4ec', color: c.is_active ? '#2d6a4f' : '#c62828' }}>
            {c.is_active ? '● Активен' : '○ Неактивен'}
          </span>
        </div>
      </div>
      {c.phone && <a href={`tel:${c.phone}`} style={s.callBtn}>📞</a>}
    </div>
  )
}

const GREEN = '#2d6a4f'
const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  stats: { display: 'flex', gap: 12 },
  statCard: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '16px',
    textAlign: 'center', border: '1px solid #e8f5e9',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  statVal: { fontSize: 28, fontWeight: 800, color: GREEN },
  statLbl: { fontSize: 12, color: '#888', marginTop: 2 },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', padding: '8px 0 6px', letterSpacing: 0.5 },
  card: {
    background: '#fff', borderRadius: 12, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #e8f5e9',
  },
  avatar: {
    width: 44, height: 44, borderRadius: '50%', background: '#d8f3dc',
    color: GREEN, fontWeight: 700, fontSize: 18, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  name: { fontWeight: 600, fontSize: 15, color: '#1b4332' },
  meta: { display: 'flex', gap: 12, fontSize: 12, color: '#666', flexWrap: 'wrap' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  delivChip: { fontSize: 11, background: '#e8f5e9', color: GREEN, padding: '2px 8px', borderRadius: 8, fontWeight: 500 },
  earnChip: { fontSize: 11, background: '#fff8e1', color: '#f57f17', padding: '2px 8px', borderRadius: 8, fontWeight: 500 },
  activeBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600 },
  callBtn: {
    width: 38, height: 38, borderRadius: '50%', border: `1px solid ${GREEN}`,
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, textDecoration: 'none', flexShrink: 0,
  },
}
