import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers, createCourier, deleteCourier, getOrders } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

// ─── Add Courier Modal ────────────────────────────────────────────────────────
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

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Добавить курьера</div>

        <div style={s.formGroup}>
          <div style={s.formLabel}>Имя *</div>
          <input style={s.input} placeholder="Имя курьера" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={s.formGroup}>
          <div style={s.formLabel}>Телефон</div>
          <input style={s.input} placeholder="+998 90 000-00-00" value={phone}
            onChange={e => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div style={s.formGroup}>
          <div style={s.formLabel}>Telegram ID *</div>
          <input style={s.input} placeholder="Числовой ID" value={tgId}
            onChange={e => setTgId(e.target.value)} inputMode="numeric" />
          <div style={s.hint}>Клиент должен написать боту /start чтобы получить ID</div>
        </div>

        <button
          style={{ ...s.saveBtn, ...(!name.trim() || !tgId.trim() ? s.saveBtnDisabled : {}) }}
          disabled={!name.trim() || !tgId.trim() || loading}
          onClick={handle}>
          {loading ? 'Создаю...' : 'Добавить курьера'}
        </button>
        <button style={s.cancelBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

// ─── Courier Card ─────────────────────────────────────────────────────────────
function CourierCard({ courier: c, activeOrders, onDeactivate }) {
  const [confirming, setConfirming] = useState(false)
  const myOrders = activeOrders.filter(o => o.courier_id === c.id)

  return (
    <div style={{ ...s.card, opacity: c.is_active ? 1 : 0.55 }}>
      <div style={s.cardTop}>
        <div style={{ ...s.avatar, background: c.is_active ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5' }}>
          {(c.name || 'К')[0]}
        </div>
        <div style={s.info}>
          <div style={s.nameRow}>
            <div style={s.courierName}>{c.name}</div>
            <span style={{ ...s.statusDot, background: c.is_active ? '#12B886' : '#CED4DA', color: '#fff' }}>
              {c.is_active ? 'Активен' : 'Неактивен'}
            </span>
          </div>
          {c.phone && <div style={s.phone}>{c.phone}</div>}
          <div style={s.chips}>
            <span style={s.chip}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7 }}>
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              {c.total_deliveries || c.delivery_count || 0} доставок
            </span>
            {myOrders.length > 0 && (
              <span style={s.chipPurple}>{myOrders.length} активных</span>
            )}
          </div>
        </div>
        {c.phone && (
          <a href={`tel:${c.phone}`} style={s.callBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill={C}/>
            </svg>
          </a>
        )}
      </div>

      {/* Active orders */}
      {myOrders.length > 0 && (
        <div style={s.ordersWrap}>
          <div style={s.ordersLabel}>Текущие заказы</div>
          {myOrders.map(o => (
            <div key={o.id} style={s.orderRow}>
              <span style={{ fontWeight: 700, color: TEXT, fontSize: 13 }}>#{o.id}</span>
              <span style={{ color: TEXT2, fontSize: 12, flex: 1, marginLeft: 8 }}>{o.address}</span>
              <span style={{ fontSize: 12, color: TEXT2 }}>{(o.total || 0).toLocaleString()} сум</span>
            </div>
          ))}
        </div>
      )}

      {/* Deactivate */}
      {c.is_active && (
        <div style={s.deactivateWrap}>
          {!confirming ? (
            <button style={s.deactivateBtn} onClick={() => setConfirming(true)}>
              Деактивировать
            </button>
          ) : (
            <div style={s.confirmRow}>
              <span style={{ fontSize: 13, color: '#E03131', flex: 1 }}>
                Деактивировать {c.name}?
              </span>
              <button style={s.confirmYes} onClick={() => { onDeactivate(c.id); setConfirming(false) }}>Да</button>
              <button style={s.confirmNo} onClick={() => setConfirming(false)}>Нет</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ManagerCouriers() {
  const [couriers, setCouriers] = useState([])
  const [activeOrders, setActiveOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getAdminCouriers(), getOrders({ status: 'in_delivery' })])
      .then(([c, o]) => { setCouriers(c); setActiveOrders(o) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (data) => { await createCourier(data); load() }
  const handleDeactivate = async (id) => { await deleteCourier(id); load() }

  const active = couriers.filter(c => c.is_active)
  const inactive = couriers.filter(c => !c.is_active)
  const totalDeliveries = couriers.reduce((a, c) => a + (c.total_deliveries || c.delivery_count || 0), 0)

  return (
    <ManagerLayout title="Курьеры">
      {showAdd && (
        <AddCourierModal onClose={() => setShowAdd(false)} onSave={handleCreate} />
      )}

      {/* Stats + add button */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#12B886' }}>{active.length}</div>
          <div style={s.statLbl}>Активных</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#6741D9' }}>{activeOrders.length}</div>
          <div style={s.statLbl}>В доставке</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: C }}>{totalDeliveries}</div>
          <div style={s.statLbl}>Всего</div>
        </div>
        <button style={s.addBtn} onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Добавить
        </button>
      </div>

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : couriers.length === 0 ? (
        <div style={s.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}>
            <circle cx="12" cy="8" r="4" stroke={TEXT} strokeWidth="1.5"/>
            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={TEXT} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyTitle}>Курьеров пока нет</div>
          <button style={s.addBtnLg} onClick={() => setShowAdd(true)}>
            Добавить первого курьера
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>Активные · {active.length}</div>
              {active.map(c => (
                <CourierCard key={c.id} courier={c} activeOrders={activeOrders} onDeactivate={handleDeactivate} />
              ))}
            </div>
          )}
          {inactive.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>Неактивные · {inactive.length}</div>
              {inactive.map(c => (
                <CourierCard key={c.id} courier={c} activeOrders={[]} onDeactivate={handleDeactivate} />
              ))}
            </div>
          )}
        </>
      )}
    </ManagerLayout>
  )
}

const s = {
  statsRow: { display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' },
  statCard: {
    flex: 1, background: '#fff', borderRadius: 18, padding: '14px 10px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statNum: { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  statLbl: { fontSize: 11, color: TEXT2, marginTop: 3, fontWeight: 500 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 14px', borderRadius: 12, border: 'none',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    boxShadow: '0 4px 14px rgba(141,198,63,0.3)',
    WebkitTapHighlightColor: 'transparent',
  },

  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 30, height: 30, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: 14 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: TEXT2 },
  addBtnLg: {
    padding: '12px 24px', borderRadius: 12, border: 'none',
    background: C, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },

  section: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 },
  sectionLabel: {
    fontSize: 12, fontWeight: 700, color: TEXT2,
    textTransform: 'uppercase', letterSpacing: 0.5,
    padding: '2px 0 6px',
  },

  card: {
    background: '#fff', borderRadius: 18, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' },
  avatar: {
    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
    color: '#fff', fontWeight: 800, fontSize: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  courierName: { fontWeight: 700, fontSize: 16, color: TEXT },
  statusDot: { fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 700 },
  phone: { fontSize: 13, color: TEXT2 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  chip: {
    fontSize: 11, background: '#F0FFF4', color: CD,
    padding: '2px 9px', borderRadius: 999, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 4,
  },
  chipPurple: { fontSize: 11, background: '#F3F0FF', color: '#6741D9', padding: '2px 9px', borderRadius: 999, fontWeight: 600 },
  callBtn: {
    width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${BORDER}`,
    background: '#F0FFF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', flexShrink: 0,
  },

  ordersWrap: { borderTop: `1px solid ${BORDER}`, padding: '10px 16px', background: '#FAFAFA' },
  ordersLabel: {
    fontSize: 11, fontWeight: 700, color: TEXT2,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  orderRow: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 13, paddingBottom: 5,
  },

  deactivateWrap: { borderTop: `1px solid rgba(224,49,49,0.15)`, padding: '10px 16px', background: '#FFF5F5' },
  deactivateBtn: {
    background: 'none', border: '1.5px solid rgba(224,49,49,0.4)',
    color: '#E03131', padding: '7px 14px', borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 10 },
  confirmYes: {
    padding: '7px 14px', borderRadius: 10, border: 'none',
    background: '#E03131', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  confirmNo: {
    padding: '7px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
    background: '#fff', color: TEXT2, fontSize: 13, cursor: 'pointer',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', zIndex: 9000,
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    width: '100%', padding: '12px 20px 40px',
    display: 'flex', flexDirection: 'column', gap: 14,
    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  sheetTitle: { fontSize: 20, fontWeight: 800, color: TEXT, textAlign: 'center' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  formLabel: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    border: `1.5px solid ${BORDER}`, borderRadius: 12,
    padding: '13px 14px', fontSize: 16, outline: 'none',
    background: '#FAFAFA', color: TEXT,
  },
  hint: { fontSize: 12, color: TEXT2 },
  saveBtn: {
    padding: '16px', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, ${C}, ${CD})`,
    color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
  },
  saveBtnDisabled: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },
  cancelBtn: {
    padding: '14px', borderRadius: 14, border: `1.5px solid ${BORDER}`,
    background: 'none', color: TEXT2, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
}
