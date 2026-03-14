import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminUsers, getUserOrders, confirmTopup } from '../../api'

const G = '#2d6a4f'

const STATUS_LABELS = {
  new: 'Новый', awaiting_confirmation: 'Ожид. подтв.', confirmed: 'Подтверждён',
  assigned_to_courier: 'У курьера', in_delivery: 'В доставке',
  delivered: 'Доставлен', rejected: 'Отклонён',
}
const STATUS_COLORS = {
  new: '#1565c0', awaiting_confirmation: '#e65100', confirmed: G,
  assigned_to_courier: '#4527a0', in_delivery: '#00695c',
  delivered: '#558b2f', rejected: '#c62828',
}

function TopupModal({ user, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handle = async () => {
    const amt = Number(amount)
    if (!amt || amt < 100) return
    setLoading(true)
    try {
      await onConfirm(amt)
      setDone(true)
    } catch {
      alert('Ошибка при пополнении')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modalSheet}>
        <div style={s.modalHandle} />
        {done ? (
          <div style={s.donWrap}>
            <div style={s.doneIcon}>✅</div>
            <div style={s.doneTitle}>Баланс пополнен!</div>
            <div style={s.doneDesc}>Клиенту {user.name} начислено {Number(amount).toLocaleString()} сум</div>
            <button style={s.modalBtn} onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <>
            <div style={s.modalTitle}>Пополнить баланс</div>
            <div style={s.modalSubtitle}>Клиент: <b>{user.name}</b></div>
            <div style={s.amtRow}>
              {[5000, 10000, 25000, 50000].map(a => (
                <button key={a}
                  style={{ ...s.amtChip, ...(Number(amount) === a ? s.amtChipActive : {}) }}
                  onClick={() => setAmount(String(a))}>
                  {a.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              style={s.amtInput}
              type="number"
              inputMode="numeric"
              placeholder="Введите сумму (сум)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <button
              style={{ ...s.modalBtn, ...(!amount || Number(amount) < 100 ? s.modalBtnDisabled : {}) }}
              disabled={!amount || Number(amount) < 100 || loading}
              onClick={handle}>
              {loading ? 'Начисляю...' : `Зачислить ${amount ? Number(amount).toLocaleString() + ' сум' : ''}`}
            </button>
            <button style={s.modalCancelBtn} onClick={onClose}>Отмена</button>
          </>
        )}
      </div>
    </div>
  )
}

function ClientDetail({ user, onClose, onTopup, onChat }) {
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    getUserOrders(user.id)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false))
  }, [user.id])

  return (
    <div style={s.detailOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.detailSheet}>
        <div style={s.modalHandle} />
        <div style={s.detailHeader}>
          <div style={s.detailAvatar}>{(user.name || '?')[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={s.detailName}>{user.name || 'Без имени'}</div>
            <div style={s.detailPhone}>{user.phone || '—'}</div>
            <div style={s.detailId}>tg_id: {user.telegram_id}</div>
          </div>
          <button style={s.detailClose} onClick={onClose}>✕</button>
        </div>

        {/* Stats row */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statVal}>{(user.balance || 0).toLocaleString()}</div>
            <div style={s.statLbl}>Баланс сум</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{user.bonus_points || 0}</div>
            <div style={s.statLbl}>Бонусов</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{orders.length}</div>
            <div style={s.statLbl}>Заказов</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={s.detailActions}>
          <button style={s.actionGreen} onClick={onTopup}>
            💳 Пополнить баланс
          </button>
          <button style={s.actionBlue} onClick={onChat}>
            💬 Написать клиенту
          </button>
          {user.phone && (
            <a href={`tel:${user.phone}`} style={s.actionCall}>
              📞 Позвонить
            </a>
          )}
        </div>

        {/* Order history */}
        <div style={s.ordersSection}>
          <div style={s.ordersSectionTitle}>История заказов</div>
          {loadingOrders ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Загрузка...</div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Заказов нет</div>
          ) : (
            orders.slice(0, 10).map(o => {
              const color = STATUS_COLORS[o.status] || '#888'
              return (
                <div key={o.id} style={s.orderRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: G }}>#{o.id}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700, background: color + '20', color }}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{o.address}</div>
                    {o.delivery_time && <div style={{ fontSize: 11, color: '#888' }}>🕐 {o.delivery_time}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: G }}>{(o.total || 0).toLocaleString()} сум</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function ManagerClients() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [topupUser, setTopupUser] = useState(null)

  useEffect(() => {
    getAdminUsers().then(setUsers).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    (u.name?.toLowerCase().includes(search.toLowerCase()) || '') ||
    (u.phone?.includes(search) || '')
  )

  const handleTopupConfirm = async (userId, amount) => {
    await confirmTopup(userId, amount)
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, balance: (u.balance || 0) + amount } : u
    ))
  }

  const openChat = (user) => {
    navigate('/manager/support')
  }

  return (
    <ManagerLayout title="Клиенты">
      {topupUser && (
        <TopupModal
          user={topupUser}
          onClose={() => setTopupUser(null)}
          onConfirm={(amt) => handleTopupConfirm(topupUser.id, amt)}
        />
      )}
      {selectedUser && (
        <ClientDetail
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onTopup={() => { setTopupUser(selectedUser); setSelectedUser(null) }}
          onChat={() => { setSelectedUser(null); openChat(selectedUser) }}
        />
      )}

      <div style={s.page}>
        {/* Stats */}
        <div style={s.statsBar}>
          <div style={s.statsCard}>
            <div style={s.statsVal}>{users.filter(u => u.is_registered).length}</div>
            <div style={s.statsLbl}>Зарегистрированных</div>
          </div>
          <div style={s.statsCard}>
            <div style={s.statsVal}>{users.filter(u => !u.is_registered).length}</div>
            <div style={s.statsLbl}>Незарегистрированных</div>
          </div>
          <div style={s.statsCard}>
            <div style={s.statsVal}>{users.filter(u => (u.balance || 0) > 0).length}</div>
            <div style={s.statsLbl}>С балансом</div>
          </div>
        </div>

        {/* Search */}
        <div style={s.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="#888" strokeWidth="1.8"/>
            <path d="m21 21-4.35-4.35" stroke="#888" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input style={s.searchInput} placeholder="Поиск по имени или телефону..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={s.clearBtn} onClick={() => setSearch('')}>✕</button>}
          <div style={s.count}>{filtered.length}</div>
        </div>

        {loading ? (
          <div style={s.center}><div style={s.spinner} /></div>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 40 }}>👥</div>
            <div style={{ fontWeight: 600, color: '#555' }}>Клиентов не найдено</div>
          </div>
        ) : (
          <div style={s.list}>
            {filtered.map(u => (
              <div key={u.id} style={s.card} onClick={() => setSelectedUser(u)}>
                <div style={s.avatar}>{(u.name || '?')[0].toUpperCase()}</div>
                <div style={s.info}>
                  <div style={s.name}>{u.name || 'Без имени'}</div>
                  <div style={s.meta}>
                    {u.phone && <span>📱 {u.phone}</span>}
                    <span style={{ color: '#aaa' }}>#{u.telegram_id}</span>
                  </div>
                  <div style={s.chips}>
                    {u.is_registered ? (
                      <span style={s.regChip}>✅ Зарегистрирован</span>
                    ) : (
                      <span style={s.unregChip}>⏳ Не завершил регистрацию</span>
                    )}
                    {u.balance > 0 && (
                      <span style={s.balChip}>💰 {(u.balance || 0).toLocaleString()} сум</span>
                    )}
                    {u.bonus_points > 0 && (
                      <span style={s.bonusChip}>🎁 {u.bonus_points} бонусов</span>
                    )}
                  </div>
                </div>
                <div style={s.cardActions}>
                  <button style={s.topupBtn}
                    onClick={e => { e.stopPropagation(); setTopupUser(u) }}
                    title="Пополнить баланс">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/>
                      <path d="M2 10h20M8 15h3m5 0h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  {u.phone && (
                    <a href={`tel:${u.phone}`} style={s.callBtn}
                      onClick={e => e.stopPropagation()}>📞</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 12 },
  statsBar: { display: 'flex', gap: 8 },
  statsCard: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '12px 10px',
    textAlign: 'center', border: '1px solid #e8f5e9',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  statsVal: { fontSize: 22, fontWeight: 800, color: G },
  statsLbl: { fontSize: 10, color: '#888', marginTop: 2 },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1px solid #e0f0e8', borderRadius: 12, padding: '10px 14px',
  },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent', color: '#1C1C1E' },
  clearBtn: { border: 'none', background: 'none', color: '#888', cursor: 'pointer', fontSize: 14 },
  count: { fontSize: 12, color: '#888', fontWeight: 600, flexShrink: 0 },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: '3px solid #8DC63F',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: { textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  card: {
    background: '#fff', borderRadius: 12, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #e8f5e9',
    cursor: 'pointer', transition: 'all 0.12s',
    WebkitTapHighlightColor: 'transparent',
  },
  avatar: {
    width: 42, height: 42, borderRadius: '50%', background: '#d8f3dc',
    color: G, fontWeight: 700, fontSize: 17, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  name: { fontWeight: 600, fontSize: 14, color: '#1b4332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { display: 'flex', gap: 10, fontSize: 11, color: '#666', flexWrap: 'wrap' },
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 1 },
  regChip:    { fontSize: 10, background: '#e8f5e9', color: G, padding: '2px 7px', borderRadius: 6 },
  unregChip:  { fontSize: 10, background: '#fff3e0', color: '#e65100', padding: '2px 7px', borderRadius: 6 },
  balChip:    { fontSize: 10, background: '#e8f5e9', color: G, padding: '2px 7px', borderRadius: 6, fontWeight: 600 },
  bonusChip:  { fontSize: 10, background: '#fff8e1', color: '#f57f17', padding: '2px 7px', borderRadius: 6, fontWeight: 500 },
  cardActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  topupBtn: {
    width: 34, height: 34, borderRadius: 9, border: `1px solid ${G}`,
    background: '#fff', color: G, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  callBtn: {
    width: 34, height: 34, borderRadius: 9, border: `1px solid ${G}`,
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, textDecoration: 'none', flexShrink: 0,
  },

  // Detail overlay
  detailOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', zIndex: 9000,
    display: 'flex', alignItems: 'flex-end',
  },
  detailSheet: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    width: '100%', maxHeight: '90vh', overflowY: 'auto',
    padding: '12px 0 40px',
    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 99, background: '#E0E0E5',
    margin: '0 auto 12px', display: 'block',
  },
  detailHeader: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '0 20px 16px', borderBottom: '1px solid #f0f7f0',
  },
  detailAvatar: {
    width: 56, height: 56, borderRadius: '50%',
    background: `linear-gradient(135deg, #8DC63F, #6CA32F)`,
    color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  detailName: { fontWeight: 700, fontSize: 18, color: '#1C1C1E' },
  detailPhone: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  detailId: { fontSize: 11, color: '#aaa', marginTop: 1 },
  detailClose: {
    width: 32, height: 32, borderRadius: '50%', border: 'none',
    background: '#F2F2F7', color: '#8E8E93', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statsRow: { display: 'flex', padding: '14px 20px', gap: 8, borderBottom: '1px solid #f0f7f0' },
  statCard: {
    flex: 1, background: '#F8FFF5', borderRadius: 10, padding: '10px 8px',
    textAlign: 'center', border: '1px solid #e8f5e9',
  },
  statVal: { fontSize: 20, fontWeight: 800, color: G },
  statLbl: { fontSize: 10, color: '#888', marginTop: 2 },
  detailActions: { display: 'flex', gap: 8, padding: '14px 20px', flexWrap: 'wrap', borderBottom: '1px solid #f0f7f0' },
  actionGreen: { padding: '9px 14px', borderRadius: 10, border: 'none', background: G, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  actionBlue: { padding: '9px 14px', borderRadius: 10, border: 'none', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  actionCall: { padding: '9px 14px', borderRadius: 10, border: `1px solid ${G}`, background: '#fff', color: G, fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' },
  ordersSection: { padding: '0 20px' },
  ordersSectionTitle: { fontWeight: 700, fontSize: 14, color: '#1C1C1E', padding: '14px 0 8px' },
  orderRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '10px 0', borderBottom: '1px solid #f0f7f0',
  },

  // Topup modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', zIndex: 9500,
    display: 'flex', alignItems: 'flex-end',
  },
  modalSheet: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    width: '100%', padding: '12px 20px 40px',
    display: 'flex', flexDirection: 'column', gap: 14,
    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#1C1C1E', textAlign: 'center', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: -8 },
  amtRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  amtChip: {
    flex: '1 1 calc(50% - 4px)', padding: '12px 8px', borderRadius: 10,
    border: '1.5px solid rgba(60,60,67,0.12)', background: '#F5F5F7',
    fontSize: 14, fontWeight: 700, color: '#1C1C1E', cursor: 'pointer', textAlign: 'center',
  },
  amtChipActive: { background: 'rgba(141,198,63,0.1)', border: '1.5px solid #8DC63F', color: G },
  amtInput: {
    border: '1.5px solid rgba(60,60,67,0.12)', borderRadius: 12,
    padding: '13px 16px', fontSize: 18, fontWeight: 700, outline: 'none',
    background: '#FAFAFA', color: '#1C1C1E', width: '100%', boxSizing: 'border-box',
  },
  modalBtn: {
    padding: '15px', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, #8DC63F, #6CA32F)`,
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
  },
  modalBtnDisabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' },
  modalCancelBtn: {
    padding: '13px', borderRadius: 14,
    border: '1.5px solid rgba(60,60,67,0.12)', background: 'none',
    color: '#8E8E93', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  donWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '10px 0' },
  doneIcon: { fontSize: 52 },
  doneTitle: { fontSize: 20, fontWeight: 800, color: '#1C1C1E' },
  doneDesc: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
}
