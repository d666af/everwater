import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAdminStats, getOrders } from '../../api'

const PERIODS = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `4px solid ${color}` }}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

const STATUS_LABELS = {
  new: 'Новые',
  awaiting_confirmation: 'Ожид. подтверждения',
  confirmed: 'Подтверждены',
  assigned_to_courier: 'У курьера',
  in_delivery: 'В доставке',
  delivered: 'Доставлены',
  rejected: 'Отклонены',
}

const STATUS_COLORS = {
  new: '#1565c0',
  awaiting_confirmation: '#f57f17',
  confirmed: '#2e7d32',
  assigned_to_courier: '#4527a0',
  in_delivery: '#00695c',
  delivered: '#558b2f',
  rejected: '#c62828',
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAdminStats(period),
      getOrders({ limit: 5 }),
    ])
      .then(([s, orders]) => { setStats(s); setRecent(orders.slice(0, 5)) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  return (
    <AdminLayout title="Дашборд">
      <div style={styles.page}>
        {/* Period selector */}
        <div style={styles.periods}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              style={{ ...styles.periodBtn, ...(period === p.key ? styles.periodActive : {}) }}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? <div style={styles.center}>Загрузка...</div> : (
          <>
            {/* Stats grid */}
            <div style={styles.statsGrid}>
              <StatCard label="Заказов" value={stats?.order_count ?? '—'} icon="📦" color="#1565c0" />
              <StatCard label="Выручка" value={stats?.revenue ? `${stats.revenue.toLocaleString()} ₽` : '—'} icon="💰" color="#2e7d32" />
              <StatCard label="Средний чек" value={stats?.avg_check ? `${Math.round(stats.avg_check).toLocaleString()} ₽` : '—'} icon="📊" color="#f57f17" />
              <StatCard label="Повторных" value={stats?.repeat_customers ?? '—'} icon="🔄" color="#6a1b9a" />
              <StatCard label="Бутылок возврат" value={stats?.bottles_returned ?? '—'} icon="♻️" color="#00695c" />
              <StatCard label="Отменённых" value={stats?.cancelled ?? '—'} icon="❌" color="#c62828" />
            </div>

            {/* Order status breakdown */}
            {stats?.by_status && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>По статусам</h3>
                <div style={styles.statusGrid}>
                  {Object.entries(stats.by_status).map(([status, count]) => (
                    <div key={status} style={{ ...styles.statusChip, background: STATUS_COLORS[status] + '18', borderLeft: `3px solid ${STATUS_COLORS[status] || '#888'}` }}>
                      <span style={styles.statusCount}>{count}</span>
                      <span style={styles.statusLabel}>{STATUS_LABELS[status] || status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {recent.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Последние заказы</h3>
                <div style={styles.recentList}>
                  {recent.map(o => (
                    <div key={o.id} style={styles.recentRow}>
                      <div>
                        <div style={styles.recentId}>Заказ #{o.id}</div>
                        <div style={styles.recentAddr}>{o.address}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#1565c0' }}>{o.total} ₽</div>
                        <div style={{ ...styles.statusChipSmall, background: STATUS_COLORS[o.status] + '22', color: STATUS_COLORS[o.status] }}>
                          {STATUS_LABELS[o.status] || o.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  center: { textAlign: 'center', padding: 40, color: '#888' },
  periods: { display: 'flex', gap: 8 },
  periodBtn: {
    padding: '8px 20px', borderRadius: 20, border: '1px solid #c5cae9',
    background: '#fff', color: '#3949ab', fontSize: 14, cursor: 'pointer', fontWeight: 500,
  },
  periodActive: { background: '#1a237e', color: '#fff', border: '1px solid #1a237e' },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16,
  },
  statCard: {
    background: '#fff', borderRadius: 14, padding: '20px 16px',
    display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  statIcon: { fontSize: 28 },
  statValue: { fontSize: 28, fontWeight: 800, color: '#1a237e' },
  statLabel: { fontSize: 13, color: '#888', fontWeight: 500 },
  section: { background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1a237e', marginBottom: 14, marginTop: 0 },
  statusGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  statusChip: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8 },
  statusChipSmall: { fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block', marginTop: 2, fontWeight: 600 },
  statusCount: { fontWeight: 800, fontSize: 20, color: '#1a237e', minWidth: 28 },
  statusLabel: { fontSize: 14, color: '#333' },
  recentList: { display: 'flex', flexDirection: 'column', gap: 0 },
  recentRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 0', borderBottom: '1px solid #f0f0f0',
  },
  recentId: { fontWeight: 600, fontSize: 15 },
  recentAddr: { fontSize: 12, color: '#888', marginTop: 2 },
}
