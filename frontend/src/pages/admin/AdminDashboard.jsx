import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAdminStats, getOrders, getAdminCouriers, getWarehouseCourierStats } from '../../api'

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
  { path: '/admin/products',        label: 'Продукты',       accent: '#2B8A3E', bg: '#EBFBEE',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { path: '/admin/clients',         label: 'Клиенты',        accent: '#0C8599', bg: '#E3FAFC',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M21 19c0-2.2-1.8-4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/couriers',        label: 'Курьеры',        accent: '#1971C2', bg: '#E8F4FD',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/warehouse',       label: 'Склад',          accent: '#12B886', bg: '#E6FCF5',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { path: '/admin/subscriptions',   label: 'Подписки',       accent: '#6741D9', bg: '#F3F0FF',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/managers',        label: 'Менеджеры',      accent: '#862E9C', bg: '#F8F0FC',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { path: '/admin/support',         label: 'Поддержка',      accent: '#E67700', bg: '#FFF3D9',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-4-7.5L21 3v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { path: '/admin/settings',        label: 'Настройки',      accent: '#8E8E93', bg: '#F2F2F7',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a7.9 7.9 0 0 0 0-6l2-1.2-2-3.5-2.3.8a7.9 7.9 0 0 0-5.2-3L11.5 0h-4l-.4 2.3a7.9 7.9 0 0 0-5.2 3L-.4 4.3l-2 3.5 2 1.2a7.9 7.9 0 0 0 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { path: '/admin/warehouse/history', label: 'История склада', accent: '#2F9E44', bg: '#EBFBEE',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [couriersTotal, setCouriersTotal] = useState(0)
  const [bottlesOwed, setBottlesOwed] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAdminStats(period),
      getOrders({}),
      getAdminCouriers(),
      getWarehouseCourierStats().catch(() => []),
    ])
      .then(([st, orders, couriers, wcs]) => {
        setStats(st)
        setRecent(orders.slice(0, 5))
        setCouriersTotal(couriers.filter(c => c.is_active).length)
        setBottlesOwed(wcs.reduce((s, c) => s + Math.max(0, (c.bottles_must_return || 0) - (c.bottles_returned_today || 0)), 0))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  const byStatusTotal = stats?.by_status ? Object.values(stats.by_status).reduce((a, b) => a + b, 0) : 0
  const allStatusRows = Object.entries(STATUS_LABELS).map(([status]) => ({
    status,
    count: stats?.by_status?.[status] ?? 0,
  })).sort((a, b) => b.count - a.count)

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
            <Kpi accent="#2B8A3E" label="Заказов" value={stats?.order_count ?? 0} />
            <Kpi accent={CD} label="Выручка"
              value={stats?.revenue != null ? `${Math.round(stats.revenue / 1000)}к` : '—'} />
            <Kpi accent="#1971C2" label="Ср. чек"
              value={stats?.avg_check != null ? `${Math.round(stats.avg_check / 1000)}к` : '—'} />
            <Kpi accent="#6741D9" label="Курьеров" value={couriersTotal} />
          </div>

          {/* Alerts row — bottles */}
          {bottlesOwed > 0 && (
            <div style={s.alertsRow}>
              {bottlesOwed > 0 && (
                <button style={{ ...s.alertCard, background: '#E8F4FD', borderColor: '#A8CFF0' }}
                  onClick={() => navigate('/admin/warehouse')}>
                  <div style={{ ...s.alertIcon, background: '#1971C2' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 2h6v3l3 3v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8l3-3V2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#0B3A66' }}>{bottlesOwed} шт.</div>
                    <div style={{ fontSize: 11, color: '#155388', marginTop: 2 }}>19л бутылок у курьеров</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Status breakdown */}
          <div style={s.card}>
            <div style={s.cardTitle}>Заказы по статусам</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allStatusRows.map(({ status, count }) => {
                const pct = byStatusTotal ? Math.round(count / byStatusTotal * 100) : 0
                const st = STATUS_STYLE[status] || { bg: '#F2F2F7', color: TEXT2 }
                return (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 120, fontSize: 12, color: TEXT, fontWeight: 600 }}>{STATUS_LABELS[status]}</div>
                    <div style={{ flex: 1, height: 8, background: '#F2F2F7', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: st.color, borderRadius: 99, transition: 'width .5s' }} />
                    </div>
                    <div style={{ minWidth: 52, textAlign: 'right', fontSize: 13, fontWeight: 800, color: count > 0 ? st.color : TEXT2 }}>
                      {count} <span style={{ fontSize: 10, color: TEXT2, fontWeight: 500 }}>{count > 0 ? `${pct}%` : ''}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Shortcuts */}
          <div style={{ ...s.cardTitle, margin: '4px 2px 10px' }}>Управление</div>
          <div style={s.shortcutGrid}>
            {SHORTCUTS.map(sc => (
              <button key={sc.path} onClick={() => navigate(sc.path)} style={s.shortcutBtn}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: sc.bg, color: sc.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{sc.icon}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>{sc.label}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}><path d="M9 18l6-6-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
          </div>

          {/* Recent orders */}
          <div style={{ height: 8 }} />
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
        </>
      )}
    </AdminLayout>
  )
}

function Kpi({ accent, label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

const s = {
  segRow: { display: 'flex', gap: 6, marginBottom: 12 },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: { width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 },
  alertsRow: { display: 'flex', gap: 8, marginBottom: 12 },
  alertCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderRadius: 14, border: '1.5px solid', cursor: 'pointer', flex: 1,
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
  shortcutGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  shortcutBtn: {
    background: '#fff', border: 'none', borderRadius: 16, padding: '13px 16px',
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', WebkitTapHighlightColor: 'transparent',
    textAlign: 'left', width: '100%',
  },
}
