import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers, createCourier, deleteCourier, getCourierDetails, getAgents, createAgent, deleteAgent, getAgentOrders, broadcastMessage } from '../../api'
import CourierReportModal from '../../components/CourierReportModal'
import AgentReportModal from '../../components/AgentReportModal'
import { formatPhone } from '../../utils/phone'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

function AddCourierModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tgId, setTgId] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [loading, setLoading] = useState(false)
  const handle = async () => {
    if (!name.trim() || !phone.trim() || !tgId.trim()) return
    setLoading(true)
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        telegram_id: Number(tgId),
        vehicle_type: vehicleType.trim() || undefined,
        vehicle_plate: vehiclePlate.trim() || undefined,
      })
      onClose()
    } catch { alert('Ошибка при создании') }
    finally { setLoading(false) }
  }
  const dis = !name.trim() || !phone.trim() || !tgId.trim()
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Добавить курьера</div>
        {[
          ['Имя *', 'Имя курьера', name, setName, 'text'],
          ['Телефон *', '+998 90 000-00-00', phone, setPhone, 'tel'],
          ['Telegram ID *', 'Числовой ID', tgId, setTgId, 'numeric'],
          ['Тип авто', 'Мотоцикл / Авто / Велосипед', vehicleType, setVehicleType, 'text'],
          ['Номер авто', 'A 000 AA', vehiclePlate, setVehiclePlate, 'text'],
        ].map(([label, placeholder, value, setter, mode]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={st.label}>{label}</div>
            <input style={st.input} placeholder={placeholder} value={value}
              onChange={e => setter(e.target.value)} inputMode={mode} />
          </div>
        ))}
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' } : {}) }}
          disabled={dis || loading} onClick={handle}>
          {loading ? 'Создаю...' : 'Добавить курьера'}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function StatChip({ icon, value, label, color = CD, bg = '#F0FFF4', borderColor }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      background: bg, borderRadius: 12, padding: '10px 6px',
      border: `1px solid ${borderColor || 'transparent'}`,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

function CourierCard({ courier: c, onDelete }) {
  const [details, setDetails] = useState(null)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    getCourierDetails(c.id).then(setDetails).catch(() => {})
  }, [c.id])

  const rating = details?.avg_rating > 0 ? Number(details.avg_rating).toFixed(1) : '—'
  const totalDeliveries = details?.total_deliveries ?? (c.delivery_count ?? '—')
  const bottleDebt = details ? (details.bottles_must_return ?? 0) : null

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${BORDER}`, opacity: c.is_active ? 1 : 0.6 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: c.is_active ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{c.name}</div>
          {c.phone && <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>{formatPhone(c.phone)}</div>}
        </div>
        <button
          style={{
            height: 34, padding: '0 12px', borderRadius: 10, flexShrink: 0,
            border: `1.5px solid ${C}`, background: '#F0FFF4', color: CD,
            display: 'flex', alignItems: 'center', gap: 5,
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}
          onClick={() => setShowReport(true)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M18 20V10M12 20V4M6 20v-6" stroke={CD} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Отчёт
        </button>
      </div>

      {/* Stat chips row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
        <StatChip icon="📦" value={totalDeliveries} label="Доставок" color={CD} bg="#F0FFF4" borderColor="rgba(141,198,63,0.18)" />
        <StatChip icon="⭐" value={rating} label="Рейтинг" color="#E67700" bg="#FFFBEE" borderColor="rgba(230,119,0,0.18)" />
        {bottleDebt !== null && (
          <StatChip
            icon="🫙"
            value={bottleDebt}
            label="Долг бут."
            color={bottleDebt > 0 ? '#E03131' : CD}
            bg={bottleDebt > 0 ? '#FFF5F5' : '#F0FFF4'}
            borderColor={bottleDebt > 0 ? 'rgba(224,49,49,0.2)' : 'rgba(141,198,63,0.18)'}
          />
        )}
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          style={{ width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(224,49,49,0.3)', borderRadius: 10, background: '#FFF5F5', color: '#E03131', cursor: 'pointer' }}
          onClick={() => onDelete(c)} title="Удалить курьера">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {showReport && <CourierReportModal courierId={c.id} courierName={c.name} onClose={() => setShowReport(false)} />}
    </div>
  )
}

function AddAgentModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const handle = async () => {
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    try {
      await onSave({ name: name.trim(), phone: phone.trim() })
      onClose()
    } catch { alert('Ошибка при создании') }
    finally { setLoading(false) }
  }
  const dis = !name.trim() || !phone.trim()
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={st.sheet}>
        <div style={st.handle} />
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Добавить агента</div>
        {[
          ['Имя *', 'Имя агента', name, setName, 'text'],
          ['Телефон *', '+998 90 000-00-00', phone, setPhone, 'tel'],
        ].map(([label, placeholder, value, setter, mode]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={st.label}>{label}</div>
            <input style={st.input} placeholder={placeholder} value={value}
              onChange={e => setter(e.target.value)} inputMode={mode} />
          </div>
        ))}
        <div style={{ fontSize: 12, color: TEXT2, background: '#F8F9FA', borderRadius: 10, padding: '8px 12px' }}>
          Агент привяжет Telegram сам при первом запуске бота
        </div>
        <button style={{ ...st.primaryBtn, ...(dis ? { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' } : {}) }}
          disabled={dis || loading} onClick={handle}>
          {loading ? 'Создаю...' : 'Добавить агента'}
        </button>
        <button style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function AgentCard({ agent: a, onDelete }) {
  const [showReport, setShowReport] = useState(false)
  const [orderCount, setOrderCount] = useState(null)

  useEffect(() => {
    getAgentOrders(a.id).then(r => setOrderCount((r || []).length)).catch(() => {})
  }, [a.id])

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${BORDER}`, opacity: a.is_active ? 1 : 0.6 }}>
      {showReport && <AgentReportModal agentId={a.id} agentName={a.name} onClose={() => setShowReport(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: a.is_active ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(a.name || 'А')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{a.name}</div>
          {a.phone && <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>{formatPhone(a.phone)}</div>}
          <div style={{ marginTop: 4 }}>
            {a.telegram_id ? (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#EBFBEE', color: '#2B8A3E', fontWeight: 600 }}>Telegram привязан</span>
            ) : (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#FFF3BF', color: '#E67700', fontWeight: 600 }}>Telegram не привязан</span>
            )}
          </div>
        </div>
        <button
          style={{ height: 34, padding: '0 12px', borderRadius: 10, flexShrink: 0, border: `1.5px solid ${C}`, background: '#F0FFF4', color: CD, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          onClick={() => setShowReport(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M18 20V10M12 20V4M6 20v-6" stroke={CD} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Отчёт
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: '#F0FFF4', border: '1px solid rgba(141,198,63,0.18)', flex: 1 }}>
          <span style={{ fontSize: 16 }}>📦</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: CD, lineHeight: 1 }}>{orderCount ?? '—'}</div>
            <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600 }}>Заказов</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          style={{ width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(224,49,49,0.3)', borderRadius: 10, background: '#FFF5F5', color: '#E03131', cursor: 'pointer' }}
          onClick={() => onDelete(a)} title="Удалить агента">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function AgentsList() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    getAgents().then(data => setAgents(data || [])).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleCreate = async (data) => { await createAgent(data); load() }
  const handleDelete = async (agent) => {
    if (!window.confirm(`Удалить агента ${agent.name}? Это действие нельзя отменить.`)) return
    try { await deleteAgent(agent.id); load() } catch { alert('Ошибка при удалении') }
  }

  return (
    <div>
      {showAdd && <AddAgentModal onClose={() => setShowAdd(false)} onSave={handleCreate} />}
      <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(141,198,63,0.3)', marginBottom: 20 }}
        onClick={() => setShowAdd(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        Добавить агента
      </button>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : agents.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT2 }}>Агентов пока нет</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agents.map(a => <AgentCard key={a.id} agent={a} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  )
}

export default function ManagerCouriers({ Layout = ManagerLayout, title = 'Курьеры' }) {
  const [tab, setTab] = useState('couriers')
  const [couriers, setCouriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastTarget, setBroadcastTarget] = useState('couriers')
  const [broadcastText, setBroadcastText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const load = () => {
    setLoading(true)
    getAdminCouriers()
      .then(data => setCouriers(data || []))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (data) => { await createCourier(data); load() }
  const handleDelete = async (courier) => {
    if (!window.confirm(`Удалить курьера ${courier.name}? Это действие нельзя отменить.`)) return
    try { await deleteCourier(courier.id); load() } catch { alert('Ошибка при удалении') }
  }

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return
    setSending(true)
    try {
      await broadcastMessage(broadcastText, broadcastTarget)
      setSent(true); setBroadcastText('')
      setTimeout(() => { setSent(false); setShowBroadcast(false) }, 2000)
    } catch { alert('Ошибка при отправке') } finally { setSending(false) }
  }

  const BROADCAST_TARGETS = [
    { key: 'couriers',           label: 'Курьерам' },
    { key: 'agents',             label: 'Агентам' },
    { key: 'couriers_and_agents',label: 'Всем' },
  ]

  return (
    <Layout title={title}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      {showAdd && <AddCourierModal onClose={() => setShowAdd(false)} onSave={handleCreate} />}

      {/* Broadcast panel */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 14px', borderRadius: 12, marginBottom: showBroadcast ? 0 : 12,
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
        Рассылка
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showBroadcast ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {showBroadcast && (
        <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: 14, marginBottom: 12, border: '1.5px solid rgba(60,60,67,0.08)', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {BROADCAST_TARGETS.map(t => (
              <button key={t.key} onClick={() => setBroadcastTarget(t.key)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, WebkitTapHighlightColor: 'transparent',
                background: broadcastTarget === t.key ? `${C}22` : '#F2F2F7',
                color: broadcastTarget === t.key ? CD : TEXT2,
                outline: broadcastTarget === t.key ? `2px solid ${C}66` : 'none',
              }}>{t.label}</button>
            ))}
          </div>
          <textarea
            style={{ border: '1.5px solid rgba(60,60,67,0.12)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', resize: 'vertical', background: '#FAFAFA', color: TEXT, fontFamily: 'inherit', minHeight: 70 }}
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
              style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: !broadcastText.trim() || sending ? '#E0E0E5' : `linear-gradient(135deg, ${C}, ${CD})`, color: !broadcastText.trim() || sending ? TEXT2 : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={sendBroadcast}
              disabled={!broadcastText.trim() || sending}
            >{sending ? 'Отправка...' : 'Отправить'}</button>
          </div>
        </div>
      )}

      {/* Курьеры / Агенты toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#F2F2F7', borderRadius: 14, padding: 4 }}>
        {[{ key: 'couriers', label: 'Курьеры' }, { key: 'agents', label: 'Агенты' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            background: tab === t.key ? `linear-gradient(135deg, ${C}, ${CD})` : 'transparent',
            color: tab === t.key ? '#fff' : '#8E8E93',
            transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'agents' && <AgentsList />}

      {tab === 'couriers' && <>
      <button style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '12px 14px', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(141,198,63,0.3)',
        WebkitTapHighlightColor: 'transparent', marginBottom: 20,
      }} onClick={() => setShowAdd(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        Добавить курьера
      </button>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : couriers.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 14 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}>
            <circle cx="12" cy="8" r="4" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT2 }}>Курьеров пока нет</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {couriers.map(c => (
            <CourierCard key={c.id} courier={c} onDelete={handleDelete} />
          ))}
        </div>
      )}
      </>}
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
