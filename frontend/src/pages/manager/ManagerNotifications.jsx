import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api'

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

const TYPE_CONFIG = {
  payment: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="#2B8A3E" strokeWidth="1.8"/>
        <path d="M2 10h20M8 15h3m5 0h-2" stroke="#2B8A3E" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    bg: '#EBFBEE', color: '#2B8A3E', label: 'Оплата заказа',
  },
  topup: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="#1971C2" strokeWidth="1.8"/>
        <path d="M12 9v6M9 12h6" stroke="#1971C2" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    bg: '#E8F4FD', color: '#1971C2', label: 'Пополнение баланса',
  },
  new_order: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="#E67700" strokeWidth="1.8"/>
        <path d="M7 9h10M7 13h6" stroke="#E67700" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    bg: '#FFF8E6', color: '#E67700', label: 'Новый заказ',
  },
  courier: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="#6741D9" strokeWidth="1.8"/>
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="#6741D9" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    bg: '#F3F0FF', color: '#6741D9', label: 'Курьер',
  },
  default: {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    bg: '#F2F2F7', color: TEXT2, label: 'Уведомление',
  },
}

function formatRelTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'unread', label: 'Новые' },
  { key: 'payment', label: 'Оплаты' },
  { key: 'topup', label: 'Балансы' },
  { key: 'new_order', label: 'Заказы' },
]

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

  const unread = notifications.filter(n => !n.read).length

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.type === filter)

  const handleAction = (notif) => {
    handleRead(notif.id)
    if (notif.order_id) navigate('/manager')
    else if (notif.user_id) navigate('/manager/clients')
  }

  return (
    <ManagerLayout title="Уведомления">
      {/* Filter pills + read all */}
      <div style={s.topRow}>
        <div style={s.filterScroll}>
          {FILTERS.map(f => (
            <button key={f.key}
              style={{ ...s.pill, ...(filter === f.key ? s.pillActive : {}) }}
              onClick={() => setFilter(f.key)}>
              {f.label}
              {f.key === 'unread' && unread > 0 && (
                <span style={s.pillBadge}>{unread}</span>
              )}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button style={s.readAllBtn} onClick={handleReadAll}>
            Все прочитаны
          </button>
        )}
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIconWrap}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={TEXT2} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={TEXT2} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
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
                  {cfg.icon}
                </div>
                <div style={s.body}>
                  <div style={s.notifTop}>
                    <span style={{ ...s.typeBadge, background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span style={s.time}>{formatRelTime(notif.time)}</span>
                  </div>
                  <div style={s.notifTitle}>{notif.title}</div>
                  {notif.body && <div style={s.notifBody}>{notif.body}</div>}

                  {/* Action links */}
                  <div style={s.actions}>
                    {(notif.type === 'payment' || notif.type === 'new_order') && notif.order_id && (
                      <button style={s.actionLink}
                        onClick={(e) => { e.stopPropagation(); handleRead(notif.id); navigate('/manager') }}>
                        Открыть заказ
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                    {notif.type === 'topup' && notif.user_id && (
                      <button style={{ ...s.actionLink, color: '#1971C2' }}
                        onClick={(e) => { e.stopPropagation(); handleRead(notif.id); navigate('/manager/clients') }}>
                        Подтвердить баланс
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
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
    </ManagerLayout>
  )
}

const s = {
  topRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 16, flexWrap: 'wrap',
  },
  filterScroll: { display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 },
  pill: {
    padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${BORDER}`,
    background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', color: TEXT2, display: 'flex', alignItems: 'center', gap: 5,
    transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
  },
  pillActive: { background: C, borderColor: C, color: '#fff' },
  pillBadge: {
    background: '#FF3B30', color: '#fff', borderRadius: 999,
    fontSize: 10, fontWeight: 800, minWidth: 16, height: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
  },
  readAllBtn: {
    padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent',
  },

  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#fff', border: `1px solid ${BORDER}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  emptyTitle: { fontSize: 17, fontWeight: 700, color: TEXT },
  emptyDesc: { fontSize: 14, color: TEXT2, textAlign: 'center' },

  list: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 },
  card: {
    background: '#fff', borderRadius: 18, padding: '14px 16px',
    display: 'flex', gap: 14, alignItems: 'flex-start',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    cursor: 'pointer', position: 'relative',
    transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
  },
  cardUnread: {
    background: '#FDFFFE',
    border: '1.5px solid rgba(141,198,63,0.3)',
    boxShadow: '0 2px 10px rgba(141,198,63,0.08)',
  },
  iconWrap: {
    width: 50, height: 50, borderRadius: 14, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  notifTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeBadge: {
    fontSize: 11, fontWeight: 700, padding: '3px 9px',
    borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  time: { fontSize: 12, color: TEXT2, marginLeft: 'auto' },
  notifTitle: { fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.3 },
  notifBody: { fontSize: 13, color: TEXT2, lineHeight: 1.4 },
  actions: { display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  actionLink: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: C, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  unreadDot: {
    width: 10, height: 10, borderRadius: '50%', background: C,
    flexShrink: 0, marginTop: 5,
    boxShadow: '0 0 0 3px rgba(141,198,63,0.2)',
  },
}
