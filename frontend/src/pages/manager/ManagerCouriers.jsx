import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers, createCourier, deleteCourier, getCourierDetails } from '../../api'
import CourierReportModal from '../../components/CourierReportModal'

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

function CourierCard({ courier: c, onDeactivate, onActivate }) {
  const [details, setDetails] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    getCourierDetails(c.id).then(setDetails).catch(() => {})
  }, [c.id])

  const rating = details?.avg_rating > 0 ? Number(details.avg_rating).toFixed(1) : '—'
  const totalDeliveries = details?.total_deliveries ?? (c.delivery_count ?? '—')

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', opacity: c.is_active ? 1 : 0.6 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: c.is_active ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{c.name}</div>
          {c.phone && <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>{c.phone}</div>}
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
        <StatChip icon="📦" value={totalDeliveries} label="Доставок" color={CD} bg="#F0FFF4" />
        <StatChip icon="⭐" value={rating} label="Рейтинг" color="#E67700" bg="#FFFBEE" />
      </div>

      {/* Deactivate / Activate */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px' }}>
        {c.is_active ? (
          !confirming ? (
            <button
              style={{ background: 'none', border: 'none', color: '#E03131', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, opacity: 0.7 }}
              onClick={() => setConfirming(true)}
            >Деактивировать</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#E03131', flex: 1 }}>Деактивировать {c.name}?</span>
              <button style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#E03131', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => { onDeactivate(c.id); setConfirming(false) }}>Да</button>
              <button style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT2, fontSize: 12, cursor: 'pointer' }}
                onClick={() => setConfirming(false)}>Нет</button>
            </div>
          )
        ) : (
          <button
            style={{ background: 'none', border: 'none', color: CD, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
            onClick={() => onActivate(c.id)}
          >Активировать</button>
        )}
      </div>

      {showReport && <CourierReportModal courierId={c.id} courierName={c.name} onClose={() => setShowReport(false)} />}
    </div>
  )
}

export default function ManagerCouriers({ Layout = ManagerLayout, title = 'Курьеры' }) {
  const [couriers, setCouriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    getAdminCouriers()
      .then(data => setCouriers(data || []))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (data) => { await createCourier(data); load() }
  const handleDeactivate = async (id) => { await deleteCourier(id); load() }
  const handleActivate = (id) => {
    setCouriers(prev => prev.map(c => c.id === id ? { ...c, is_active: true } : c))
  }

  const active = couriers.filter(c => c.is_active)
  const deactivated = couriers.filter(c => !c.is_active)

  return (
    <Layout title={title}>
      {showAdd && <AddCourierModal onClose={() => setShowAdd(false)} onSave={handleCreate} />}

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
        <>
          {active.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Активные · {active.length}
              </div>
              {active.map(c => (
                <CourierCard key={c.id} courier={c} onDeactivate={handleDeactivate} onActivate={handleActivate} />
              ))}
            </div>
          )}
          {deactivated.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Деактивированные · {deactivated.length}
              </div>
              {deactivated.map(c => (
                <CourierCard key={c.id} courier={c} onDeactivate={handleDeactivate} onActivate={handleActivate} />
              ))}
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
