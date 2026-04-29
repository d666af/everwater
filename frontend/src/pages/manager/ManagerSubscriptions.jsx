import { useEffect, useState, useCallback } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminSubscriptions, createOrderFromSubscription, getAdminCouriers, assignCourier } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PLAN_TABS = [
  { key: 'weekly', label: '📅 Еженедельные' },
  { key: 'monthly', label: '🗓 Ежемесячные' },
]

const WEEKDAY_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

function getDayOrder(day) {
  const i = WEEKDAY_ORDER.indexOf(day)
  return i === -1 ? 99 : i
}

function getDeliveryStatus(sub) {
  if (sub.overdue) return 'overdue'
  if (sub.due_today) return 'today'
  return 'upcoming'
}

function NextDeliveryBadge({ sub }) {
  const status = getDeliveryStatus(sub)
  const ndd = sub.next_delivery_date
  let label = '—'
  if (ndd) {
    try {
      const d = new Date(ndd)
      label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    } catch { label = ndd.slice(0, 10) }
  }
  const styles = {
    overdue: { bg: '#FF3B30', color: '#fff', text: `🔴 Просрочена (${label})` },
    today:   { bg: '#FF9500', color: '#fff', text: `⚡ Сегодня (${label})` },
    upcoming:{ bg: '#E8F5E9', color: CD,     text: `📅 ${label}` },
  }
  const s = styles[status]
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 8,
      background: s.bg, color: s.color, fontSize: 12, fontWeight: 600,
    }}>{s.text}</span>
  )
}

function SubCard({ sub, onCreateOrder }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`,
      marginBottom: 10, overflow: 'hidden',
      boxShadow: sub.overdue ? '0 0 0 2px #FF3B30' : sub.due_today ? '0 0 0 2px #FF9500' : 'none',
    }}>
      <div style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{sub.client_name || '—'}</div>
            <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>
              {sub.day || '—'} · {sub.time_slot === 'morning' ? 'Утро' : sub.time_slot === 'afternoon' ? 'День' : ''}
            </div>
          </div>
          <NextDeliveryBadge sub={sub} />
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: TEXT }}>
          💧 {sub.water_summary}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="📍 Адрес" value={sub.address} />
            {sub.landmark && <Row label="🏢 Ориентир" value={sub.landmark} />}
            <Row label="📞 Телефон" value={sub.phone || '—'} />
            <Row label="💳 Оплата" value={{ cash: 'Наличные', card: 'Карта', balance: 'Баланс' }[sub.payment_method] || sub.payment_method} />
            <Row label="💰 Сумма" value={`${Math.round(sub.total).toLocaleString('ru')} сум`} />
            {sub.last_delivered_at && (
              <Row label="✅ Посл. доставка" value={new Date(sub.last_delivered_at).toLocaleDateString('ru-RU')} />
            )}
          </div>
          <button
            onClick={() => onCreateOrder(sub)}
            style={{
              marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10,
              background: `linear-gradient(135deg, #A8D86D, ${C})`,
              color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
            }}
          >
            🛒 Создать заказ
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 13 }}>
      <span style={{ color: TEXT2, minWidth: 120 }}>{label}:</span>
      <span style={{ color: TEXT, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function CourierModal({ order, couriers, onAssign, onClose }) {
  const [loading, setLoading] = useState(false)

  const handleAssign = async (courierId) => {
    setLoading(true)
    try { await onAssign(order.order_id, courierId) } finally { setLoading(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0', padding: 20,
        width: '100%', maxHeight: '80vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Назначить курьера</div>
        <div style={{ fontSize: 13, color: TEXT2, marginBottom: 14 }}>
          Заказ #{order.order_id} · {order.client_name} · {order.items_text}
        </div>
        {couriers.filter(c => c.is_active).map(c => (
          <button
            key={c.id}
            onClick={() => handleAssign(c.id)}
            disabled={loading}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '12px 14px', marginBottom: 8, borderRadius: 12,
              background: '#F2F2F7', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 600, color: TEXT,
            }}
          >
            🚴 {c.name}
            {c.phone && <span style={{ fontSize: 12, color: TEXT2, marginLeft: 8 }}>{c.phone}</span>}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: 12, marginTop: 4, borderRadius: 12,
            background: '#F2F2F7', border: 'none', cursor: 'pointer',
            fontSize: 15, color: TEXT2,
          }}
        >Отмена</button>
      </div>
    </div>
  )
}

export default function ManagerSubscriptions({ Layout = ManagerLayout, title = 'Подписки' }) {
  const [plan, setPlan] = useState('weekly')
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(false)
  const [couriers, setCouriers] = useState([])
  const [pendingOrder, setPendingOrder] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async (p) => {
    setLoading(true)
    try {
      const [data, cs] = await Promise.all([
        getAdminSubscriptions({ plan: p, status: 'active' }),
        getAdminCouriers(),
      ])
      // Sort: overdue first, then today, then by day
      const sorted = [...data].sort((a, b) => {
        const sa = a.overdue ? 0 : a.due_today ? 1 : 2
        const sb = b.overdue ? 0 : b.due_today ? 1 : 2
        if (sa !== sb) return sa - sb
        return getDayOrder(a.day) - getDayOrder(b.day)
      })
      setSubs(sorted)
      setCouriers(cs || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(plan) }, [plan, load])

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const handleCreateOrder = async (sub) => {
    try {
      const result = await createOrderFromSubscription(sub.id)
      setPendingOrder(result)
      load(plan)
    } catch (e) {
      showToast(`Ошибка: ${e?.response?.data?.detail || e.message}`, false)
    }
  }

  const handleAssignCourier = async (orderId, courierId) => {
    try {
      await assignCourier(orderId, courierId)
      setPendingOrder(null)
      showToast('✅ Курьер назначен!')
    } catch {
      showToast('Ошибка назначения курьера', false)
    }
  }

  const overdueCount = subs.filter(s => s.overdue).length
  const todayCount = subs.filter(s => s.due_today).length

  // Group weekly subs by day for display
  const grouped = plan === 'weekly'
    ? WEEKDAY_ORDER.reduce((acc, day) => {
        const g = subs.filter(s => s.day === day)
        if (g.length) acc.push({ day, items: g })
        return acc
      }, [])
    : [{ day: null, items: subs }]

  return (
    <Layout>
      <div style={{ padding: '16px 16px 80px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: TEXT, marginBottom: 4 }}>{title}</div>

        {/* Stats bar */}
        {(overdueCount > 0 || todayCount > 0) && (
          <div style={{
            display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
          }}>
            {overdueCount > 0 && (
              <div style={{ background: '#FF3B30', color: '#fff', borderRadius: 10, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                🔴 Просрочено: {overdueCount}
              </div>
            )}
            {todayCount > 0 && (
              <div style={{ background: '#FF9500', color: '#fff', borderRadius: 10, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                ⚡ Сегодня: {todayCount}
              </div>
            )}
          </div>
        )}

        {/* Plan tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {PLAN_TABS.map(t => (
            <button key={t.key} onClick={() => setPlan(t.key)} style={{
              flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
              background: plan === t.key ? C : '#F2F2F7',
              color: plan === t.key ? '#fff' : TEXT,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: TEXT2 }}>Загрузка...</div>
        ) : subs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: TEXT2 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            Нет активных подписок
          </div>
        ) : (
          grouped.map(({ day, items }) => (
            <div key={day || 'all'}>
              {day && (
                <div style={{ fontWeight: 700, fontSize: 15, color: TEXT2, marginBottom: 8, marginTop: 4 }}>
                  {day} — {items.length} подп.
                </div>
              )}
              {items.map(sub => (
                <SubCard key={sub.id} sub={sub} onCreateOrder={handleCreateOrder} />
              ))}
            </div>
          ))
        )}
      </div>

      {pendingOrder && (
        <CourierModal
          order={pendingOrder}
          couriers={couriers}
          onAssign={handleAssignCourier}
          onClose={() => setPendingOrder(null)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#1C1C1E' : '#FF3B30',
          color: '#fff', padding: '10px 20px', borderRadius: 12,
          fontSize: 14, fontWeight: 600, zIndex: 2000, whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}
    </Layout>
  )
}
