import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers, createCourier, deleteCourier, getOrders, getCourierDetails, getAllCashDebts, approveDebtClearance, rejectDebtClearance } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

function AddCourierModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tgId, setTgId] = useState('')
  const [loading, setLoading] = useState(false)
  const handle = async () => {
    if (!name.trim() || !tgId.trim()) return
    setLoading(true)
    try { await onSave({ name: name.trim(), phone: phone.trim(), telegram_id: Number(tgId) }); onClose() }
    catch { alert('Ошибка при создании') }
    finally { setLoading(false) }
  }
  const dis = !name.trim() || !tgId.trim()
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Добавить курьера</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={st.label}>Имя *</div>
          <input style={st.input} placeholder="Имя курьера" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={st.label}>Телефон</div>
          <input style={st.input} placeholder="+998 90 000-00-00" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={st.label}>Telegram ID *</div>
          <input style={st.input} placeholder="Числовой ID" value={tgId} onChange={e => setTgId(e.target.value)} inputMode="numeric" />
          <div style={{ fontSize: 12, color: TEXT2 }}>Клиент должен написать боту /start чтобы получить ID</div>
        </div>
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' } : {}) }} disabled={dis || loading} onClick={handle}>
          {loading ? 'Создаю...' : 'Добавить курьера'}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function CourierCard({ courier: c, allOrders, debts, onDeactivate, onActivate, onDebtAction }) {
  const [expanded, setExpanded] = useState(false)
  const [details, setDetails] = useState(null)
  const [loadingD, setLoadingD] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const myActiveOrders = allOrders.filter(o => o.courier_id === c.id && ['assigned_to_courier', 'in_delivery'].includes(o.status))
  const myDebts = debts.filter(d => d.courier_id === c.id && d.clearance_status !== 'approved')
  const totalDebt = myDebts.reduce((s, d) => s + (d.amount || 0), 0)
  const pendingRequests = myDebts.filter(d => d.clearance_status === 'pending')

  const toggleExpand = () => {
    if (!expanded && !details) {
      setLoadingD(true)
      getCourierDetails(c.id).then(setDetails).catch(() => {}).finally(() => setLoadingD(false))
    }
    setExpanded(e => !e)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', opacity: c.is_active ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={toggleExpand}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: c.is_active ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{c.name}</div>
          {c.phone && <div style={{ fontSize: 13, color: TEXT2 }}>{c.phone}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ fontSize: 11, background: '#F0FFF4', color: CD, padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>
              {c.delivery_count || 0} доставок
            </span>
            {myActiveOrders.length > 0 && (
              <span style={{ fontSize: 11, background: `${C}15`, color: CD, padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>
                {myActiveOrders.length} в работе
              </span>
            )}
            {totalDebt > 0 && (
              <span style={{ fontSize: 11, background: '#FFF5F5', color: '#E03131', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>
                Долг: {totalDebt.toLocaleString()} сум
              </span>
            )}
            {pendingRequests.length > 0 && (
              <span style={{ fontSize: 11, background: '#FFF8E6', color: '#E67700', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}>
                {pendingRequests.length} запрос
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {c.phone && (
            <a href={`tel:${c.phone}`} style={{ width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#F0FFF4', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill={C}/></svg>
            </a>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}><path d="M6 9l6 6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingD ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : details ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  [details.total_deliveries || 0, 'Всего доставок'],
                  [details.today_deliveries || 0, 'Сегодня'],
                  [myActiveOrders.length, 'Осталось'],
                ].map(([v, l]) => (
                  <div key={l} style={{ flex: 1, background: '#F8F9FA', borderRadius: 12, padding: '10px 8px', textAlign: 'center', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{v}</div>
                    <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>

              {details.recent_deliveries?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Последние доставки</div>
                  {details.recent_deliveries.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: TEXT }}>#{d.order_id}</span>
                      <span style={{ color: TEXT2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.address}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {myActiveOrders.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Текущие заказы</div>
              {myActiveOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, paddingBottom: 5 }}>
                  <span style={{ fontWeight: 700, color: TEXT }}>#{o.id}</span>
                  <span style={{ color: TEXT2, flex: 1, marginLeft: 8 }}>{o.address}</span>
                  <span style={{ fontSize: 12, color: TEXT2 }}>{(o.total || 0).toLocaleString()} сум</span>
                </div>
              ))}
            </div>
          )}

          {/* Cash debt */}
          {myDebts.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Наличные · долг {totalDebt.toLocaleString()} сум</div>
              {myDebts.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: TEXT }}>#{d.order_id}</span>
                  <span style={{ color: TEXT2, flex: 1 }}>{(d.amount || 0).toLocaleString()} сум</span>
                  {d.clearance_status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => onDebtAction('approve', d.id)}>Принять</button>
                      <button style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(224,49,49,0.3)', background: '#fff', color: '#E03131', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => onDebtAction('reject', d.id)}>Отклонить</button>
                    </div>
                  ) : d.clearance_status === 'approved' ? (
                    <span style={{ fontSize: 11, color: '#2B8A3E', fontWeight: 700 }}>Погашен</span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#E03131', fontWeight: 700 }}>Не погашен</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
            {c.is_active ? (
              !confirming ? (
                <button style={{ background: 'none', border: '1.5px solid rgba(224,49,49,0.4)', color: '#E03131', padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => setConfirming(true)}>Деактивировать</button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#E03131', flex: 1 }}>Деактивировать {c.name}?</span>
                  <button style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#E03131', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => { onDeactivate(c.id); setConfirming(false) }}>Да</button>
                  <button style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 13, cursor: 'pointer' }} onClick={() => setConfirming(false)}>Нет</button>
                </div>
              )
            ) : (
              <button style={{ background: 'none', border: `1.5px solid ${C}`, color: CD, padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} onClick={() => onActivate(c.id)}>
                Активировать
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ManagerCouriers({ Layout = ManagerLayout, title = 'Курьеры' }) {
  const [couriers, setCouriers] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getAdminCouriers(), getOrders(), getAllCashDebts()])
      .then(([c, o, d]) => { setCouriers(c); setAllOrders(o); setDebts(d) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (data) => { await createCourier(data); load() }
  const handleDeactivate = async (id) => { await deleteCourier(id); load() }
  const handleActivate = async (id) => {
    setCouriers(prev => prev.map(c => c.id === id ? { ...c, is_active: true } : c))
  }
  const handleDebtAction = async (action, debtId) => {
    try {
      if (action === 'approve') await approveDebtClearance(debtId)
      else await rejectDebtClearance(debtId)
      load()
    } catch { alert('Ошибка') }
  }

  const active = couriers.filter(c => c.is_active)
  const deactivated = couriers.filter(c => !c.is_active)
  const inDeliveryOrders = allOrders.filter(o => ['assigned_to_courier', 'in_delivery'].includes(o.status))

  return (
    <Layout title={title}>
      {showAdd && <AddCourierModal onClose={() => setShowAdd(false)} onSave={handleCreate} />}

      {/* Stats — full width */}
      {(() => {
        const totalDebtAll = debts.filter(d => d.clearance_status !== 'approved').reduce((s, d) => s + (d.amount || 0), 0)
        const pendingCount = debts.filter(d => d.clearance_status === 'pending').length
        return (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[[couriers.length, 'Курьеров'], [inDeliveryOrders.length, 'В пути'], [active.length, 'Активных'],
              [totalDebtAll > 0 ? `${Math.round(totalDebtAll / 1000)}к` : '0', 'Долг (сум)', totalDebtAll > 0 ? '#E03131' : undefined]
            ].map(([v, l, clr]) => (
              <div key={l} style={{ flex: 1, minWidth: 70, background: '#fff', borderRadius: 18, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: clr || TEXT }}>{v}</div>
                <div style={{ fontSize: 10, color: TEXT2, marginTop: 3, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
            {pendingCount > 0 && (
              <div style={{ flex: 1, minWidth: 70, background: '#FFF8E6', borderRadius: 18, padding: '14px 10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: '#E67700' }}>{pendingCount}</div>
                <div style={{ fontSize: 10, color: '#E67700', marginTop: 3, fontWeight: 500 }}>Запросов</div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Add button — under stats */}
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 15, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)', WebkitTapHighlightColor: 'transparent',
        marginBottom: 20,
      }} onClick={() => setShowAdd(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        Добавить курьера
      </button>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 14 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}><circle cx="12" cy="8" r="4" stroke={TEXT} strokeWidth="1.5"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT2 }}>Курьеров пока нет</div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 6px' }}>Активные · {active.length}</div>
              {active.map(c => <CourierCard key={c.id} courier={c} allOrders={allOrders} debts={debts} onDeactivate={handleDeactivate} onActivate={handleActivate} onDebtAction={handleDebtAction} />)}
            </div>
          )}
          {deactivated.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 0 6px' }}>Деактивированные · {deactivated.length}</div>
              {deactivated.map(c => <CourierCard key={c.id} courier={c} allOrders={[]} debts={[]} onDeactivate={handleDeactivate} onActivate={handleActivate} onDebtAction={handleDebtAction} />)}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  label: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { border: `1.5px solid ${BORDER}`, borderRadius: 14, padding: '13px 15px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: 16, borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
}
