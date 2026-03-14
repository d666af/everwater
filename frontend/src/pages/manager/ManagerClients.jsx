import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminUsers, getUserOrders, confirmTopup } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'

const STATUS_LABELS = {
  new: 'Новый', awaiting_confirmation: 'Ожидает', confirmed: 'Подтверждён',
  assigned_to_courier: 'У курьера', in_delivery: 'В доставке',
  delivered: 'Доставлен', rejected: 'Отклонён',
}
const STATUS_STYLE = {
  new:                   { bg: '#EDF3FF', color: '#3B5BDB' },
  awaiting_confirmation: { bg: '#FFF8E6', color: '#E67700' },
  confirmed:             { bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier:   { bg: '#F3F0FF', color: '#6741D9' },
  in_delivery:           { bg: '#E8F4FD', color: '#1971C2' },
  delivered:             { bg: '#EBFBEE', color: '#2B8A3E' },
  rejected:              { bg: '#FFF5F5', color: '#E03131' },
}

// ─── Topup Modal ──────────────────────────────────────────────────────────────
function TopupModal({ user, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handle = async () => {
    const amt = Number(amount)
    if (!amt || amt < 100) return
    setLoading(true)
    try { await onConfirm(amt); setDone(true) }
    catch { alert('Ошибка при пополнении') }
    finally { setLoading(false) }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        {done ? (
          <div style={s.doneWrap}>
            <div style={s.doneCircle}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={s.doneTitle}>Баланс пополнен!</div>
            <div style={s.doneDesc}>{user.name}: +{Number(amount).toLocaleString()} сум</div>
            <button style={s.sheetBtn} onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <>
            <div style={s.sheetTitle}>Пополнить баланс</div>
            <div style={s.sheetSub}>Клиент: <b>{user.name}</b></div>
            <div style={s.amtGrid}>
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
              type="number" inputMode="numeric"
              placeholder="Сумма (сум)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <button
              style={{ ...s.sheetBtn, ...(!amount || Number(amount) < 100 ? s.sheetBtnDisabled : {}) }}
              disabled={!amount || Number(amount) < 100 || loading}
              onClick={handle}>
              {loading ? 'Начисляю...' : `Зачислить ${amount ? Number(amount).toLocaleString() + ' сум' : ''}`}
            </button>
            <button style={s.cancelBtn} onClick={onClose}>Отмена</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Client Detail Sheet ──────────────────────────────────────────────────────
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
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...s.sheet, padding: 0, paddingBottom: 40 }}>
        <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={s.handle} />
        </div>

        {/* Header */}
        <div style={s.detailHead}>
          <div style={s.detailAvatar}>{(user.name || '?')[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={s.detailName}>{user.name || 'Без имени'}</div>
            {user.phone && <div style={s.detailPhone}>{user.phone}</div>}
            <div style={s.detailId}>ID: {user.telegram_id}</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statBlock}>
            <div style={s.statVal}>{(user.balance || 0).toLocaleString()}</div>
            <div style={s.statLbl}>Баланс сум</div>
          </div>
          <div style={s.statBlock}>
            <div style={s.statVal}>{Math.round(user.bonus_points || 0)}</div>
            <div style={s.statLbl}>Бонусов</div>
          </div>
          <div style={s.statBlock}>
            <div style={s.statVal}>{orders.length}</div>
            <div style={s.statLbl}>Заказов</div>
          </div>
        </div>

        {/* Actions */}
        <div style={s.detailActions}>
          <button style={s.actionGreen} onClick={onTopup}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M2 10h20M8 15h3m5 0h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Пополнить баланс
          </button>
          {user.phone && (
            <a href={`tel:${user.phone}`} style={s.actionOutline}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/>
              </svg>
              Позвонить
            </a>
          )}
        </div>

        {/* Orders */}
        <div style={{ padding: '0 20px' }}>
          <div style={s.sectionTitle}>История заказов</div>
          {loadingOrders ? (
            <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
              <div style={s.spinner} />
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: TEXT2, fontSize: 14 }}>
              Заказов нет
            </div>
          ) : (
            orders.slice(0, 10).map(o => {
              const ss = STATUS_STYLE[o.status] || { bg: BG, color: TEXT2 }
              return (
                <div key={o.id} style={s.orderRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>#{o.id}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: ss.bg, color: ss.color }}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                    {o.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 3 }}>{o.address}</div>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>
                    {(o.total || 0).toLocaleString()} сум
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

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  const registered = users.filter(u => u.is_registered).length
  const withBalance = users.filter(u => (u.balance || 0) > 0).length

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
          onChat={() => { setSelectedUser(null); navigate('/manager/support') }}
        />
      )}

      {/* Stats */}
      <div style={s.statsBar}>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: C }}>{users.length}</div>
          <div style={s.statCaption}>Всего</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#2B8A3E' }}>{registered}</div>
          <div style={s.statCaption}>Зарег.</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#E67700' }}>{withBalance}</div>
          <div style={s.statCaption}>С балансом</div>
        </div>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke={TEXT2} strokeWidth="1.8"/>
          <path d="m21 21-4.35-4.35" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <input style={s.searchInput} placeholder="Имя или телефон..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search
          ? <button style={s.clearBtn} onClick={() => setSearch('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          : <span style={s.countChip}>{filtered.length}</span>
        }
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}>
            <circle cx="9" cy="7" r="4" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M3 21C3 18 5.7 16 9 16" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="16" cy="11" r="3" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M13 21C13 19 14.3 17 16 17C17.7 17 19 19 19 21" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyTitle}>Клиентов не найдено</div>
        </div>
      ) : (
        <div style={s.list}>
          {filtered.map(u => (
            <div key={u.id} style={s.card} onClick={() => setSelectedUser(u)}>
              <div style={s.avatar}>{(u.name || '?')[0].toUpperCase()}</div>
              <div style={s.info}>
                <div style={s.name}>{u.name || 'Без имени'}</div>
                {u.phone && <div style={s.phone}>{u.phone}</div>}
                <div style={s.chips}>
                  {u.is_registered
                    ? <span style={s.chipGreen}>Зарегистрирован</span>
                    : <span style={s.chipOrange}>Не завершил регистрацию</span>
                  }
                  {(u.balance || 0) > 0 && (
                    <span style={s.chipBalance}>{(u.balance).toLocaleString()} сум</span>
                  )}
                  {(u.bonus_points || 0) > 0 && (
                    <span style={s.chipBonus}>{Math.round(u.bonus_points)} бон.</span>
                  )}
                </div>
              </div>
              <button style={s.topupBtn}
                onClick={e => { e.stopPropagation(); setTopupUser(u) }}
                title="Пополнить баланс">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M2 10h20M8 15h3m5 0h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  )
}

const s = {
  statsBar: { display: 'flex', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, background: '#fff', borderRadius: 14, padding: '14px 10px',
    textAlign: 'center', border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statNum: { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  statCaption: { fontSize: 11, color: TEXT2, marginTop: 3, fontWeight: 500 },

  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14,
    padding: '11px 14px', marginBottom: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: TEXT },
  clearBtn: { border: 'none', background: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  countChip: { fontSize: 12, color: TEXT2, fontWeight: 600 },

  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 30, height: 30, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: TEXT2 },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 14,
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    cursor: 'pointer', transition: 'all 0.12s',
    WebkitTapHighlightColor: 'transparent',
  },
  avatar: {
    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    color: '#fff', fontWeight: 800, fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  name: { fontWeight: 700, fontSize: 15, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  phone: { fontSize: 13, color: TEXT2 },
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  chipGreen:   { fontSize: 11, background: '#EBFBEE', color: '#2B8A3E', padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  chipOrange:  { fontSize: 11, background: '#FFF8E6', color: '#E67700', padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  chipBalance: { fontSize: 11, background: '#EBFBEE', color: CD, padding: '2px 8px', borderRadius: 999, fontWeight: 700 },
  chipBonus:   { fontSize: 11, background: '#FFF3BF', color: '#E67700', padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  topupBtn: {
    width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: C, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent',
  },

  // Detail sheet
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', zIndex: 9000,
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    width: '100%', maxHeight: '92vh', overflowY: 'auto',
    padding: '12px 20px 40px',
    display: 'flex', flexDirection: 'column', gap: 16,
    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 99, background: '#E0E0E5',
    margin: '0 auto 4px', display: 'block',
  },
  detailHead: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '0 20px 16px', borderBottom: `1px solid ${BORDER}`,
  },
  detailAvatar: {
    width: 58, height: 58, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    color: '#fff', fontSize: 24, fontWeight: 800, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  detailName: { fontWeight: 800, fontSize: 18, color: TEXT },
  detailPhone: { fontSize: 14, color: TEXT2, marginTop: 2 },
  detailId: { fontSize: 11, color: '#bbb', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: '50%', border: 'none',
    background: '#F2F2F7', color: TEXT2, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statsRow: { display: 'flex', gap: 8, padding: '0 20px' },
  statBlock: {
    flex: 1, background: '#F8F9FA', borderRadius: 12, padding: '12px 8px',
    textAlign: 'center', border: `1px solid ${BORDER}`,
  },
  statVal: { fontSize: 22, fontWeight: 800, color: TEXT },
  statLbl: { fontSize: 11, color: TEXT2, marginTop: 2 },
  detailActions: { display: 'flex', gap: 8, padding: '0 20px', flexWrap: 'wrap' },
  actionGreen: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '11px 16px', borderRadius: 12, border: 'none',
    background: C, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  actionOutline: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '11px 16px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#fff', color: TEXT, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
  },
  sectionTitle: { fontWeight: 800, fontSize: 16, color: TEXT, padding: '16px 0 10px' },
  orderRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '12px 0', borderBottom: `1px solid ${BORDER}`,
  },

  // Topup modal
  sheetTitle: { fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center', letterSpacing: -0.3 },
  sheetSub: { fontSize: 14, color: TEXT2, textAlign: 'center', marginTop: -8 },
  amtGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  amtChip: {
    padding: '14px 8px', borderRadius: 12,
    border: `1.5px solid ${BORDER}`, background: '#F8F9FA',
    fontSize: 15, fontWeight: 700, color: TEXT, cursor: 'pointer', textAlign: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  amtChipActive: { background: 'rgba(141,198,63,0.1)', border: `1.5px solid ${C}`, color: CD },
  amtInput: {
    border: `1.5px solid ${BORDER}`, borderRadius: 14,
    padding: '14px 16px', fontSize: 18, fontWeight: 700, outline: 'none',
    background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box',
  },
  sheetBtn: {
    padding: '16px', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
  },
  sheetBtnDisabled: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },
  cancelBtn: {
    padding: '14px', borderRadius: 14, border: `1.5px solid ${BORDER}`,
    background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  doneWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '10px 0' },
  doneCircle: {
    width: 72, height: 72, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(141,198,63,0.4)',
  },
  doneTitle: { fontSize: 22, fontWeight: 800, color: TEXT },
  doneDesc: { fontSize: 14, color: TEXT2, textAlign: 'center' },
}
