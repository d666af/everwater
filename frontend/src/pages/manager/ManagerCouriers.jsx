import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminCouriers, createCourier, deleteCourier, getOrders } from '../../api'

const G = '#2d6a4f'

function AddCourierModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tgId, setTgId] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    if (!name.trim() || !tgId.trim()) return
    setLoading(true)
    try {
      await onSave({ name: name.trim(), phone: phone.trim(), telegram_id: Number(tgId) })
      onClose()
    } catch {
      alert('Ошибка при создании')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.modalTitle}>Добавить курьера</div>
        <div style={s.formGroup}>
          <label style={s.label}>Имя *</label>
          <input style={s.input} placeholder="Имя курьера" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Телефон</label>
          <input style={s.input} placeholder="+998 90 000-00-00" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Telegram ID *</label>
          <input style={s.input} placeholder="Числовой ID" value={tgId} onChange={e => setTgId(e.target.value)} inputMode="numeric" />
          <div style={s.hint}>Клиент должен написать боту /start, чтобы получить ID</div>
        </div>
        <button style={{ ...s.saveBtn, ...(!name.trim() || !tgId.trim() ? s.saveBtnDisabled : {}) }}
          disabled={!name.trim() || !tgId.trim() || loading}
          onClick={handle}>
          {loading ? 'Создаю...' : 'Добавить курьера'}
        </button>
        <button style={s.cancelBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function CourierCard({ courier: c, activeOrders, onDeactivate }) {
  const [confirming, setConfirming] = useState(false)
  const myOrders = activeOrders.filter(o => o.courier_id === c.id)

  return (
    <div style={{ ...s.card, opacity: c.is_active ? 1 : 0.55 }}>
      <div style={s.cardTop}>
        <div style={s.avatar}>{(c.name || 'К')[0]}</div>
        <div style={s.info}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={s.name}>{c.name}</div>
            <span style={{ ...s.statusBadge, background: c.is_active ? '#d8f3dc' : '#fce4ec', color: c.is_active ? G : '#c62828' }}>
              {c.is_active ? '● Активен' : '○ Неактивен'}
            </span>
          </div>
          <div style={s.meta}>
            {c.phone && <span>📱 {c.phone}</span>}
            <span style={{ color: '#aaa' }}>🆔 {c.telegram_id}</span>
          </div>
          <div style={s.chips}>
            <span style={s.delivChip}>📦 {c.total_deliveries || c.delivery_count || 0} доставок</span>
            {(c.total_earnings || c.earnings) > 0 && (
              <span style={s.earnChip}>💰 {((c.total_earnings || c.earnings) || 0).toLocaleString()} сум</span>
            )}
            {myOrders.length > 0 && (
              <span style={s.activeOrderChip}>🚴 {myOrders.length} активных</span>
            )}
          </div>
        </div>
        <div style={s.cardActions}>
          {c.phone && (
            <a href={`tel:${c.phone}`} style={s.callBtn}>📞</a>
          )}
        </div>
      </div>

      {/* Active orders for this courier */}
      {myOrders.length > 0 && (
        <div style={s.courierOrders}>
          <div style={s.ordersTitle}>Текущие заказы:</div>
          {myOrders.map(o => (
            <div key={o.id} style={s.orderRow}>
              <span style={{ fontWeight: 600, color: G }}>#{o.id}</span>
              <span style={{ color: '#555', fontSize: 12 }}>{o.address}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{(o.total||0).toLocaleString()} сум</span>
            </div>
          ))}
        </div>
      )}

      {/* Deactivate */}
      {c.is_active && (
        <div style={s.deactivateWrap}>
          {!confirming ? (
            <button style={s.deactivateBtn} onClick={() => setConfirming(true)}>
              Деактивировать курьера
            </button>
          ) : (
            <div style={s.confirmRow}>
              <span style={{ fontSize: 13, color: '#c62828' }}>Деактивировать {c.name}?</span>
              <button style={s.confirmYes} onClick={() => { onDeactivate(c.id); setConfirming(false) }}>Да</button>
              <button style={s.confirmNo} onClick={() => setConfirming(false)}>Отмена</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ManagerCouriers() {
  const [couriers, setCouriers] = useState([])
  const [activeOrders, setActiveOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      getAdminCouriers(),
      getOrders({ status: 'in_delivery' }),
    ])
      .then(([c, o]) => { setCouriers(c); setActiveOrders(o) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (data) => {
    await createCourier(data)
    load()
  }

  const handleDeactivate = async (id) => {
    await deleteCourier(id)
    load()
  }

  const active = couriers.filter(c => c.is_active)
  const inactive = couriers.filter(c => !c.is_active)

  return (
    <ManagerLayout title="Курьеры">
      {showAdd && (
        <AddCourierModal
          onClose={() => setShowAdd(false)}
          onSave={handleCreate}
        />
      )}

      <div style={s.page}>
        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statVal}>{active.length}</div>
            <div style={s.statLbl}>Активных</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{activeOrders.length}</div>
            <div style={s.statLbl}>В доставке</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{couriers.reduce((a, c) => a + (c.total_deliveries || c.delivery_count || 0), 0)}</div>
            <div style={s.statLbl}>Всего доставок</div>
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
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <div style={s.sectionTitle}>Активные ({active.length})</div>
                {active.map(c => (
                  <CourierCard key={c.id} courier={c} activeOrders={activeOrders} onDeactivate={handleDeactivate} />
                ))}
              </div>
            )}
            {inactive.length > 0 && (
              <div>
                <div style={s.sectionTitle}>Неактивные ({inactive.length})</div>
                {inactive.map(c => (
                  <CourierCard key={c.id} courier={c} activeOrders={[]} onDeactivate={handleDeactivate} />
                ))}
              </div>
            )}
            {couriers.length === 0 && (
              <div style={s.emptyState}>
                <div style={{ fontSize: 40 }}>🚴</div>
                <div style={{ fontWeight: 600, color: '#555' }}>Курьеров пока нет</div>
                <button style={s.addBtnLg} onClick={() => setShowAdd(true)}>+ Добавить первого</button>
              </div>
            )}
          </>
        )}
      </div>
    </ManagerLayout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 12 },
  statsRow: { display: 'flex', gap: 8, alignItems: 'center' },
  statCard: {
    flex: 1, background: '#fff', borderRadius: 12, padding: '12px 10px',
    textAlign: 'center', border: '1px solid #e8f5e9',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  statVal: { fontSize: 22, fontWeight: 800, color: G },
  statLbl: { fontSize: 10, color: '#888', marginTop: 2 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 14px', borderRadius: 10, border: 'none',
    background: G, color: '#fff', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
  center: { display: 'flex', justifyContent: 'center', padding: 50 },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: '3px solid #8DC63F',
    animation: 'spin 0.8s linear infinite',
  },
  emptyState: { textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  addBtnLg: {
    padding: '10px 24px', borderRadius: 10, border: 'none',
    background: G, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', padding: '6px 0 8px', letterSpacing: 0.5 },
  card: {
    background: '#fff', borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #e8f5e9', marginBottom: 8,
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' },
  avatar: {
    width: 44, height: 44, borderRadius: '50%', background: '#d8f3dc',
    color: G, fontWeight: 700, fontSize: 18, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  name: { fontWeight: 600, fontSize: 14, color: '#1b4332' },
  statusBadge: { fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600 },
  meta: { display: 'flex', gap: 10, fontSize: 11, color: '#666', flexWrap: 'wrap' },
  chips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  delivChip: { fontSize: 10, background: '#e8f5e9', color: G, padding: '2px 7px', borderRadius: 6, fontWeight: 500 },
  earnChip: { fontSize: 10, background: '#fff8e1', color: '#f57f17', padding: '2px 7px', borderRadius: 6, fontWeight: 500 },
  activeOrderChip: { fontSize: 10, background: '#EDE7F6', color: '#4527a0', padding: '2px 7px', borderRadius: 6, fontWeight: 600 },
  cardActions: { flexShrink: 0 },
  callBtn: {
    width: 34, height: 34, borderRadius: 9, border: `1px solid ${G}`,
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, textDecoration: 'none',
  },
  courierOrders: { borderTop: '1px solid #f0f7f0', padding: '8px 14px', background: '#FAFFFE' },
  ordersTitle: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.4 },
  orderRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingBottom: 4 },
  deactivateWrap: { borderTop: '1px solid #fce4ec', padding: '8px 14px', background: '#fff5f5' },
  deactivateBtn: {
    background: 'none', border: '1px solid #fca5a5', color: '#c62828',
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  confirmYes: { padding: '6px 12px', borderRadius: 8, border: 'none', background: '#c62828', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  confirmNo: { padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 12, cursor: 'pointer' },

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
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#1C1C1E', textAlign: 'center' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    border: '1.5px solid rgba(60,60,67,0.12)', borderRadius: 10,
    padding: '12px 14px', fontSize: 15, outline: 'none',
    background: '#FAFAFA', color: '#1C1C1E',
  },
  hint: { fontSize: 11, color: '#aaa' },
  saveBtn: {
    padding: '15px', borderRadius: 14, border: 'none',
    background: `linear-gradient(135deg, #8DC63F, #6CA32F)`,
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
  },
  saveBtnDisabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' },
  cancelBtn: {
    padding: '13px', borderRadius: 14,
    border: '1.5px solid rgba(60,60,67,0.12)', background: 'none',
    color: '#8E8E93', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
}
