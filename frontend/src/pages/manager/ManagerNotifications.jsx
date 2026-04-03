import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.08)'

function formatRelTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const TYPE_MAP = {
  payment: {
    color: '#2B8A3E',
    label: 'Оплата',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="#2B8A3E" strokeWidth="1.7" />
        <path d="M2 10h20" stroke="#2B8A3E" strokeWidth="1.5" />
        <path d="M6 15h4" stroke="#2B8A3E" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  topup: {
    color: '#1971C2',
    label: 'Пополнение',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="#1971C2" strokeWidth="1.7" />
        <path d="M12 9v6M9 12h6" stroke="#1971C2" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  new_order: {
    color: '#E67700',
    label: 'Новый заказ',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 7l-8-4-8 4m16 0v10l-8 4m8-14l-8 4m0 10L4 17V7m8 14V11m0 0L4 7" stroke="#E67700" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
  },
  courier: {
    color: '#6741D9',
    label: 'Курьер',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#6741D9" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="8.5" cy="7" r="4" stroke="#6741D9" strokeWidth="1.7" />
        <path d="M20 8v6M23 11h-6" stroke="#6741D9" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
}

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'unread', label: 'Новые' },
  { key: 'payment', label: 'Оплата' },
  { key: 'topup', label: 'Пополнения' },
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
      .then(data => setNotifications(data))
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

  const unreadCount = notifications.filter(n => !n.read).length

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.type === filter)

  const handleCardClick = (notif) => {
    if (!notif.read) handleRead(notif.id)
    if (notif.order_id) navigate('/manager')
    else if (notif.user_id) navigate('/manager/clients')
  }

  const getTypeConfig = (type) => TYPE_MAP[type] || {
    color: TEXT2, label: 'Уведомление',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={TEXT2} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M13.73 21a2 2 0 01-3.46 0" stroke={TEXT2} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  }

  return (
    <ManagerLayout title="Уведомления">
      {/* Header row: unread badge + mark all read */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {unreadCount > 0 && (
            <span style={{
              background: GRAD, color: '#fff',
              borderRadius: 999, fontSize: 12, fontWeight: 800,
              padding: '3px 10px', minWidth: 24, textAlign: 'center',
              boxShadow: '0 2px 8px rgba(126,200,64,0.3)',
            }}>
              {unreadCount} {unreadCount === 1 ? 'новое' : unreadCount < 5 ? 'новых' : 'новых'}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleReadAll}
            style={{
              padding: '7px 16px', borderRadius: 999,
              border: `1.5px solid ${C}`, background: 'transparent',
              color: CD, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.15s',
            }}
          >
            Прочитать все
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 4, marginBottom: 18,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 16px', borderRadius: 999, flexShrink: 0,
                border: active ? 'none' : `1.5px solid ${BORDER}`,
                background: active ? GRAD : '#fff',
                color: active ? '#fff' : TEXT2,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.18s ease',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: active ? '0 2px 10px rgba(126,200,64,0.25)' : 'none',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid rgba(141,198,63,0.15)`,
            borderTopColor: C,
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '64px 24px', gap: 14,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: '#fff',
            border: `1.5px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={TEXT2} strokeWidth="1.4" strokeLinecap="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke={TEXT2} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>
            Нет уведомлений
          </div>
          <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center', lineHeight: 1.5 }}>
            Здесь будут появляться уведомления о заказах, оплатах и пополнениях
          </div>
        </div>
      ) : (
        /* Notification list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 700 }}>
          {filtered.map(notif => {
            const cfg = getTypeConfig(notif.type)
            const isUnread = !notif.read
            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                style={{
                  background: '#fff',
                  borderRadius: 18,
                  padding: 16,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  position: 'relative',
                  borderLeft: isUnread ? `3px solid ${cfg.color}` : '3px solid transparent',
                  transition: 'all 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: `${cfg.color}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cfg.icon}
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Top row: type badge + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 999,
                      background: `${cfg.color}1F`,
                      color: cfg.color,
                      letterSpacing: 0.2,
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 12, color: TEXT2, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                      {formatRelTime(notif.time)}
                    </span>
                  </div>

                  {/* Title */}
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.35,
                  }}>
                    {notif.title}
                  </div>

                  {/* Body text */}
                  {notif.body && (
                    <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.45 }}>
                      {notif.body}
                    </div>
                  )}

                  {/* Action links */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {(notif.type === 'payment' || notif.type === 'new_order') && notif.order_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRead(notif.id)
                          navigate('/manager')
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 12px', borderRadius: 10,
                          border: `1.5px solid ${BORDER}`,
                          background: '#fff', color: CD,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        Открыть заказ
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                    {notif.type === 'topup' && notif.user_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRead(notif.id)
                          navigate('/manager/clients')
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '5px 12px', borderRadius: 10,
                          border: `1.5px solid ${BORDER}`,
                          background: '#fff', color: '#1971C2',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                          transition: 'all 0.15s',
                        }}
                      >
                        Подтвердить баланс
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: cfg.color, flexShrink: 0, marginTop: 6,
                    boxShadow: `0 0 0 3px ${cfg.color}25`,
                  }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </ManagerLayout>
  )
}
