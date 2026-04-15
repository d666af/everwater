import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAdminStats, getOrders, getAdminCouriers, getAllCashDebts, getWarehouseCourierStats } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PERIODS = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

const STATUS_LABELS = {
  new: 'Новые', awaiting_confirmation: 'Ожидают', confirmed: 'Подтверждены',
  assigned_to_courier: 'У курьера', in_delivery: 'В пути',
  delivered: 'Доставлены', rejected: 'Отклонены',
}
const STATUS_STYLE = {
  new:                   { bg: '#EDF3FF', color: '#3B5BDB' },
  awaiting_confirmation: { bg: '#FFF8E6', color: '#E67700' },
  confirmed:             { bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier:   { bg: '#F3F0FF', color: '#6741D9' },
  in_delivery:           { bg: '#E8F4FD', color: '#1971C2' },
  delivered:             { bg: '#EBFBEE', color: C },
  rejected:              { bg: '#FFF5F5', color: '#E03131' },
}

const SHORTCUTS = [
  { path: '/admin/products',  label: 'Продукты',  accent: '#2B8A3E', bg: '#EBFBEE',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { path: '/admin/managers',  label: 'Менеджеры', accent: '#1971C2', bg: '#E8F4FD',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/stats',     label: 'Статистика',accent: '#6741D9', bg: '#F3F0FF',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/support',   label: 'Поддержка', accent: '#E67700', bg: '#FFF3D9',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-4-7.5L21 3v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { path: '/admin/settings',  label: 'Настройки', accent: '#8E8E93', bg: '#F2F2F7',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a7.9 7.9 0 0 0 0-6l2-1.2-2-3.5-2.3.8a7.9 7.9 0 0 0-5.2-3L11.5 0h-4l-.4 2.3a7.9 7.9 0 0 0-5.2 3L-.4 4.3l-2 3.5 2 1.2a7.9 7.9 0 0 0 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { path: '/admin/warehouse/history',  label: 'История склада', accent: '#12B886', bg: '#E6FCF5',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [couriersTotal, setCouriersTotal] = useState(0)
  const [pendingDebts, setPendingDebts] = useState(0)
  const [totalDebtAmt, setTotalDebtAmt] = useState(0)
  const [bottlesOwed, setBottlesOwed] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAdminStats(period),
      getOrders({}),
      getAdminCouriers(),
      getAllCashDebts().catch(() => []),
      getWarehouseCourierStats().catch(() => []),
    ])
      .then(([st, orders, couriers, debts, wcs]) => {
        setStats(st)
        setRecent(orders.slice(0, 5))
        setCouriersTotal(couriers.filter(c => c.is_active).length)
        const pending = debts.filter(d => d.clearance_status === 'pending')
        setPendingDebts(pending.length)
        setTotalDebtAmt(debts.filter(d => d.clearance_status !== 'approved').reduce((s, d) => s + (d.amount || 0), 0))
        setBottlesOwed(wcs.reduce((s, c) => s + Math.max(0, (c.bottles_must_return || 0) - (c.bottles_returned_today || 0)), 0))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  const byStatusTotal = stats?.by_status ? Object.values(stats.by_status).reduce((a, b) => a + b, 0) : 0

  return (
    <AdminLayout title="Панель">
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Period segmented */}
      <div style={s.segRow}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            flex: 1, padding: '10px 10px', borderRadius: 12,
            background: period === p.key ? GRAD : '#fff',
            color: period === p.key ? '#fff' : TEXT2,
            border: period === p.key ? 'none' : `1.5px solid ${BORDER}`,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : (
        <>
          {/* Top KPI row */}
          <div style={s.kpiGrid}>
            <Kpi accent="#2B8A3E" bg="#EBFBEE" label="Заказов" value={stats?.order_count ?? 0} />
            <Kpi accent={CD} bg="#F4FAE9" label="Выручка"
              value={stats?.revenue != null ? `${Math.round(stats.revenue / 1000)}к` : '—'}
              sub={stats?.revenue != null ? `${Number(stats.revenue).toLocaleString('ru-RU')} сум` : null} />
            <Kpi accent="#1971C2" bg="#E8F4FD" label="Ср. чек"
              value={stats?.avg_check != null ? `${Math.round(stats.avg_check / 1000)}к` : '—'} />
            <Kpi accent="#6741D9" bg="#F3F0FF" label="Курьеров" value={couriersTotal} />
          </div>

          {/* Alerts row — debts + bottles */}
          {(pendingDebts > 0 || bottlesOwed > 0 || totalDebtAmt > 0) && (
            <div style={s.alertsRow}>
              {pendingDebts > 0 && (
                <button style={{ ...s.alertCard, background: '#FFF8E6', borderColor: '#FFE0A3' }}
                  onClick={() => navigate('/admin/couriers')}>
                  <div style={{ ...s.alertIcon, background: '#E67700' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.3 3.86L1.82 18a2 2 0 0 0 1.7 3h16.96a2 2 0 0 0 1.7-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#874D00' }}>{pendingDebts} запрос{pendingDebts === 1 ? '' : pendingDebts < 5 ? 'а' : 'ов'}</div>
                    <div style={{ fontSize: 11, color: '#A66500', marginTop: 2 }}>На погашение долга</div>
                  </div>
                </button>
              )}
              {totalDebtAmt > 0 && (
                <button style={{ ...s.alertCard, background: '#FFF5F5', borderColor: '#FFCCCC' }}
                  onClick={() => navigate('/admin/couriers')}>
                  <div style={{ ...s.alertIcon, background: '#E03131' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#8B0000' }}>{Math.round(totalDebtAmt / 1000)}к сум</div>
                    <div style={{ fontSize: 11, color: '#A62020', marginTop: 2 }}>Долг по наличке</div>
                  </div>
                </button>
              )}
              {bottlesOwed > 0 && (
                <button style={{ ...s.alertCard, background: '#E8F4FD', borderColor: '#A8CFF0' }}
                  onClick={() => navigate('/admin/warehouse')}>
                  <div style={{ ...s.alertIcon, background: '#1971C2' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 2h6v3l3 3v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8l3-3V2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#0B3A66' }}>{bottlesOwed} шт.</div>
                    <div style={{ fontSize: 11, color: '#155388', marginTop: 2 }}>20л бутылей у курьеров</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Status breakdown */}
          {stats?.by_status && Object.keys(stats.by_status).length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>Заказы по статусам</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(stats.by_status).sort(([, a], [, b]) => b - a).map(([status, count]) => {
                  const pct = byStatusTotal ? Math.round(count / byStatusTotal * 100) : 0
                  const st = STATUS_STYLE[status] || { bg: '#F2F2F7', color: TEXT2 }
                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 120, fontSize: 12, color: TEXT, fontWeight: 600 }}>{STATUS_LABELS[status] || status}</div>
                      <div style={{ flex: 1, height: 8, background: '#F2F2F7', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: st.color, borderRadius: 99, transition: 'width .5s' }} />
                      </div>
                      <div style={{ minWidth: 52, textAlign: 'right', fontSize: 13, fontWeight: 800, color: st.color }}>
                        {count} <span style={{ fontSize: 10, color: TEXT2, fontWeight: 500 }}>{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent orders */}
          {recent.length > 0 && (
            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={s.cardTitle}>Последние заказы</div>
                <button style={s.linkBtn} onClick={() => navigate('/admin/orders')}>Все →</button>
              </div>
              {recent.map((o, i) => {
                const ss = STATUS_STYLE[o.status] || { bg: '#F2F2F7', color: TEXT2 }
                return (
                  <div key={o.id} onClick={() => navigate('/admin/orders')} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer',
                    borderBottom: i < recent.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}>
                    <div style={s.idBadge}>#{o.id}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address || 'Без адреса'}</div>
                      <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{o.client_name || o.phone || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{(o.total || 0).toLocaleString('ru-RU')}</div>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700, background: ss.bg, color: ss.color, marginTop: 2, display: 'inline-block' }}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Shortcuts */}
          <div style={{ ...s.cardTitle, margin: '4px 2px 8px' }}>Управление</div>
          <div style={s.shortcutGrid}>
            {SHORTCUTS.map(sc => (
              <button key={sc.path} onClick={() => navigate(sc.path)} style={s.shortcutBtn}>
                <div style={{ ...s.shortcutIcon, background: sc.bg, color: sc.accent }}>{sc.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{sc.label}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  )
}

function Kpi({ accent, bg, label, value, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: bg, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
        {label[0]}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: TEXT2, opacity: 0.75 }}>{sub}</div>}
    </div>
  )
}

const s = {
  segRow: { display: 'flex', gap: 6, marginBottom: 12 },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 },
  alertsRow: { display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  alertCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderRadius: 14, border: '1.5px solid', cursor: 'pointer', minWidth: 200, flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  alertIcon: { width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card: {
    background: '#fff', borderRadius: 18, padding: '14px 16px', marginBottom: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: 800, color: TEXT },
  linkBtn: { background: 'none', border: 'none', color: C, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  idBadge: { fontSize: 11, fontWeight: 800, color: TEXT2, background: '#F2F2F7', padding: '3px 8px', borderRadius: 8, flexShrink: 0 },
  shortcutGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  shortcutBtn: {
    background: '#fff', border: 'none', borderRadius: 16, padding: '14px 8px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', WebkitTapHighlightColor: 'transparent',
  },
  shortcutIcon: { width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
