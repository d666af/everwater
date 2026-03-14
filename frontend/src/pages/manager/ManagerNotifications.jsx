import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api'

const TYPE_CONFIG = {
  payment: { bg: '#E8F5E9', color: '#2d6a4f', icon: '💰', label: 'Оплата заказа' },
  topup:   { bg: '#E3F2FD', color: '#1565c0', icon: '💳', label: 'Пополнение баланса' },
  courier: { bg: '#EDE7F6', color: '#4527a0', icon: '🚴', label: 'Статус курьера' },
  new_order: { bg: '#FFF8E1', color: '#e65100', icon: '📦', label: 'Новый заказ' },
  default: { bg: '#F5F5F5', color: '#555', icon: '🔔', label: 'Уведомление' },
}

function formatRelTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function ManagerNotifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = () => {
    setLoading(true)
    getNotifications()
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleRead = async (id) => {
    await markNotificationRead(id).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleReadAll = async () => {
    await markAllNotificationsRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.type === filter)

  const unread = notifications.filter(n => !n.read).length

  const handleAction = (notif) => {
    handleRead(notif.id)
    if (notif.order_id) navigate('/manager')
    else if (notif.user_id) navigate('/manager/clients')
  }

  return (
    <ManagerLayout title="Уведомления">
      <div style={s.page}>
        {/* Header bar */}
        <div style={s.topBar}>
          <div style={s.filters}>
            {[
              { key: 'all', label: 'Все' },
              { key: 'unread', label: `Новые${unread > 0 ? ` (${unread})` : ''}` },
              { key: 'payment', label: '💰 Оплаты' },
              { key: 'topup', label: '💳 Балансы' },
              { key: 'new_order', label: '📦 Заказы' },
            ].map(f => (
              <button key={f.key}
                style={{ ...s.filterBtn, ...(filter === f.key ? s.filterActive : {}) }}
                onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {unread > 0 && (
            <button style={s.readAllBtn} onClick={handleReadAll}>
              Прочитать все
            </button>
          )}
        </div>

        {loading ? (
          <div style={s.center}>
            <div style={s.spinner} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>🔔</div>
            <div style={s.emptyTitle}>Нет уведомлений</div>
            <div style={s.emptyDesc}>Здесь будут появляться новые события</div>
          </div>
        ) : (
          <div style={s.list}>
            {filtered.map(notif => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.default
              return (
                <div key={notif.id}
                  style={{ ...s.card, ...(notif.read ? {} : s.cardUnread) }}
                  onClick={() => handleAction(notif)}>
                  <div style={{ ...s.iconWrap, background: cfg.bg }}>
                    <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                  </div>
                  <div style={s.body}>
                    <div style={s.notifTop}>
                      <span style={{ ...s.typeLabel, background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span style={s.time}>{formatRelTime(notif.time)}</span>
                    </div>
                    <div style={s.notifTitle}>{notif.title}</div>
                    <div style={s.notifBody}>{notif.body}</div>

                    {/* Action buttons */}
                    <div style={s.actions}>
                      {(notif.type === 'payment' || notif.type === 'new_order') && notif.order_id && (
                        <button style={s.actionBtn}
                          onClick={(e) => { e.stopPropagation(); handleRead(notif.id); navigate('/manager') }}>
                          Открыть заказ →
                        </button>
                      )}
                      {notif.type === 'topup' && notif.user_id && (
                        <button style={{ ...s.actionBtn, ...s.actionBtnBlue }}
                          onClick={(e) => { e.stopPropagation(); handleRead(notif.id); navigate('/manager/clients') }}>
                          Подтвердить баланс →
                        </button>
                      )}
                    </div>
                  </div>
                  {!notif.read && <div style={s.unreadDot} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  )
}

const G = '#2d6a4f'
const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 },
  filterBtn: {
    padding: '6px 14px', borderRadius: 20,
    border: '1px solid #b7e4c7', background: '#fff', color: G,
    fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
  filterActive: { background: G, color: '#fff', border: `1px solid ${G}` },
  readAllBtn: {
    padding: '6px 14px', borderRadius: 20,
    border: '1px solid #e0e0e0', background: '#fff', color: '#888',
    fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
  },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: '3px solid #8DC63F',
    animation: 'spin 0.8s linear infinite',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 20px', gap: 10,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#1C1C1E' },
  emptyDesc: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background: '#fff', borderRadius: 14,
    padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    border: '1px solid #e8f5e9',
    cursor: 'pointer', position: 'relative',
    transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  cardUnread: {
    background: '#FAFFFE',
    border: '1px solid #b7e4c7',
    boxShadow: '0 2px 8px rgba(141,198,63,0.1)',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  notifTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeLabel: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px',
    borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  time: { fontSize: 11, color: '#8E8E93', marginLeft: 'auto' },
  notifTitle: { fontSize: 14, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.3 },
  notifBody: { fontSize: 13, color: '#555', lineHeight: 1.4 },
  actions: { display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  actionBtn: {
    padding: '6px 12px', borderRadius: 8, border: `1px solid ${G}`,
    background: '#fff', color: G, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  actionBtnBlue: {
    border: '1px solid #1565c0', color: '#1565c0',
  },
  unreadDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#8DC63F', flexShrink: 0, marginTop: 4,
    boxShadow: '0 0 0 2px rgba(141,198,63,0.3)',
  },
}
