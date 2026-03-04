import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminStats } from '../../api'

const PERIODS = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

const STATUS_LABELS = {
  new: 'Новые', awaiting_confirmation: 'Ожид. подтв.', confirmed: 'Подтверждены',
  assigned_to_courier: 'У курьера', in_delivery: 'В доставке',
  delivered: 'Доставлены', rejected: 'Отклонены',
}
const STATUS_COLORS = {
  new: '#1565c0', awaiting_confirmation: '#f57f17', confirmed: '#2d6a4f',
  assigned_to_courier: '#4527a0', in_delivery: '#00695c', delivered: '#33691e', rejected: '#c62828',
}

function Stat({ label, value, icon, sub }) {
  return (
    <div style={s.stat}>
      <div style={s.statIcon}>{icon}</div>
      <div style={s.statVal}>{value}</div>
      <div style={s.statLbl}>{label}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  )
}

export default function ManagerStats() {
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAdminStats(period).then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [period])

  return (
    <ManagerLayout title="Статистика">
      <div style={s.page}>
        <div style={s.periods}>
          {PERIODS.map(p => (
            <button key={p.key} style={{ ...s.periodBtn, ...(period === p.key ? s.periodActive : {}) }}
              onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>

        {loading ? <div style={s.center}>Загрузка...</div> : !stats ? (
          <div style={s.center}>Нет данных</div>
        ) : (
          <>
            <div style={s.grid}>
              <Stat label="Заказов" value={stats.order_count ?? '—'} icon="📦" />
              <Stat label="Выручка" value={stats.revenue ? `${stats.revenue.toLocaleString()} ₽` : '—'} icon="💰" />
              <Stat label="Средний чек" value={stats.avg_check ? `${Math.round(stats.avg_check)} ₽` : '—'} icon="📊" />
              <Stat label="Повторных" value={stats.repeat_customers ?? '—'} icon="🔄" />
              <Stat label="Бутылок возврат" value={stats.bottles_returned ?? '—'} icon="♻️" />
              <Stat label="Отменено" value={stats.cancelled ?? '—'} icon="❌" />
            </div>

            {stats.by_status && Object.keys(stats.by_status).length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Разбивка по статусам</div>
                {Object.entries(stats.by_status).map(([status, count]) => {
                  const total = Object.values(stats.by_status).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? Math.round(count / total * 100) : 0
                  const color = STATUS_COLORS[status] || '#888'
                  return (
                    <div key={status} style={s.statusRow}>
                      <div style={s.statusLabel}>{STATUS_LABELS[status] || status}</div>
                      <div style={s.bar}>
                        <div style={{ ...s.barFill, width: `${pct}%`, background: color }} />
                      </div>
                      <div style={{ ...s.statusCount, color }}>
                        {count} <span style={s.statusPct}>({pct}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ManagerLayout>
  )
}

const GREEN = '#2d6a4f'
const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 20 },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  periods: { display: 'flex', gap: 8 },
  periodBtn: { padding: '8px 20px', borderRadius: 20, border: '1px solid #b7e4c7', background: '#fff', color: GREEN, fontSize: 14, cursor: 'pointer', fontWeight: 500 },
  periodActive: { background: GREEN, color: '#fff', border: `1px solid ${GREEN}` },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  stat: {
    background: '#fff', borderRadius: 14, padding: '18px 14px', textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #e8f5e9',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  statIcon: { fontSize: 28 },
  statVal: { fontSize: 26, fontWeight: 800, color: GREEN },
  statLbl: { fontSize: 12, color: '#888', fontWeight: 500 },
  statSub: { fontSize: 11, color: '#aaa' },
  section: {
    background: '#fff', borderRadius: 14, padding: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1px solid #e8f5e9',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionTitle: { fontWeight: 700, fontSize: 15, color: GREEN, marginBottom: 4 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 10 },
  statusLabel: { width: 140, fontSize: 13, color: '#333', flexShrink: 0 },
  bar: { flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.4s' },
  statusCount: { fontWeight: 700, fontSize: 14, minWidth: 60, textAlign: 'right' },
  statusPct: { fontWeight: 400, fontSize: 11, color: '#aaa' },
}
