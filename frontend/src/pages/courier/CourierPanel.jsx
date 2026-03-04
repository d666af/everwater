import { useEffect, useState } from 'react'
import { getCourierOrders, courierAccept, courierInDelivery, courierDelivered, getCourierStats } from '../../api'

const tg = window.Telegram?.WebApp

const STATUS_LABELS = {
  confirmed: 'Подтверждён',
  assigned_to_courier: 'Назначен вам',
  in_delivery: 'В доставке',
  delivered: 'Доставлен',
}

const STATUS_COLORS = {
  confirmed: '#1565c0',
  assigned_to_courier: '#4527a0',
  in_delivery: '#00695c',
  delivered: '#558b2f',
}

function StatCard({ label, value, icon }) {
  return (
    <div style={cs.statCard}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={cs.statVal}>{value}</div>
      <div style={cs.statLbl}>{label}</div>
    </div>
  )
}

export default function CourierPanel() {
  const [tab, setTab] = useState('orders') // orders | stats
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const telegramId = tg?.initDataUnsafe?.user?.id

  const load = () => {
    if (!telegramId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      getCourierOrders(telegramId),
      getCourierStats(telegramId),
    ])
      .then(([o, s]) => { setOrders(o); setStats(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const doAction = async (fn, orderId) => {
    setActionLoading(true)
    try { await fn(orderId); load() }
    catch { tg?.showAlert('Ошибка выполнения действия') }
    finally { setActionLoading(false) }
  }

  const active = orders.filter(o => ['assigned_to_courier', 'in_delivery'].includes(o.status))
  const completed = orders.filter(o => o.status === 'delivered')

  if (!telegramId) return (
    <div style={cs.noAccess}>
      <div style={{ fontSize: 64 }}>🚴</div>
      <h2>Панель курьера</h2>
      <p>Откройте через Telegram-бота</p>
    </div>
  )

  return (
    <div style={cs.page}>
      {/* Header */}
      <div style={cs.header}>
        <div style={cs.headerLeft}>
          <div style={cs.logo}>🚴</div>
          <div>
            <div style={cs.headerTitle}>Панель курьера</div>
            {tg?.initDataUnsafe?.user?.first_name && (
              <div style={cs.headerSub}>{tg.initDataUnsafe.user.first_name}</div>
            )}
          </div>
        </div>
        <button style={cs.refreshBtn} onClick={load}>🔄</button>
      </div>

      {/* Tabs */}
      <div style={cs.tabs}>
        <button style={{ ...cs.tab, ...(tab === 'orders' ? cs.tabActive : {}) }} onClick={() => setTab('orders')}>
          📦 Заказы {active.length > 0 && <span style={cs.badge}>{active.length}</span>}
        </button>
        <button style={{ ...cs.tab, ...(tab === 'stats' ? cs.tabActive : {}) }} onClick={() => setTab('stats')}>
          📊 Отчёт
        </button>
      </div>

      {loading ? (
        <div style={cs.center}>Загрузка...</div>
      ) : (
        <>
          {/* Orders tab */}
          {tab === 'orders' && (
            <div style={cs.content}>
              {active.length === 0 && completed.length === 0 && (
                <div style={cs.empty}>
                  <div style={{ fontSize: 48 }}>📭</div>
                  <div>Нет назначенных заказов</div>
                </div>
              )}

              {active.length > 0 && (
                <>
                  <div style={cs.sectionTitle}>Активные ({active.length})</div>
                  {active.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      onAction={doAction}
                      actionLoading={actionLoading}
                    />
                  ))}
                </>
              )}

              {completed.length > 0 && (
                <>
                  <div style={cs.sectionTitle}>Выполнено сегодня ({completed.length})</div>
                  {completed.slice(0, 5).map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      expanded={expanded}
                      setExpanded={setExpanded}
                      onAction={doAction}
                      actionLoading={actionLoading}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Stats tab */}
          {tab === 'stats' && stats && (
            <div style={cs.content}>
              <div style={cs.statsGrid}>
                <StatCard label="Всего доставок" value={stats.delivery_count || 0} icon="📦" />
                <StatCard label="Сегодня" value={stats.today_count || 0} icon="🚀" />
                <StatCard label="Заработано" value={stats.earnings ? `${stats.earnings} ₽` : '—'} icon="💰" />
                <StatCard label="Рейтинг" value={stats.rating ? `${stats.rating.toFixed(1)} ⭐` : '—'} icon="⭐" />
              </div>
              {stats.recent && stats.recent.length > 0 && (
                <div style={cs.recentSection}>
                  <div style={cs.sectionTitle}>Последние доставки</div>
                  {stats.recent.map(o => (
                    <div key={o.id} style={cs.recentRow}>
                      <div>
                        <div style={cs.recentId}>Заказ #{o.id}</div>
                        <div style={cs.recentAddr}>{o.address}</div>
                      </div>
                      <div style={cs.recentTotal}>{o.total} ₽</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OrderCard({ order, expanded, setExpanded, onAction, actionLoading }) {
  const isExpanded = expanded === order.id
  const color = STATUS_COLORS[order.status] || '#888'

  return (
    <div style={cs.card}>
      <div style={cs.cardTop} onClick={() => setExpanded(e => e === order.id ? null : order.id)}>
        <div>
          <div style={cs.orderId}>Заказ #{order.id}</div>
          <div style={cs.orderAddr}>{order.address}</div>
          {order.delivery_time && <div style={cs.orderTime}>🕐 {order.delivery_time}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={cs.orderTotal}>{order.total} ₽</div>
          <span style={{ ...cs.statusChip, background: color + '22', color }}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
          <div style={cs.chevron}>{isExpanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {isExpanded && (
        <div style={cs.details}>
          <div style={cs.infoGrid}>
            <div><b>📱 Телефон:</b>
              {order.recipient_phone ? (
                <a href={`tel:${order.recipient_phone}`} style={cs.phoneLink}> {order.recipient_phone}</a>
              ) : ' —'}
            </div>
            <div><b>📍 Адрес:</b> {order.address}</div>
            {order.extra_info && <div><b>🏠</b> {order.extra_info}</div>}
            {order.latitude && order.longitude && (
              <a
                href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                target="_blank" rel="noopener noreferrer"
                style={cs.mapLink}
              >
                🗺️ Открыть на карте
              </a>
            )}
            {order.return_bottles_count > 0 && (
              <div style={cs.bottleInfo}>
                <b>♻️ Забрать бутылок:</b> {order.return_bottles_count} шт. ({order.return_bottles_volume} л)
              </div>
            )}
          </div>

          {/* Items */}
          {order.items?.length > 0 && (
            <div style={cs.itemsBlock}>
              <b>Доставить:</b>
              {order.items.map(i => (
                <div key={i.id} style={cs.itemRow}>
                  🔹 {i.product_name} × {i.quantity}
                </div>
              ))}
            </div>
          )}

          <div style={cs.totalRow}>
            <span>К получению:</span>
            <span style={cs.totalVal}>{order.total} ₽</span>
          </div>

          {/* Action buttons */}
          <div style={cs.actions}>
            {order.status === 'assigned_to_courier' && (
              <button style={cs.acceptBtn} disabled={actionLoading}
                onClick={() => onAction(courierAccept, order.id)}>
                ✅ Принял заказ
              </button>
            )}
            {order.status === 'assigned_to_courier' && (
              <button style={cs.deliveryBtn} disabled={actionLoading}
                onClick={() => onAction(courierInDelivery, order.id)}>
                🚴 Выехал
              </button>
            )}
            {order.status === 'in_delivery' && (
              <button style={cs.doneBtn} disabled={actionLoading}
                onClick={() => onAction(courierDelivered, order.id)}>
                🏁 Доставлено
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// need these imported for the action handlers
function courierAccept(id) { return import('../../api').then(m => m.courierAccept(id)) }
function courierInDelivery(id) { return import('../../api').then(m => m.courierInDelivery(id)) }
function courierDelivered(id) { return import('../../api').then(m => m.courierDelivered(id)) }

const C = '#00897b'
const cs = {
  page: { minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' },
  header: {
    background: C, padding: '16px 20px', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: { fontSize: 32 },
  headerTitle: { color: '#fff', fontWeight: 700, fontSize: 18 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  refreshBtn: {
    background: 'rgba(255,255,255,0.2)', border: 'none',
    borderRadius: 8, padding: '8px 12px', fontSize: 18, cursor: 'pointer',
  },
  tabs: { display: 'flex', background: '#fff', borderBottom: '1px solid #e0e0e0' },
  tab: {
    flex: 1, padding: '12px 0', border: 'none', background: 'none',
    fontSize: 15, fontWeight: 500, cursor: 'pointer', color: '#666',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabActive: { color: C, borderBottom: `3px solid ${C}`, fontWeight: 700 },
  badge: {
    background: '#e53935', color: '#fff', borderRadius: '50%',
    width: 20, height: 20, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 11, fontWeight: 700,
  },
  content: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, padding: '60px 20px', color: '#888', fontSize: 16,
  },
  noAccess: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24,
    textAlign: 'center', color: '#444',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 0',
  },
  card: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' },
  orderId: { fontWeight: 700, fontSize: 16, color: '#00695c' },
  orderAddr: { fontSize: 13, color: '#555', marginTop: 3, maxWidth: 200 },
  orderTime: { fontSize: 12, color: '#888', marginTop: 2 },
  orderTotal: { fontWeight: 800, fontSize: 18, color: C },
  statusChip: { fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, display: 'inline-block', marginTop: 4 },
  chevron: { color: '#aaa', fontSize: 11, marginTop: 4 },
  details: {
    borderTop: '1px solid #f0f0f0', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 },
  phoneLink: { color: C, fontWeight: 600 },
  mapLink: {
    display: 'inline-block', color: '#fff',
    background: C, borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600,
    textDecoration: 'none',
  },
  bottleInfo: {
    background: '#e0f2f1', borderRadius: 8, padding: '8px 12px',
    fontSize: 13, color: '#00695c', fontWeight: 500,
  },
  itemsBlock: { fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4 },
  itemRow: { paddingLeft: 8, color: '#333', fontSize: 14 },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#e0f2f1', borderRadius: 8, padding: '10px 14px',
    fontWeight: 600, fontSize: 15,
  },
  totalVal: { fontSize: 22, fontWeight: 800, color: C },
  actions: { display: 'flex', gap: 8 },
  acceptBtn: {
    flex: 1, padding: '11px 0', border: 'none', borderRadius: 10,
    background: '#1565c0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  deliveryBtn: {
    flex: 1, padding: '11px 0', border: 'none', borderRadius: 10,
    background: C, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  doneBtn: {
    flex: 1, padding: '11px 0', border: 'none', borderRadius: 10,
    background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
  },
  statCard: {
    background: '#fff', borderRadius: 14, padding: '20px 16px', textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: 26, fontWeight: 800, color: C },
  statLbl: { fontSize: 12, color: '#888' },
  recentSection: { display: 'flex', flexDirection: 'column', gap: 8 },
  recentRow: {
    background: '#fff', borderRadius: 10, padding: '12px 14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  recentId: { fontWeight: 600, fontSize: 15 },
  recentAddr: { fontSize: 12, color: '#888', marginTop: 2 },
  recentTotal: { fontWeight: 700, fontSize: 16, color: C },
}
