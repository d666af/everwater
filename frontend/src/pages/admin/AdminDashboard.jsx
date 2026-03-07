import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAdminStats, getOrders } from '../../api'

const PERIODS = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

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
  new: '#2196F3',
  awaiting_confirmation: '#FF9800',
  confirmed: '#8DC63F',
  assigned_to_courier: '#9C27B0',
  in_delivery: '#00BCD4',
  delivered: '#4CAF50',
  rejected: '#F44336',
}

function KpiCard({ label, value, icon, trend, color }) {
  return (
    <div style={{ ...s.kpiCard, '--accent': color }}>
      <div style={{ ...s.kpiIconBox, background: color + '18' }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={s.kpiValue}>{value}</div>
      <div style={s.kpiLabel}>{label}</div>
      {trend !== undefined && (
        <div style={{ ...s.kpiTrend, color: trend >= 0 ? '#4CAF50' : '#F44336' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getAdminStats(period), getOrders({ limit: 5 })])
      .then(([st, orders]) => { setStats(st); setRecent(orders.slice(0, 5)) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  return (
    <AdminLayout title="Дашборд">
      <div style={s.page}>

        {/* Period selector */}
        <div style={s.periodRow}>
          {PERIODS.map(p => (
            <button key={p.key}
              style={{ ...s.periodBtn, ...(period === p.key ? s.periodActive : {}) }}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={s.loadingBox}>
            <div style={s.spinner} />
            <span style={{ color: '#888', fontSize: 14 }}>Загрузка данных...</span>
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <div style={s.kpiGrid}>
              <KpiCard label="Заказов" value={stats?.order_count ?? '—'} icon="📦" color="#2196F3" />
              <KpiCard label="Выручка" value={stats?.revenue ? `${stats.revenue.toLocaleString()}` : '—'} icon="💰" color="#8DC63F" />
              <KpiCard label="Ср. чек" value={stats?.avg_check ? Math.round(stats.avg_check).toLocaleString() : '—'} icon="📊" color="#FF9800" />
              <KpiCard label="Повторных" value={stats?.repeat_customers ?? '—'} icon="🔄" color="#9C27B0" />
              <KpiCard label="Бутылок" value={stats?.bottles_returned ?? '—'} icon="♻️" color="#00BCD4" />
              <KpiCard label="Отменено" value={stats?.cancelled ?? '—'} icon="✕" color="#F44336" />
            </div>

            {/* Status breakdown */}
            {stats?.by_status && (
              <div style={s.section}>
                <div style={s.sectionHeader}>
                  <div style={s.sectionTitle}>Заказы по статусам</div>
                </div>
                <div style={s.statusList}>
                  {Object.entries(stats.by_status).map(([status, count]) => {
                    const total = Object.values(stats.by_status).reduce((a, b) => a + b, 0)
                    const pct = total ? Math.round(count / total * 100) : 0
                    const color = STATUS_COLORS[status] || '#888'
                    return (
                      <div key={status} style={s.statusRow}>
                        <div style={{ ...s.statusDot, background: color }} />
                        <div style={s.statusName}>{STATUS_LABELS[status] || status}</div>
                        <div style={s.statusBar}>
                          <div style={{ ...s.statusBarFill, width: `${pct}%`, background: color }} />
                        </div>
                        <div style={s.statusCount}>{count}</div>
                        <div style={s.statusPct}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {recent.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionHeader}>
                  <div style={s.sectionTitle}>Последние заказы</div>
                </div>
                <div style={s.recentTable}>
                  {recent.map(o => {
                    const color = STATUS_COLORS[o.status] || '#888'
                    return (
                      <div key={o.id} style={s.recentRow}>
                        <div style={{ ...s.recentIdBadge, background: '#F5F5F5' }}>
                          #{o.id}
                        </div>
                        <div style={s.recentInfo}>
                          <div style={s.recentAddr}>{o.address}</div>
                          <div style={s.recentTime}>{o.delivery_time || '—'}</div>
                        </div>
                        <div style={s.recentRight}>
                          <div style={s.recentTotal}>{(o.total || 0).toLocaleString()} сум</div>
                          <div style={{ ...s.recentStatus, background: color + '20', color }}>
                            {STATUS_LABELS[o.status] || o.status}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

const P = '#8DC63F'

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 },
  periodRow: { display: 'flex', gap: 8 },
  periodBtn: {
    padding: '8px 18px', borderRadius: 999, border: '1.5px solid #E8E8E8',
    background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s',
  },
  periodActive: { background: P, borderColor: P, color: '#fff', boxShadow: '0 4px 12px rgba(141,198,63,0.3)' },

  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: 60, color: '#888',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #E8E8E8', borderTop: `3px solid ${P}`,
    animation: 'spin 0.8s linear infinite',
  },

  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12,
  },
  kpiCard: {
    background: '#fff', borderRadius: 16, padding: '16px',
    display: 'flex', flexDirection: 'column', gap: 6,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #F0F0F0',
  },
  kpiIconBox: {
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: { fontSize: 26, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 },
  kpiLabel: { fontSize: 12, color: '#888', fontWeight: 600 },
  kpiTrend: { fontSize: 12, fontWeight: 700 },

  section: {
    background: '#fff', borderRadius: 16, overflow: 'hidden',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0',
  },
  sectionHeader: { padding: '16px 20px', borderBottom: '1px solid #F5F5F5' },
  sectionTitle: { fontSize: 15, fontWeight: 800, color: '#1A1A1A' },

  statusList: { display: 'flex', flexDirection: 'column', padding: '8px 20px 16px', gap: 10 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusName: { fontSize: 13, color: '#555', minWidth: 160, fontWeight: 500 },
  statusBar: { flex: 1, height: 6, background: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  statusBarFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },
  statusCount: { fontSize: 14, fontWeight: 800, color: '#1A1A1A', minWidth: 28, textAlign: 'right' },
  statusPct: { fontSize: 12, color: '#888', minWidth: 36, textAlign: 'right' },

  recentTable: { display: 'flex', flexDirection: 'column' },
  recentRow: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
    borderBottom: '1px solid #F5F5F5', transition: 'background 0.15s',
  },
  recentIdBadge: {
    borderRadius: 8, padding: '4px 8px',
    fontSize: 12, fontWeight: 800, color: '#888', flexShrink: 0,
  },
  recentInfo: { flex: 1 },
  recentAddr: { fontSize: 14, color: '#1A1A1A', fontWeight: 500 },
  recentTime: { fontSize: 11, color: '#888', marginTop: 2 },
  recentRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  recentTotal: { fontSize: 14, fontWeight: 800, color: P },
  recentStatus: { fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700 },
}
