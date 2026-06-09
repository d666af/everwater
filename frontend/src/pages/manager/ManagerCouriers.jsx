import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers, createCourier, deleteCourier, getCourierDetails, getAgents, createAgent, deleteAgent, getAgentOrders, broadcastMessage, adjustCourierDebt, adjustCourierSold, getAgentBalance, createAgentPayout, getAgentPayouts } from '../../api'
import { useAuthStore } from '../../store/auth'
import CourierReportModal from '../../components/CourierReportModal'
import AgentReportModal from '../../components/AgentReportModal'
import { formatPhone } from '../../utils/phone'
import WarehouseCouriers from '../warehouse/WarehouseCouriers'

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
  const { user: currentUser } = useAuthStore()
  const [details, setDetails] = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [debtAdjModal, setDebtAdjModal] = useState(false)
  const [soldAdjModal, setSoldAdjModal] = useState(false)

  const refreshDetails = () => getCourierDetails(c.id).then(setDetails).catch(() => {})

  useEffect(() => {
    refreshDetails()
  }, [c.id]) // eslint-disable-line

  const rating = details?.avg_rating > 0 ? Number(details.avg_rating).toFixed(1) : '—'
  const totalDeliveries = details?.total_deliveries ?? (c.delivery_count ?? '—')
  const bottleDebt = details ? (details.bottles_must_return ?? 0) : null
  const bottlesSold = details ? (details.bottles_sold ?? 0) : null

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
          <div onClick={() => setDebtAdjModal(true)} style={{ cursor: 'pointer', position: 'relative' }}>
            <StatChip
              icon="🫙"
              value={bottleDebt}
              label="Долг бут."
              color={bottleDebt > 0 ? '#E03131' : CD}
              bg={bottleDebt > 0 ? '#FFF5F5' : '#F0FFF4'}
              borderColor={bottleDebt > 0 ? 'rgba(224,49,49,0.2)' : 'rgba(141,198,63,0.18)'}
            />
            <div style={{ position: 'absolute', top: 3, right: 5, fontSize: 11, color: '#0077B6', fontWeight: 800 }}>±</div>
          </div>
        )}
        {bottlesSold !== null && (
          <div onClick={() => setSoldAdjModal(true)} style={{ cursor: 'pointer', position: 'relative' }}>
            <StatChip
              icon="💰"
              value={bottlesSold}
              label="Продано"
              color={bottlesSold > 0 ? '#0077B6' : CD}
              bg={bottlesSold > 0 ? '#E7F5FF' : '#F0FFF4'}
              borderColor={bottlesSold > 0 ? 'rgba(0,119,182,0.2)' : 'rgba(141,198,63,0.18)'}
            />
            <div style={{ position: 'absolute', top: 3, right: 5, fontSize: 11, color: '#0077B6', fontWeight: 800 }}>±</div>
          </div>
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
      {debtAdjModal && (
        <CourierDebtAdjModal
          courierName={c.name}
          currentDebt={bottleDebt || 0}
          onClose={() => setDebtAdjModal(false)}
          onSave={async (delta, note) => {
            await adjustCourierDebt(c.id, delta, note, currentUser?.name || null, currentUser?.role || null)
            setDebtAdjModal(false)
            refreshDetails()
          }}
        />
      )}
      {soldAdjModal && (
        <CourierSoldAdjModal
          courierName={c.name}
          currentSold={bottlesSold || 0}
          onClose={() => setSoldAdjModal(false)}
          onSave={async (delta, note) => {
            await adjustCourierSold(c.id, delta, note, currentUser?.name || null, currentUser?.role || null)
            setSoldAdjModal(false)
            refreshDetails()
          }}
        />
      )}
    </div>
  )
}

function CourierSoldAdjModal({ courierName, currentSold, onClose, onSave }) {
  const [delta, setDelta] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const preview = Math.max(0, currentSold + delta)

  const handle = async () => {
    if (delta === 0) return
    setError('')
    setLoading(true)
    try { await onSave(delta, note.trim() || null) }
    catch (err) { setError(err?.response?.data?.detail || err?.message || 'Ошибка'); setLoading(false) }
  }

  const stepBtn = (base = {}) => ({
    width: 36, height: 36, borderRadius: 10, fontSize: 20, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none',
    ...base,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9100, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>Изменить проданные бутылки</div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: TEXT2, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: TEXT2 }}>
          Курьер: <b style={{ color: TEXT }}>{courierName}</b> · продано: <b style={{ color: currentSold > 0 ? '#0077B6' : TEXT2 }}>{currentSold} бут.</b>
        </div>
        <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => setDelta(d => d - 1)} style={stepBtn({ background: '#F0FFF4', border: '1.5px solid rgba(46,184,89,0.3)', color: '#2B8A3E', fontSize: 22 })}>−</button>
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: delta > 0 ? '#0077B6' : delta < 0 ? '#2B8A3E' : TEXT2, lineHeight: 1 }}>
                {delta > 0 ? `+${delta}` : delta}
              </div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>бут.</div>
            </div>
            <button onClick={() => setDelta(d => d + 1)} style={stepBtn({ background: '#E7F5FF', border: '1.5px solid rgba(0,119,182,0.25)', color: '#0077B6', fontSize: 22 })}>+</button>
          </div>
          {delta !== 0 && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: TEXT2 }}>
              Будет: <b style={{ color: preview > 0 ? '#0077B6' : '#2B8A3E' }}>{preview} бут.</b>
            </div>
          )}
        </div>
        <input
          style={{ border: '1.5px solid rgba(60,60,67,0.12)', borderRadius: 12, padding: '12px 12px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' }}
          value={note} onChange={e => setNote(e.target.value)} placeholder="Причина (необязательно)"
        />
        {error && <div style={{ padding: '8px 12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FFB4B4', fontSize: 12, color: '#C92A2A', fontWeight: 600 }}>{error}</div>}
        <button
          style={{ padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #0077B6, #005F92)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,119,182,0.3)', ...(delta === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
          disabled={delta === 0 || loading} onClick={handle}
        >
          {loading ? 'Сохраняю...' : 'Применить изменение'}
        </button>
      </div>
    </div>
  )
}

function CourierDebtAdjModal({ courierName, currentDebt, onClose, onSave }) {
  const [delta, setDelta] = useState(0)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const preview = currentDebt + delta

  const handle = async () => {
    if (delta === 0) return
    setError('')
    setLoading(true)
    try { await onSave(delta, note.trim() || null) }
    catch (err) { setError(err?.response?.data?.detail || err?.message || 'Ошибка'); setLoading(false) }
  }

  const stepBtn = (base = {}) => ({
    width: 36, height: 36, borderRadius: 10, fontSize: 20, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none',
    ...base,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9100, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '12px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>Изменить долг бутылок</div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: TEXT2, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: TEXT2 }}>
          Курьер: <b style={{ color: TEXT }}>{courierName}</b> · текущий долг: <b style={{ color: currentDebt > 0 ? '#E03131' : TEXT2 }}>{currentDebt} бут.</b>
        </div>
        <div style={{ background: '#F8F9FA', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => setDelta(d => d - 1)} style={stepBtn({ background: '#F0FFF4', border: '1.5px solid rgba(46,184,89,0.3)', color: '#2B8A3E', fontSize: 22 })}>−</button>
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: delta > 0 ? '#E03131' : delta < 0 ? '#2B8A3E' : TEXT2, lineHeight: 1 }}>
                {delta > 0 ? `+${delta}` : delta}
              </div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>бут.</div>
            </div>
            <button onClick={() => setDelta(d => d + 1)} style={stepBtn({ background: '#FFF5F5', border: '1.5px solid rgba(224,49,49,0.2)', color: '#E03131', fontSize: 22 })}>+</button>
          </div>
          {delta !== 0 && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: TEXT2 }}>
              Будет: <b style={{ color: preview > 0 ? '#E03131' : '#2B8A3E' }}>{Math.max(0, preview)} бут.</b>
            </div>
          )}
        </div>
        <input
          style={{ border: '1.5px solid rgba(60,60,67,0.12)', borderRadius: 12, padding: '12px 12px', fontSize: 16, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%', boxSizing: 'border-box' }}
          value={note} onChange={e => setNote(e.target.value)} placeholder="Причина (необязательно)"
        />
        {error && <div style={{ padding: '8px 12px', borderRadius: 10, background: '#FFF5F5', border: '1px solid #FFB4B4', fontSize: 12, color: '#C92A2A', fontWeight: 600 }}>{error}</div>}
        <button
          style={{ padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #E03131, #C92A2A)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(224,49,49,0.3)', ...(delta === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
          disabled={delta === 0 || loading} onClick={handle}
        >
          {loading ? 'Сохраняю...' : 'Применить изменение'}
        </button>
      </div>
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

function AgentPayoutModalMgr({ agent, onClose, onSaved, performedBy, performedByRole }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    getAgentPayouts(agent.id).then(setHistory).catch(() => {}).finally(() => setHistLoading(false))
  }, [agent.id])

  const ROLE_LABELS = { admin: 'Админ', manager: 'Менеджер', warehouse: 'Завсклада' }

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (!num || isNaN(num)) { setError('Введите сумму'); return }
    setSaving(true); setError('')
    try {
      await createAgentPayout(agent.id, { amount: num, note: note.trim() || null, performed_by: performedBy, performed_by_role: performedByRole })
      onSaved()
      onClose()
    } catch { setError('Ошибка при сохранении') } finally { setSaving(false) }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9200, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Выплата заработка</div>
          <div style={{ fontSize: 13, color: TEXT2, marginBottom: 14 }}>{agent.name}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Сумма выплаты (сум)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {[1000, 5000, 10000, 50000].map(v => (
              <button key={v} onClick={() => setAmount(String((parseFloat(amount) || 0) + v))}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#F8F9FA', color: TEXT2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                +{(v/1000).toFixed(0)}к
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError('') }}
            style={{ width: '100%', fontSize: 22, fontWeight: 800, textAlign: 'center', padding: '12px 0', borderRadius: 14, border: `2px solid ${error ? '#FA5252' : BORDER}`, outline: 'none', color: TEXT, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Примечание (необязательно)</div>
          <input
            type="text"
            placeholder="Например: за неделю"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ width: '100%', fontSize: 14, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${BORDER}`, outline: 'none', color: TEXT, marginBottom: 16, boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          {error && <div style={{ fontSize: 12, color: '#FA5252', marginBottom: 10 }}>{error}</div>}
          <button onClick={() => setShowHistory(h => !h)}
            style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: showHistory ? '#F0FFF4' : '#F8F9FA', color: showHistory ? CD : TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/></svg>
            История выплат
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: showHistory ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {showHistory && (
            <div style={{ marginBottom: 16 }}>
              {histLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2.5px solid ${C}30`, borderTop: `2.5px solid ${C}`, animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : history.length === 0 ? (
                <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', padding: '12px 0' }}>Выплат ещё не было</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {history.map((h, i) => {
                    const dt = new Date(h.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    const roleLabel = ROLE_LABELS[h.performed_by_role] || h.performed_by_role || ''
                    return (
                      <div key={h.id} style={{ padding: '8px 0', borderBottom: i < history.length - 1 ? `1px solid rgba(60,60,67,0.07)` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT2 }}>
                              {roleLabel && <span>{roleLabel} </span>}{h.performed_by || '—'}
                            </div>
                            {h.note && <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{h.note}</div>}
                            <div style={{ fontSize: 10, color: TEXT2, marginTop: 1 }}>{dt}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: h.amount >= 0 ? '#2B8A3E' : '#E03131', flexShrink: 0 }}>
                            {h.amount >= 0 ? '+' : ''}{h.amount.toLocaleString()} сум
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px 32px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button disabled={saving} onClick={handleSave}
            style={{ padding: '15px 0', borderRadius: 14, border: 'none', background: saving ? '#C8D6BC' : `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 16, fontWeight: 800, cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 4px 14px rgba(141,198,63,0.35)' }}>
            {saving ? 'Сохранение…' : '💵 Выдать заработок'}
          </button>
          <button onClick={onClose}
            style={{ padding: '14px 0', borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function AgentCard({ agent: a, onDelete, performedBy, performedByRole }) {
  const [showReport, setShowReport] = useState(false)
  const [showPayout, setShowPayout] = useState(false)
  const [orderCount, setOrderCount] = useState(null)
  const [balance, setBalance] = useState(null)

  const loadBalance = () => getAgentBalance(a.id).then(setBalance).catch(() => {})

  useEffect(() => {
    getAgentOrders(a.id).then(r => setOrderCount((r || []).length)).catch(() => {})
    loadBalance()
  }, [a.id])

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${BORDER}`, opacity: a.is_active ? 1 : 0.6 }}>
      {showReport && <AgentReportModal agentId={a.id} agentName={a.name} onClose={() => setShowReport(false)} />}
      {showPayout && <AgentPayoutModalMgr agent={a} onClose={() => setShowPayout(false)} onSaved={loadBalance} performedBy={performedBy} performedByRole={performedByRole} />}
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

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: '#F0FFF4', border: '1px solid rgba(141,198,63,0.18)', flex: 1 }}>
          <span style={{ fontSize: 16 }}>📦</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: CD, lineHeight: 1 }}>{orderCount ?? '—'}</div>
            <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600 }}>Заказов</div>
          </div>
        </div>
        {balance && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: balance.owed > 0 ? '#FFF8E7' : '#F8FFF4', border: `1px solid ${balance.owed > 0 ? 'rgba(230,119,0,0.2)' : 'rgba(141,198,63,0.18)'}`, flex: 1 }}>
            <span style={{ fontSize: 16 }}>💰</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: balance.owed > 0 ? '#E67700' : CD, lineHeight: 1 }}>{(balance.owed || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600 }}>К выплате</div>
            </div>
          </div>
        )}
      </div>

      {balance && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
          <div style={{ flex: 1, background: '#F8F9FA', borderRadius: 10, padding: '6px 10px' }}>
            <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600 }}>Всего заработано</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{(balance.earned || 0).toLocaleString()} сум</div>
          </div>
          <div style={{ flex: 1, background: '#F8F9FA', borderRadius: 10, padding: '6px 10px' }}>
            <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600 }}>Уже выдано</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#2B8A3E' }}>{(balance.paid_out || 0).toLocaleString()} сум</div>
          </div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setShowPayout(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${C}`, background: `${C}15`, color: CD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M6 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Выплата
        </button>
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
  const { user } = useAuthStore()
  const performedBy = user?.name || ''
  const performedByRole = user?.role || 'manager'
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
          {agents.map(a => <AgentCard key={a.id} agent={a} onDelete={handleDelete} performedBy={performedBy} performedByRole={performedByRole} />)}
        </div>
      )}
    </div>
  )
}

const FragmentLayout = ({ children }) => <>{children}</>

export default function ManagerCouriers({ Layout = ManagerLayout, title = 'Курьеры', secondTab = 'agents', canBroadcast = true }) {
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

      {/* Broadcast panel (manager only) */}
      {canBroadcast && <button
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
      </button>}
      {canBroadcast && showBroadcast && (
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

      {/* Курьеры / Агенты (or Склад) toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#F2F2F7', borderRadius: 14, padding: 4 }}>
        {[
          { key: 'couriers', label: 'Курьеры' },
          { key: secondTab, label: secondTab === 'warehouse' ? 'Склад' : 'Агенты' },
        ].map(t => (
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
      {tab === 'warehouse' && <WarehouseCouriers Layout={FragmentLayout} />}

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
