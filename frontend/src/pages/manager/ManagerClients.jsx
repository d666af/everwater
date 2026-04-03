import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminUsers, getUserOrders, confirmTopup, getClientDetails } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

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

const TX_COLORS = { payment: '#E03131', topup: '#2B8A3E', cashback: '#1971C2', bonus_used: '#E67700' }
const TX_LABELS = { payment: 'Оплата', topup: 'Пополнение', cashback: 'Кэшбэк', bonus_used: 'Бонусы' }
const TABS = ['Инфо', 'Заказы', 'Транзакции', 'Подписки', 'Бутылки', 'Адреса']

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
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '10px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${C}, ${CD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(141,198,63,0.4)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>Баланс пополнен!</div>
            <div style={{ fontSize: 14, color: TEXT2 }}>{user.name}: +{Number(amount).toLocaleString()} сум</div>
            <button style={st.primaryBtn} onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Пополнить баланс</div>
            <div style={{ fontSize: 14, color: TEXT2, textAlign: 'center' }}>Клиент: <b>{user.name}</b></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[5000, 10000, 25000, 50000].map(a => (
                <button key={a} style={{ padding: '14px 8px', borderRadius: 12, border: Number(amount) === a ? `1.5px solid ${C}` : `1.5px solid ${BORDER}`, background: Number(amount) === a ? 'rgba(141,198,63,0.1)' : '#F8F9FA', fontSize: 15, fontWeight: 700, color: Number(amount) === a ? CD : TEXT, cursor: 'pointer', textAlign: 'center', WebkitTapHighlightColor: 'transparent' }} onClick={() => setAmount(String(a))}>{a.toLocaleString()}</button>
              ))}
            </div>
            <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '14px 16px', fontSize: 18, fontWeight: 700, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' }} type="number" inputMode="numeric" placeholder="Сумма (сум)" value={amount} onChange={e => setAmount(e.target.value)} />
            <button style={{ ...st.primaryBtn, ...(!amount || Number(amount) < 100 ? { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' } : {}) }} disabled={!amount || Number(amount) < 100 || loading} onClick={handle}>
              {loading ? 'Начисляю...' : `Зачислить ${amount ? Number(amount).toLocaleString() + ' сум' : ''}`}
            </button>
            <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
          </>
        )}
      </div>
    </div>
  )
}

function ClientDetail({ user, onClose, onTopup }) {
  const [tab, setTab] = useState(0)
  const [orders, setOrders] = useState([])
  const [details, setDetails] = useState(null)
  const [loadingO, setLoadingO] = useState(true)
  const [loadingD, setLoadingD] = useState(true)

  useEffect(() => {
    getUserOrders(user.id).then(setOrders).catch(() => setOrders([])).finally(() => setLoadingO(false))
    getClientDetails(user.id).then(setDetails).catch(() => setDetails(null)).finally(() => setLoadingD(false))
  }, [user.id])

  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

  const renderTab = () => {
    if (tab === 0) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {user.is_registered
            ? <span style={{ fontSize: 12, background: '#EBFBEE', color: '#2B8A3E', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>Зарегистрирован</span>
            : <span style={{ fontSize: 12, background: '#FFF8E6', color: '#E67700', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>Не завершил регистрацию</span>}
        </div>
        {[
          ['Телефон', user.phone || '—'],
          ['Telegram ID', user.telegram_id || '—'],
          ['Баланс', `${(user.balance || 0).toLocaleString()} сум`],
          ['Бонусы', `${Math.round(user.bonus_points || 0)}`],
          ['Задолженность', details ? `${details.bottles_owed} бутылок` : '...'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 14, color: TEXT2 }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{v}</span>
          </div>
        ))}
      </div>
    )

    if (tab === 1) return loadingO ? <Spinner /> : orders.length === 0 ? <Empty text="Заказов нет" /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orders.map(o => {
          const ss = STATUS_STYLE[o.status] || { bg: '#F2F2F7', color: TEXT2 }
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>#{o.id}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: ss.bg, color: ss.color }}>{STATUS_LABELS[o.status] || o.status}</span>
                </div>
                {o.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 3 }}>{o.address}</div>}
                {o.delivery_time && <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{o.delivery_time}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, flexShrink: 0 }}>{(o.total || 0).toLocaleString()} сум</div>
            </div>
          )
        })}
      </div>
    )

    if (tab === 2) return loadingD ? <Spinner /> : !details?.transactions?.length ? <Empty text="Нет транзакций" /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {details.transactions.map(tx => {
          const clr = TX_COLORS[tx.type] || TEXT2
          const positive = tx.amount > 0
          return (
            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: clr + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {tx.type === 'payment' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke={clr} strokeWidth="1.8"/><path d="M2 10h20" stroke={clr} strokeWidth="1.5"/></svg>}
                {tx.type === 'topup' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={clr} strokeWidth="2" strokeLinecap="round"/></svg>}
                {tx.type === 'cashback' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke={clr} strokeWidth="1.8" strokeLinecap="round"/><path d="M3 3v5h5" stroke={clr} strokeWidth="1.8" strokeLinecap="round"/></svg>}
                {tx.type === 'bonus_used' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 6 7 1-5 5 1.2 7L12 18l-6.2 3L7 14 2 9l7-1 3-6z" stroke={clr} strokeWidth="1.5" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, background: clr + '18', color: clr, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{TX_LABELS[tx.type] || tx.type}</span>
                </div>
                <div style={{ fontSize: 13, color: TEXT, marginTop: 3 }}>{tx.desc}</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{fmtDate(tx.date)}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: clr, flexShrink: 0 }}>
                {positive ? '+' : ''}{tx.amount.toLocaleString()} сум
              </div>
            </div>
          )
        })}
      </div>
    )

    if (tab === 3) return loadingD ? <Spinner /> : !details?.subscriptions?.length ? <Empty text="Нет подписок" /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {details.subscriptions.map(sub => (
          <div key={sub.id} style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, background: sub.status === 'active' ? '#EBFBEE' : '#FFF5F5', color: sub.status === 'active' ? '#2B8A3E' : '#E03131', padding: '2px 10px', borderRadius: 999, fontWeight: 700 }}>
                {sub.status === 'active' ? 'Активна' : 'Неактивна'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{sub.plan}</span>
            </div>
            {[
              ['Период', sub.period],
              ['День', sub.day],
              ['Время', sub.time],
              ['Адрес', sub.address],
              ['Начало', fmtDate(sub.start)],
              ['Конец', fmtDate(sub.end)],
              ['Стоимость', `${(sub.price || 0).toLocaleString()} сум`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span style={{ color: TEXT2 }}>{k}</span>
                <span style={{ color: TEXT, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )

    if (tab === 4) return loadingD ? <Spinner /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: details?.bottles_owed > 0 ? '#E03131' : '#2B8A3E' }}>{details?.bottles_owed || 0}</div>
          <div style={{ fontSize: 14, color: TEXT2, marginTop: 4 }}>бутылок задолженность</div>
        </div>
        {!details?.bottles_history?.length ? <Empty text="Нет истории" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>История</div>
            {details.bottles_history.map((h, i) => {
              const isReturn = h.action === 'returned'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isReturn ? '#EBFBEE' : '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isReturn
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-9" stroke="#2B8A3E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#E03131" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{isReturn ? 'Возврат' : 'Получено'} {h.count} бут.</div>
                    <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{fmtDate(h.date)}{h.order_id ? ` · Заказ #${h.order_id}` : ''}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: isReturn ? '#2B8A3E' : '#E03131' }}>{isReturn ? '-' : '+'}{h.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )

    if (tab === 5) return loadingD ? <Spinner /> : !details?.addresses?.length ? <Empty text="Нет сохранённых адресов" /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {details.addresses.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={C}/></svg>
            </div>
            <div style={{ flex: 1 }}>
              {a.label && <span style={{ fontSize: 11, background: `${C}18`, color: CD, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{a.label}</span>}
              <div style={{ fontSize: 14, color: TEXT, marginTop: a.label ? 4 : 0, lineHeight: 1.4 }}>{a.address}</div>
            </div>
          </div>
        ))}
      </div>
    )

    return null
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, padding: 0, paddingBottom: 40 }}>
        <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={st.handle} /></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 24, fontWeight: 800, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(user.name || '?')[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: TEXT }}>{user.name || 'Без имени'}</div>
            {user.phone && <div style={{ fontSize: 14, color: TEXT2, marginTop: 2 }}>{user.phone}</div>}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>ID: {user.telegram_id}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#F2F2F7', color: TEXT2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2.2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0' }}>
          {[
            [(user.balance || 0).toLocaleString(), 'Баланс сум'],
            [Math.round(user.bonus_points || 0), 'Бонусов'],
            [orders.length, 'Заказов'],
          ].map(([v, l]) => (
            <div key={l} style={{ flex: 1, background: '#F8F9FA', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{v}</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', flexWrap: 'wrap' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)', WebkitTapHighlightColor: 'transparent' }} onClick={onTopup}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20M8 15h3m5 0h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Пополнить баланс
          </button>
          {user.phone && (
            <a href={`tel:${user.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
              Позвонить
            </a>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '4px 20px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{ padding: '7px 14px', borderRadius: 999, border: tab === i ? 'none' : `1.5px solid ${BORDER}`, background: tab === i ? GRAD : '#fff', color: tab === i ? '#fff' : TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, WebkitTapHighlightColor: 'transparent', boxShadow: tab === i ? '0 2px 8px rgba(141,198,63,0.3)' : 'none' }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '14px 20px' }}>{renderTab()}</div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ padding: '30px 0', textAlign: 'center', color: TEXT2, fontSize: 14 }}>{text}</div>
}

export default function ManagerClients() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [topupUser, setTopupUser] = useState(null)

  useEffect(() => { getAdminUsers().then(setUsers).catch(console.error).finally(() => setLoading(false)) }, [])

  const filtered = users.filter(u =>
    (u.name?.toLowerCase().includes(search.toLowerCase())) ||
    (u.phone?.includes(search))
  )

  const handleTopupConfirm = async (userId, amount) => {
    await confirmTopup(userId, amount)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: (u.balance || 0) + amount } : u))
  }

  const registered = users.filter(u => u.is_registered).length
  const withBalance = users.filter(u => (u.balance || 0) > 0).length

  return (
    <ManagerLayout title="Клиенты">
      {topupUser && <TopupModal user={topupUser} onClose={() => setTopupUser(null)} onConfirm={(amt) => handleTopupConfirm(topupUser.id, amt)} />}
      {selectedUser && <ClientDetail user={selectedUser} onClose={() => setSelectedUser(null)} onTopup={() => { setTopupUser(selectedUser); setSelectedUser(null) }} />}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[[users.length, 'Всего', C], [registered, 'Зарег.', '#2B8A3E'], [withBalance, 'С балансом', '#E67700']].map(([v, l, c]) => (
          <div key={l} style={{ flex: 1, background: '#fff', borderRadius: 18, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 3, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 18, padding: '11px 14px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={TEXT2} strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: TEXT }} placeholder="Имя или телефон..." value={search} onChange={e => setSearch(e.target.value)} />
        {search
          ? <button style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setSearch('')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/></svg></button>
          : <span style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>{filtered.length}</span>}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 10 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}><circle cx="9" cy="7" r="4" stroke={TEXT} strokeWidth="1.5"/><path d="M3 21C3 18 5.7 16 9 16" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="11" r="3" stroke={TEXT} strokeWidth="1.5"/><path d="M13 21C13 19 14.3 17 16 17C17.7 17 19 19 19 21" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT2 }}>Клиентов не найдено</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setSelectedUser(u)}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(u.name || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Без имени'}</div>
                {u.phone && <div style={{ fontSize: 13, color: TEXT2 }}>{u.phone}</div>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                  {u.is_registered
                    ? <span style={{ fontSize: 11, background: '#EBFBEE', color: '#2B8A3E', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Зарегистрирован</span>
                    : <span style={{ fontSize: 11, background: '#FFF8E6', color: '#E67700', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Не завершил</span>}
                  {(u.balance || 0) > 0 && <span style={{ fontSize: 11, background: '#EBFBEE', color: CD, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{u.balance.toLocaleString()} сум</span>}
                  {(u.bonus_points || 0) > 0 && <span style={{ fontSize: 11, background: '#FFF3BF', color: '#E67700', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{Math.round(u.bonus_points)} бон.</span>}
                </div>
              </div>
              <button style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: C, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }} onClick={e => { e.stopPropagation(); setTopupUser(u) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20M8 15h3m5 0h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)', width: '100%' },
}
