import { useState } from 'react'
import { getAgentOrders } from '../api'
import { formatPhone } from '../utils/phone'

const STATUS_CFG = {
  new:                    { label: 'Новый',           bg: '#EDF3FF', color: '#3B5BDB' },
  awaiting_confirmation:  { label: 'Ожидает',         bg: '#FFF8E6', color: '#E67700' },
  confirmed:              { label: 'Подтверждён',     bg: '#EBFBEE', color: '#2B8A3E' },
  assigned_to_courier:    { label: 'Назначен курьеру',bg: '#F3F0FF', color: '#6741D9' },
  in_delivery:            { label: 'В пути',          bg: '#E8F4FD', color: '#1971C2' },
  delivered:              { label: 'Доставлен',       bg: '#EBFBEE', color: '#2B8A3E' },
  rejected:               { label: 'Отклонён',        bg: '#FFF5F5', color: '#E03131' },
  cancellation_requested: { label: 'Отмена',          bg: '#FFF5F5', color: '#E03131' },
}

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
const PRESETS = [
  { label: 'Сегодня',   from: today(),     to: today() },
  { label: '7 дней',    from: daysAgo(6),  to: today() },
  { label: '30 дней',   from: daysAgo(29), to: today() },
  { label: 'Этот мес.', from: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` })(), to: today() },
]

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
}

export default function AgentReportModal({ agentId, agentName, onClose }) {
  const [dateFrom, setDateFrom] = useState(daysAgo(29))
  const [dateTo, setDateTo]     = useState(today())
  const [orders, setOrders]     = useState(null)
  const [loading, setLoading]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAgentOrders(agentId, { date_from: dateFrom, date_to: dateTo })
      setOrders(res || [])
    } catch { setOrders([]) }
    setLoading(false)
  }

  const presetActive = (p) => dateFrom === p.from && dateTo === p.to

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Отчёт агента</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{agentName}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: TEXT2 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#F5F5F7', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Period picker */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '10px 12px', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map(p => (
                <button key={p.label}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${presetActive(p) ? C : 'rgba(60,60,67,0.14)'}`, background: presetActive(p) ? '#EBFBEE' : '#F5F5F7', color: presetActive(p) ? CD : TEXT2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setDateFrom(p.from); setDateTo(p.to); setOrders(null) }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={dateFrom} max={dateTo}
                onChange={e => { setDateFrom(e.target.value); setOrders(null) }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 14, color: TEXT }} />
              <span style={{ color: TEXT2, fontSize: 13 }}>—</span>
              <input type="date" value={dateTo} min={dateFrom} max={today()}
                onChange={e => { setDateTo(e.target.value); setOrders(null) }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 14, color: TEXT }} />
            </div>
            <button onClick={load} disabled={loading}
              style={{ padding: '10px', borderRadius: 12, border: 'none', background: loading ? '#E0E0E5' : `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Загрузка...' : 'Показать'}
            </button>
          </div>

          {/* Summary card */}
          {orders && (
            <div style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', border: `1px solid ${BORDER}`, display: 'flex', gap: 0 }}>
              <div style={{ flex: 1, textAlign: 'center', paddingRight: 12, borderRight: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: CD }}>{orders.length}</div>
                <div style={{ fontSize: 12, color: TEXT2, fontWeight: 600 }}>Заказов</div>
              </div>
              <div style={{ flex: 2, paddingLeft: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>Заработано</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: CD, lineHeight: 1.2 }}>
                  {orders.reduce((s, o) => s + (o.agent_earning || 0), 0).toLocaleString('ru-RU')} сум
                </div>
                {orders.length > 0 && (
                  <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>
                    Сумма заказов: {orders.reduce((s, o) => s + (o.total || 0), 0).toLocaleString('ru-RU')} сум
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders list */}
          {orders && orders.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 14, padding: '32px 20px', border: `1px solid ${BORDER}`, textAlign: 'center', color: TEXT2, fontSize: 14 }}>
              Заказов за период нет
            </div>
          )}
          {orders && orders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => {
                const clientName = o.client_name || o.user?.name || ''
                const clientPhone = o.recipient_phone || o.client_phone || ''
                const statusCfg = STATUS_CFG[o.status] || { label: o.status, bg: '#F2F2F7', color: TEXT2 }
                return (
                  <div key={o.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: statusCfg.bg, color: statusCfg.color, alignSelf: 'flex-start' }}>
                          {statusCfg.label}
                        </span>
                        <div style={{ fontSize: 11, color: TEXT2 }}>{fmt(o.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: CD }}>
                          {(o.total || 0).toLocaleString('ru-RU')} сум
                        </div>
                        {(o.agent_earning || 0) > 0 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#2B8A3E' }}>
                            +{(o.agent_earning || 0).toLocaleString('ru-RU')} заработок
                          </div>
                        )}
                      </div>
                    </div>
                    {o.address && (
                      <div style={{ fontSize: 12, color: TEXT, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                        <span style={{ color: TEXT2, flexShrink: 0 }}>📍</span>
                        <span>{o.address}</span>
                      </div>
                    )}
                    {(clientPhone || clientName) && (
                      <div style={{ fontSize: 12, color: TEXT, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {clientPhone && <span style={{ color: TEXT2 }}>📞 {formatPhone(clientPhone)}</span>}
                        {clientName && <span style={{ fontWeight: 600 }}>{clientName}</span>}
                      </div>
                    )}
                    {o.items && o.items.length > 0 && (
                      <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 6, borderTop: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 }}>Состав</div>
                        {o.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C, flexShrink: 0 }} />
                            <span style={{ flex: 1, color: TEXT, fontWeight: 500 }}>{item.product_name}</span>
                            <span style={{ fontWeight: 700, color: TEXT2 }}>× {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(o.return_bottles_count > 0 || o.bottle_surcharge > 0) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {o.return_bottles_count > 0 && (
                          <div style={{ fontSize: 12, color: TEXT2 }}>♻️ Возврат: <strong>{o.return_bottles_count} шт.</strong></div>
                        )}
                        {o.bottle_surcharge > 0 && (
                          <div style={{ fontSize: 12, color: '#E67700' }}>🫙 Надбавка: <strong>+{o.bottle_surcharge.toLocaleString('ru-RU')} сум</strong></div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
