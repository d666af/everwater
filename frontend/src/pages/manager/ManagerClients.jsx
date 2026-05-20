import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminUsers, getUserOrders, getClientDetails, getClientCoolers, addClientCooler, removeClientCooler, addCoolerPayment, broadcastMessage } from '../../api'
import PhonePopup from '../../components/PhonePopup'
import { formatPhone } from '../../utils/phone'
import { useSubscriptionsEnabled } from '../../hooks/useSubscriptionsEnabled'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const STORAGE_KEY = 'crm_client_tags'
const PRESET_TAGS = ['VIP', 'Офис', 'Оптовик', 'Проблемный', 'Корпоратив', 'Друг', 'Оптом']

// filter key → broadcast target key mapping
const FILTER_DEFS = [
  { key: 'all',         label: 'Все',          broadcastKey: 'clients' },
  { key: 'permanent',   label: 'Постоянные',   broadcastKey: 'clients:permanent' },
  { key: 'inactive',    label: 'Не активные',  broadcastKey: 'clients:inactive' },
  { key: 'bonus',       label: 'С бонусами',   broadcastKey: 'clients:bonus' },
  { key: 'bottle_debt', label: 'Должники',     broadcastKey: 'clients:bottle_debt' },
  { key: 'new',         label: 'Новые',        broadcastKey: 'clients:new' },
]

const loadStoredTags = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
const saveStoredTags = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

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
const TABS = ['Инфо', 'Заказы', 'Подписки', 'Адреса', 'Кулеры']

function ClientDetail({ user, onClose, userTags = [], onTagsChange }) {
  const [tab, setTab] = useState(0)
  const [orders, setOrders] = useState([])
  const [details, setDetails] = useState(null)
  const [coolers, setCoolers] = useState([])
  const [loadingO, setLoadingO] = useState(true)
  const [loadingD, setLoadingD] = useState(true)
  const [loadingC, setLoadingC] = useState(true)
  const [showCoolerForm, setShowCoolerForm] = useState(false)
  const [phoneModal, setPhoneModal] = useState(null)
  const subsEnabled = useSubscriptionsEnabled()
  const visibleTabs = TABS.map((label, idx) => ({ label, idx }))
    .filter(t => !(subsEnabled === false && t.label === 'Подписки'))
  useEffect(() => {
    if (subsEnabled === false && TABS[tab] === 'Подписки') setTab(0)
  }, [subsEnabled, tab])

  const handleCoolerPayment = async (coolerId, amount, note) => {
    const updated = await addCoolerPayment(coolerId, { amount, note })
    setCoolers(prev => prev.map(c => c.id === coolerId ? updated : c))
  }

  useEffect(() => {
    getUserOrders(user.id).then(setOrders).catch(() => setOrders([])).finally(() => setLoadingO(false))
    getClientDetails(user.id).then(setDetails).catch(() => setDetails(null)).finally(() => setLoadingD(false))
    getClientCoolers(user.id).then(setCoolers).catch(() => setCoolers([])).finally(() => setLoadingC(false))
  }, [user.id])

  const handleAddCooler = async (data) => {
    try {
      const result = await addClientCooler(user.id, data)
      setCoolers(prev => [...prev, result])
    } catch {
      try {
        const fresh = await getClientCoolers(user.id)
        setCoolers(fresh)
      } catch { /* ignore */ }
    }
    setShowCoolerForm(false)
  }

  const handleRemoveCooler = async (coolerId) => {
    await removeClientCooler(user.id, coolerId)
    setCoolers(prev => prev.filter(c => c.id !== coolerId))
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

  const [customTag, setCustomTag] = useState('')

  const toggleTag = (tag) => {
    const next = userTags.includes(tag) ? userTags.filter(t => t !== tag) : [...userTags, tag]
    onTagsChange?.(next)
  }

  const addCustomTag = () => {
    const t = customTag.trim()
    if (!t || userTags.includes(t)) { setCustomTag(''); return }
    onTagsChange?.([...userTags, t])
    setCustomTag('')
  }

  const renderTab = () => {
    if (tab === 0) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {user.is_registered
            ? <span style={{ fontSize: 12, background: '#EBFBEE', color: '#2B8A3E', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>Зарегистрирован</span>
            : <span style={{ fontSize: 12, background: '#FFF8E6', color: '#E67700', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>Не завершил регистрацию</span>}
        </div>
        {[
          ['Телефон', user.phone ? formatPhone(user.phone) : '—'],
          ['Telegram ID', user.telegram_id || '—'],
          ['Бонусы', `${Math.round(user.bonus_points || 0)}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 14, color: TEXT2 }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{v}</span>
          </div>
        ))}

        {/* Tag management */}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Теги клиента</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
            {PRESET_TAGS.map(tag => {
              const active = userTags.includes(tag)
              return (
                <button key={tag} onClick={() => toggleTag(tag)} style={{
                  padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: active ? `${C}22` : '#F2F2F7',
                  color: active ? CD : TEXT2,
                  outline: active ? `2px solid ${C}66` : 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  {active && '✓ '}{tag}
                </button>
              )
            })}
          </div>
          {userTags.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: `${C}22`, color: CD, marginRight: 6, marginBottom: 6 }}>
              {tag}
              <button onClick={() => toggleTag(tag)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: TEXT2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </span>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              style={{ flex: 1, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#FAFAFA', color: TEXT }}
              placeholder="Свой тег..."
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomTag()}
            />
            <button onClick={addCustomTag} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Добавить
            </button>
          </div>
        </div>
      </div>
    )

    if (tab === 1) return loadingO ? <Spinner /> : orders.length === 0 ? <Empty text="Заказов нет" /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orders.map(o => {
          const ss = STATUS_STYLE[o.status] || { bg: '#F2F2F7', color: TEXT2 }
          const dt = o.created_at ? new Date(new Date(o.created_at).getTime() + 5 * 60 * 60 * 1000) : null
          const dateStr = dt ? dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
          const orderItems = (o.items || []).filter(i => i.quantity > 0)
          return (
            <div key={o.id} style={{ padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: ss.bg, color: ss.color }}>{STATUS_LABELS[o.status] || o.status}</span>
                    {dateStr && <span style={{ fontSize: 11, color: TEXT2 }}>{dateStr}</span>}
                  </div>
                  {o.address && <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>{o.address}</div>}
                  {orderItems.length > 0 && (
                    <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {orderItems.map((it, j) => (
                        <div key={j} style={{ fontSize: 12, color: TEXT, display: 'flex', gap: 6 }}>
                          <span style={{ color: CD, fontWeight: 700 }}>{it.quantity} шт.</span>
                          <span>{it.product_name || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.return_bottles_count > 0 && (
                    <div style={{ fontSize: 12, color: '#12B886', marginTop: 3 }}>↩ Возврат: {o.return_bottles_count} бут.</div>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, flexShrink: 0 }}>{(o.total || 0).toLocaleString()} сум</div>
              </div>
            </div>
          )
        })}
      </div>
    )

    if (tab === 2) return loadingD ? <Spinner /> : !details?.subscriptions?.length ? <Empty text="Нет подписок" /> : (
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

    if (tab === 3) return loadingD ? <Spinner /> : !details?.addresses?.length ? <Empty text="Нет сохранённых адресов" /> : (
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

    if (tab === 4) return loadingC ? <Spinner /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {showCoolerForm && <CoolerForm onCancel={() => setShowCoolerForm(false)} onSave={handleAddCooler} />}

        {!showCoolerForm && (
          <button style={{ padding: '12px 14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 3px 10px rgba(141,198,63,0.3)' }} onClick={() => setShowCoolerForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Добавить кулер с планом
          </button>
        )}

        {/* Cooler list */}
        {coolers.length === 0 ? <Empty text="Нет кулеров" /> : coolers.map(c => <CoolerCard key={c.id} cooler={c} onRemove={() => handleRemoveCooler(c.id)} onPayment={handleCoolerPayment} />)}
      </div>
    )

    return null
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.sheet, padding: 0, paddingBottom: 0 }}>
        {/* Fixed top: handle + user info */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={st.handle} /></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 10px' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 20, fontWeight: 800, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(user.name || '?')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: TEXT }}>{user.name || 'Без имени'}</div>
              {user.phone && <div style={{ fontSize: 13, color: TEXT2, marginTop: 1 }}>{formatPhone(user.phone)}</div>}
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#F2F2F7', color: TEXT2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2.2" strokeLinecap="round"/></svg>
            </button>
          </div>

          {phoneModal && <PhonePopup number={phoneModal.number} label={phoneModal.label} onClose={() => setPhoneModal(null)} />}
          <div style={{ display: 'flex', gap: 6, padding: '0 20px 8px' }}>
            {user.phone && (
              <button onClick={() => setPhoneModal({ number: user.phone, label: user.name })} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="currentColor"/></svg>
                Позвонить
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '0 20px 10px', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: `1px solid ${BORDER}` }}>
            {visibleTabs.map(({ label, idx }) => (
              <button key={label} onClick={() => setTab(idx)} style={{ padding: '6px 12px', borderRadius: 999, border: tab === idx ? `1.5px solid ${C}` : `1.5px solid ${BORDER}`, background: tab === idx ? `${C}15` : '#fff', color: tab === idx ? CD : TEXT2, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 30px' }}>{renderTab()}</div>
      </div>
    </div>
  )
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function CoolerCard({ cooler, onRemove, onPayment }) {
  const [showPayForm, setShowPayForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)

  const fmtMoney = (n) => Number(n || 0).toLocaleString()
  const remaining = cooler.remaining ?? Math.max(0, (cooler.price || 0) - (cooler.total_paid || 0))
  const pct = cooler.price > 0 ? Math.min(100, Math.round(((cooler.total_paid || 0) / cooler.price) * 100)) : 0

  const handlePay = async () => {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) return
    setPaying(true)
    try {
      await onPayment(cooler.id, amt, payNote.trim() || null)
      setPayAmount(''); setPayNote(''); setShowPayForm(false)
    } catch { alert('Ошибка при погашении') }
    finally { setPaying(false) }
  }

  return (
    <div style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: '#E8F4FD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="6" y="2" width="12" height="20" rx="2" stroke="#1971C2" strokeWidth="1.5"/><circle cx="12" cy="8" r="2" stroke="#1971C2" strokeWidth="1.5"/><path d="M9 14h6" stroke="#1971C2" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{cooler.name}</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>Цена: {fmtMoney(cooler.price)} сум</div>
        </div>
        <button style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(224,49,49,0.3)', background: '#FFF5F5', color: '#E03131', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} onClick={onRemove}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Debt progress */}
      {cooler.price > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: TEXT2 }}>Оплачено</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: remaining === 0 ? '#2B8A3E' : '#E03131' }}>
              Остаток: {fmtMoney(remaining)} сум
            </span>
          </div>
          <div style={{ height: 6, background: '#F2F2F7', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: remaining === 0 ? '#2B8A3E' : `linear-gradient(90deg, ${C}, ${CD})`, borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: TEXT2 }}>{fmtMoney(cooler.total_paid)} сум уплачено</span>
            <span style={{ fontSize: 11, color: TEXT2 }}>{pct}%</span>
          </div>
        </div>
      )}

      {/* Pay form */}
      {showPayForm ? (
        <div style={{ background: '#fff', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${BORDER}` }}>
          <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '9px 12px', fontSize: 15, fontWeight: 700, outline: 'none', background: '#FAFAFA', color: TEXT, boxSizing: 'border-box' }} type="number" inputMode="numeric" placeholder="Сумма погашения" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
          <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#FAFAFA', color: TEXT, boxSizing: 'border-box' }} placeholder="Примечание (необязательно)" value={payNote} onChange={e => setPayNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowPayForm(false)}>Отмена</button>
            <button style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: payAmount && Number(payAmount) > 0 ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: payAmount && Number(payAmount) > 0 ? '#fff' : TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }} disabled={!payAmount || Number(payAmount) <= 0 || paying} onClick={handlePay}>
              {paying ? 'Сохраняю...' : 'Погасить'}
            </button>
          </div>
        </div>
      ) : (
        <button style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C}`, background: `${C}12`, color: CD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => setShowPayForm(true)}>
          Погашение долга
        </button>
      )}

      {/* Payment history */}
      {(cooler.payments || []).length > 0 && (
        <div>
          <button onClick={() => setShowHistory(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: TEXT2, fontSize: 12, fontWeight: 600, padding: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            История погашений ({cooler.payments.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[...(cooler.payments || [])].reverse().map((p, i, arr) => {
                const dt = new Date(p.created_at)
                const dateStr = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#2B8A3E' }}>+{fmtMoney(p.amount)} сум</div>
                      {p.note && <div style={{ fontSize: 11, color: TEXT2 }}>{p.note}</div>}
                      <div style={{ fontSize: 11, color: TEXT2 }}>{dateStr}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CoolerForm({ onCancel, onSave }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)

  const canSave = name.trim() && Number(price) >= 0

  const handle = async () => {
    if (!canSave) return
    setLoading(true)
    try {
      await onSave({ name: name.trim(), price: Number(price) || 0 })
    } catch { alert('Ошибка'); setLoading(false) }
  }

  return (
    <div style={{ background: '#F8F9FA', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Новый кулер</div>
      <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, outline: 'none', background: '#fff', color: TEXT, boxSizing: 'border-box' }} placeholder="Название кулера *" value={name} onChange={e => setName(e.target.value)} />
      <input style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, outline: 'none', background: '#fff', color: TEXT, boxSizing: 'border-box' }} type="number" inputMode="numeric" placeholder="Цена кулера (сум)" value={price} onChange={e => setPrice(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={onCancel}>Отмена</button>
        <button style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: canSave ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: canSave ? '#fff' : TEXT2, fontSize: 14, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed' }} disabled={!canSave || loading} onClick={handle}>
          {loading ? 'Сохраняю...' : 'Сохранить'}
        </button>
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

export default function ManagerClients({ Layout = ManagerLayout, title = 'Клиенты' }) {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [phoneModal, setPhoneModal] = useState(null)
  const [clientTags, setClientTags] = useState(() => loadStoredTags())
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const setUserTags = (userId, tags) => {
    const next = { ...clientTags, [userId]: tags }
    setClientTags(next)
    saveStoredTags(next)
  }

  // All unique custom tags across all clients
  const allCustomTags = [...new Set(Object.values(clientTags).flat())]

  const matchesFilter = (u) => {
    if (labelFilter === 'all') return true
    if (labelFilter === 'permanent') return u.customer_label === 'permanent'
    if (labelFilter === 'inactive') return u.customer_label === 'inactive'
    if (labelFilter === 'bonus') return (u.bonus_points || 0) > 0
    if (labelFilter === 'bottle_debt') return (u.bottles_owed || 0) > 0
    if (labelFilter === 'new') return !u.customer_label && (u.orders_count || 0) > 0 && (u.orders_count || 0) <= 2
    if (labelFilter.startsWith('tag:')) return (clientTags[u.id] || []).includes(labelFilter.slice(4))
    return true
  }

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return
    setSending(true)
    try {
      const sysDef = FILTER_DEFS.find(f => f.key === labelFilter)
      if (sysDef) {
        await broadcastMessage(broadcastText, sysDef.broadcastKey)
      } else if (labelFilter.startsWith('tag:')) {
        // Custom tag: send to filtered user IDs
        const userIds = filtered.filter(u => u.id).map(u => u.id)
        await broadcastMessage(broadcastText, 'clients', userIds)
      } else {
        await broadcastMessage(broadcastText, 'clients')
      }
      setSent(true); setBroadcastText('')
      setTimeout(() => { setSent(false); setShowBroadcast(false) }, 2000)
    } catch { alert('Ошибка при отправке') } finally { setSending(false) }
  }

  useEffect(() => { getAdminUsers().then(setUsers).catch(console.error).finally(() => setLoading(false)) }, [])

  const filtered = users.filter(u => {
    const matchText = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search)
    return matchText && matchesFilter(u)
  })

  return (
    <Layout title={title}>
      {phoneModal && <PhonePopup number={phoneModal.number} label={phoneModal.label} onClose={() => setPhoneModal(null)} />}
      {selectedUser && <ClientDetail user={selectedUser} onClose={() => setSelectedUser(null)} userTags={clientTags[selectedUser.id] || []} onTagsChange={(tags) => setUserTags(selectedUser.id, tags)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 18, padding: '11px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={TEXT2} strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke={TEXT2} strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent', color: TEXT }} placeholder="Имя или телефон..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => setSearch('')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2" strokeLinecap="round"/></svg></button>}
      </div>

      {/* Unified filter + broadcast tag row */}
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4, minWidth: 'max-content' }}>
          {FILTER_DEFS.map(f => (
            <button key={f.key} onClick={() => setLabelFilter(f.key)} style={{
              padding: '6px 13px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, WebkitTapHighlightColor: 'transparent', flexShrink: 0,
              background: labelFilter === f.key ? (f.key === 'permanent' ? '#EBFBEE' : f.key === 'inactive' ? '#F1F3F5' : `${C}22`) : '#fff',
              color: labelFilter === f.key ? (f.key === 'permanent' ? '#2B8A3E' : f.key === 'inactive' ? '#868E96' : CD) : TEXT2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>{f.label}</button>
          ))}
          {allCustomTags.map(tag => (
            <button key={`tag:${tag}`} onClick={() => setLabelFilter(`tag:${tag}`)} style={{
              padding: '6px 13px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, WebkitTapHighlightColor: 'transparent', flexShrink: 0,
              background: labelFilter === `tag:${tag}` ? `${C}22` : '#fff',
              color: labelFilter === `tag:${tag}` ? CD : TEXT2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>{tag}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, paddingLeft: 4, marginBottom: 8 }}>
        Клиентов: <b style={{ color: TEXT }}>{filtered.length}</b>
      </div>

      {/* Broadcast — uses current filter as target */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 14px', borderRadius: 12, marginBottom: showBroadcast ? 0 : 10,
          background: showBroadcast ? `${C}18` : '#fff',
          border: showBroadcast ? `1.5px solid ${C}55` : '1.5px solid rgba(60,60,67,0.08)',
          color: showBroadcast ? CD : TEXT2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          WebkitTapHighlightColor: 'transparent',
        }}
        onClick={() => setShowBroadcast(v => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Рассылка: <span style={{ fontWeight: 800 }}>{
          (FILTER_DEFS.find(f => f.key === labelFilter)?.label) ||
          (labelFilter.startsWith('tag:') ? labelFilter.slice(4) : 'Все')
        }</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, background: `${C}22`, color: CD, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{filtered.length}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: showBroadcast ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {showBroadcast && (
        <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: 14, marginBottom: 10, border: '1.5px solid rgba(60,60,67,0.08)', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: TEXT2 }}>
            Получат: <b style={{ color: TEXT }}>{filtered.filter(u => u.telegram_id).length}</b> клиентов с Telegram
          </div>
          <textarea
            style={{ border: `1.5px solid rgba(60,60,67,0.12)`, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'vertical', background: '#FAFAFA', color: TEXT, fontFamily: 'inherit', minHeight: 70 }}
            rows={3}
            placeholder="Введите сообщение..."
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
          />
          {sent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2B8A3E', fontSize: 13, fontWeight: 600, background: '#EBFBEE', padding: '8px 12px', borderRadius: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="#2B8A3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Отправлено!
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={{ padding: '9px 16px', border: '1.5px solid rgba(60,60,67,0.12)', borderRadius: 10, background: '#fff', color: TEXT2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowBroadcast(false)}>Отмена</button>
            <button
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: !broadcastText.trim() || sending ? '#E0E0E5' : `linear-gradient(135deg, ${C}, ${CD})`, color: !broadcastText.trim() || sending ? TEXT2 : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: broadcastText.trim() ? '0 3px 10px rgba(141,198,63,0.3)' : 'none' }}
              onClick={sendBroadcast}
              disabled={!broadcastText.trim() || sending}
            >
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 10 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}><circle cx="9" cy="7" r="4" stroke={TEXT} strokeWidth="1.5"/><path d="M3 21C3 18 5.7 16 9 16" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="11" r="3" stroke={TEXT} strokeWidth="1.5"/><path d="M13 21C13 19 14.3 17 16 17C17.7 17 19 19 19 21" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT2 }}>Клиентов не найдено</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const tags = clientTags[u.id] || []
            const isNew = !u.customer_label && (u.orders_count || 0) > 0 && (u.orders_count || 0) <= 2
            return (
              <div key={u.id} style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: `1px solid ${BORDER}`, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setSelectedUser(u)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(u.name || '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Без имени'}</span>
                      {u.customer_label === 'permanent' && (
                        <span style={{ fontSize: 10, color: '#2B8A3E', background: '#EBFBEE', padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>★ Пост.</span>
                      )}
                      {u.customer_label === 'inactive' && (
                        <span style={{ fontSize: 10, color: '#868E96', background: '#F1F3F5', padding: '1px 7px', borderRadius: 999, fontWeight: 600, flexShrink: 0 }}>Не актив.</span>
                      )}
                      {isNew && (
                        <span style={{ fontSize: 10, color: '#1971C2', background: '#E8F4FD', padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>Новый</span>
                      )}
                      {!u.is_registered && (
                        <span style={{ fontSize: 10, color: '#E67700', background: '#FFF8E6', padding: '1px 7px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>Не регистр.</span>
                      )}
                    </div>
                    {u.phone && <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{formatPhone(u.phone)}</div>}
                  </div>
                  <button style={{ padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${C}`, background: `${C}15`, color: CD, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }} onClick={e => { e.stopPropagation(); setSelectedUser(u) }}>
                    Инфо
                  </button>
                </div>

                {/* Stat cards */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <div style={{ flex: 1, background: '#F8F9FA', borderRadius: 10, padding: '6px 8px', textAlign: 'center', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{u.orders_count || 0}</div>
                    <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>Заказов</div>
                  </div>
                  <div style={{ flex: 1, background: (u.bonus_points || 0) > 0 ? '#FFFBEE' : '#F8F9FA', borderRadius: 10, padding: '6px 8px', textAlign: 'center', border: `1px solid ${(u.bonus_points || 0) > 0 ? 'rgba(230,119,0,0.18)' : BORDER}` }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: (u.bonus_points || 0) > 0 ? '#E67700' : TEXT2, lineHeight: 1 }}>{Math.round(u.bonus_points || 0)}</div>
                    <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>Бонусы</div>
                  </div>
                  <div style={{ flex: 1, background: (u.bottles_owed || 0) > 0 ? '#FFF5F5' : '#F8F9FA', borderRadius: 10, padding: '6px 8px', textAlign: 'center', border: `1px solid ${(u.bottles_owed || 0) > 0 ? 'rgba(201,42,42,0.2)' : BORDER}` }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: (u.bottles_owed || 0) > 0 ? '#C92A2A' : TEXT2, lineHeight: 1 }}>{u.bottles_owed || 0}</div>
                    <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>Долг бут.</div>
                  </div>
                </div>

                {/* Custom tags */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: `${C}18`, color: CD }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '95vh', overflow: 'hidden', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 0, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)', width: '100%' },
}
