import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminStats, getAdminStatsExtended, getCancelledOrders, getStatsLentBottles, getDebtAdjustments, getAgentPayoutStats, getWaterForecast } from '../../api'
const getSoldAdjustments = (params = {}) => getDebtAdjustments({ ...params, target_type: 'courier_sold' })
import DateTimePickerModal from '../../components/warehouse/DateTimePickerModal'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

function toISODate(d) {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function fmtDate(s) {
  if (!s) return ''
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function todayISO() { return toISODate(new Date()) }

const STATUS_LABELS = {
  new: 'Новые',
  awaiting_confirmation: 'Ожидают подтверждения',
  confirmed: 'Подтверждены',
  assigned_to_courier: 'Назначены курьеру',
  in_delivery: 'В доставке',
  delivered: 'Доставлены',
  rejected: 'Отклонены',
}

const STATUS_COLORS = {
  new: '#3B5BDB',
  awaiting_confirmation: '#E67700',
  confirmed: '#2B8A3E',
  assigned_to_courier: '#6741D9',
  in_delivery: '#1971C2',
  delivered: '#8DC63F',
  rejected: '#E03131',
}

const METRICS = []

function CancelledCard({ count, dateParams }) {
  const [expanded, setExpanded] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!expanded && orders.length === 0) {
      setLoading(true)
      try {
        const data = await getCancelledOrders(dateParams)
        setOrders(data)
      } catch {}
      setLoading(false)
    }
    setExpanded(prev => !prev)
  }

  const fmt = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: '#E031311F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#E03131" strokeWidth="1.8" />
            <path d="M15 9L9 15M9 9l6 6" stroke="#E03131" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: TEXT2, marginBottom: 2 }}>Отменено</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#E03131', lineHeight: 1 }}>{count}</div>
        </div>
        {count > 1 && (
          <button
            onClick={handleToggle}
            style={{
              background: expanded ? '#FFF5F5' : '#F2F2F7',
              border: 'none',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: expanded ? '#E03131' : TEXT2,
              cursor: 'pointer',
              flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {expanded ? 'Свернуть' : 'Подробнее'}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(60,60,67,0.08)', paddingTop: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid rgba(224,49,49,0.2)', borderTopColor: '#E03131', animation: 'evSpin 0.8s linear infinite' }} />
            </div>
          ) : orders.length === 0 ? (
            <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', padding: 12 }}>Нет данных</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.filter(o => !o.is_deleted).map((o) => (
                <div key={o.id} style={{ background: '#FFF5F5', borderRadius: 14, padding: '12px 14px', borderLeft: `3px solid #E03131` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{o.client_name || o.client_phone || o.address || '—'}</span>
                      {o.client_name && o.client_phone && <span style={{ fontSize: 11, color: TEXT2 }}>{o.client_phone}</span>}
                      {!o.client_name && !o.client_phone && o.address && <span style={{ fontSize: 11, color: TEXT2 }}>{o.address}</span>}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#E03131' }}>
                      {Math.round(o.total).toLocaleString('ru-RU')} сум
                    </span>
                  </div>
                  {/* Composition */}
                  {(o.items || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
                      {o.items.map((it, j) => (
                        <div key={j} style={{ fontSize: 12, color: TEXT }}>
                          <span style={{ fontWeight: 700, color: '#C92A2A' }}>{it.quantity} шт.</span>{' '}
                          <span>{it.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.return_bottles_count > 0 && (
                    <div style={{ fontSize: 11, color: '#12B886', marginBottom: 2 }}>↩ Возврат: {o.return_bottles_count} бут.</div>
                  )}
                  {o.bottles_lent > 0 && (
                    <div style={{ fontSize: 11, color: '#E67700', marginBottom: 2 }}>📦 Одолжить: {o.bottles_lent} бут.</div>
                  )}
                  {o.bottle_surcharge > 0 && (
                    <div style={{ fontSize: 11, color: '#E67700', marginBottom: 2 }}>💰 Надбавка: +{Math.round(o.bottle_surcharge).toLocaleString('ru-RU')} сум</div>
                  )}
                  {/* Meta */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, marginBottom: 4 }}>
                    {o.creator && <div style={{ fontSize: 11, color: TEXT2 }}>✍️ Создал: <span style={{ color: TEXT, fontWeight: 600 }}>{o.creator}</span></div>}
                    {o.assigner && <div style={{ fontSize: 11, color: TEXT2 }}>👤 Назначил курьера: <span style={{ color: TEXT, fontWeight: 600 }}>{o.assigner}</span></div>}
                    {o.courier_name && <div style={{ fontSize: 11, color: TEXT2 }}>🚴 Курьер: <span style={{ color: TEXT, fontWeight: 600 }}>{o.courier_name}</span></div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: 11, background: '#FFE3E3', borderRadius: 8, padding: '3px 8px', color: '#C92A2A', fontWeight: 600 }}>
                      Отменил: {o.cancelled_by}
                    </span>
                    <span style={{ fontSize: 11, background: 'rgba(60,60,67,0.06)', borderRadius: 8, padding: '3px 8px', color: TEXT2, fontWeight: 500 }}>
                      {fmt(o.created_at)}
                    </span>
                  </div>
                  {o.reason && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#C92A2A', fontStyle: 'italic' }}>
                      Причина: {o.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeletedCard({ count, dateParams }) {
  const [expanded, setExpanded] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!expanded && orders.length === 0) {
      setLoading(true)
      try {
        const data = await getCancelledOrders(dateParams)
        setOrders(data.filter(o => o.is_deleted))
      } catch {}
      setLoading(false)
    }
    setExpanded(prev => !prev)
  }

  const fmt = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: '#E677001F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <polyline points="3 6 5 6 21 6" stroke="#E67700" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#E67700" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 11v6M14 11v6" stroke="#E67700" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="#E67700" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: TEXT2, marginBottom: 2 }}>Удалено</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#E67700', lineHeight: 1 }}>{count}</div>
        </div>
        {count > 0 && (
          <button
            onClick={handleToggle}
            style={{
              background: expanded ? '#FFF8F0' : '#F2F2F7',
              border: 'none',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: expanded ? '#E67700' : TEXT2,
              cursor: 'pointer',
              flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {expanded ? 'Свернуть' : 'Подробнее'}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(60,60,67,0.08)', paddingTop: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid rgba(230,119,0,0.2)', borderTopColor: '#E67700', animation: 'evSpin 0.8s linear infinite' }} />
            </div>
          ) : orders.length === 0 ? (
            <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', padding: 12 }}>Нет данных</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.map((o) => (
                <div key={o.id} style={{ background: '#FFF8F0', borderRadius: 14, padding: '12px 14px', borderLeft: '3px solid #E67700' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{o.client_name || o.client_phone || o.address || '—'}</span>
                      {o.client_name && o.client_phone && <span style={{ fontSize: 11, color: TEXT2 }}>{o.client_phone}</span>}
                      {!o.client_name && !o.client_phone && o.address && <span style={{ fontSize: 11, color: TEXT2 }}>{o.address}</span>}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#E67700' }}>
                      {Math.round(o.total).toLocaleString('ru-RU')} сум
                    </span>
                  </div>
                  {(o.items || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
                      {o.items.map((it, j) => (
                        <div key={j} style={{ fontSize: 12, color: TEXT }}>
                          <span style={{ fontWeight: 700, color: '#C05A00' }}>{it.quantity} шт.</span>{' '}
                          <span>{it.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.return_bottles_count > 0 && (
                    <div style={{ fontSize: 11, color: '#12B886', marginBottom: 2 }}>↩ Возврат: {o.return_bottles_count} бут.</div>
                  )}
                  {o.bottles_lent > 0 && (
                    <div style={{ fontSize: 11, color: '#E67700', marginBottom: 2 }}>📦 Одолжить: {o.bottles_lent} бут.</div>
                  )}
                  {o.bottle_surcharge > 0 && (
                    <div style={{ fontSize: 11, color: '#E67700', marginBottom: 2 }}>💰 Надбавка: +{Math.round(o.bottle_surcharge).toLocaleString('ru-RU')} сум</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, marginBottom: 4 }}>
                    {o.creator && <div style={{ fontSize: 11, color: TEXT2 }}>✍️ Создал: <span style={{ color: TEXT, fontWeight: 600 }}>{o.creator}</span></div>}
                    {o.assigner && <div style={{ fontSize: 11, color: TEXT2 }}>👤 Назначил курьера: <span style={{ color: TEXT, fontWeight: 600 }}>{o.assigner}</span></div>}
                    {o.courier_name && <div style={{ fontSize: 11, color: TEXT2 }}>🚴 Курьер: <span style={{ color: TEXT, fontWeight: 600 }}>{o.courier_name}</span></div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: 11, background: '#FFF0E0', borderRadius: 8, padding: '3px 8px', color: '#C05A00', fontWeight: 600 }}>
                      🗑 {o.cancelled_by}
                    </span>
                    <span style={{ fontSize: 11, background: 'rgba(60,60,67,0.06)', borderRadius: 8, padding: '3px 8px', color: TEXT2, fontWeight: 500 }}>
                      {fmt(o.created_at)}
                    </span>
                  </div>
                  {o.reason && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#C05A00', fontStyle: 'italic' }}>
                      Причина: {o.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WaterForecastWidget() {
  const [forecast, setForecast] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    getWaterForecast().then(setForecast).catch(() => setForecast([]))
  }, [])

  if (!forecast || forecast.length === 0) return null

  const critical = forecast.filter(f => f.urgency === 'critical')
  const warning = forecast.filter(f => f.urgency === 'warning')
  const visible = expanded ? forecast : forecast.slice(0, 4)

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: critical.length > 0 ? '#FFF5F5' : '#FFFBEE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>💧</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Прогноз воды</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
            {critical.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#C92A2A', background: '#FFF5F5', padding: '1px 8px', borderRadius: 999 }}>🔴 {critical.length} критично</span>
            )}
            {warning.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#E67700', background: '#FFFBEE', padding: '1px 8px', borderRadius: 999 }}>🟡 {warning.length} скоро</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {visible.map((f, i) => (
          <div key={f.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < visible.length - 1 ? '1px solid rgba(60,60,67,0.07)' : 'none' }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{f.urgency === 'critical' ? '🔴' : '🟡'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || f.phone || '—'}</div>
              {f.name && f.phone && <div style={{ fontSize: 11, color: TEXT2 }}>{f.phone}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: f.urgency === 'critical' ? '#C92A2A' : '#E67700' }}>~{f.days_until_empty} дн.</div>
              <div style={{ fontSize: 10, color: TEXT2 }}>интервал {f.avg_interval_days}д</div>
            </div>
          </div>
        ))}
      </div>
      {forecast.length > 4 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ marginTop: 8, width: '100%', padding: '8px 0', borderRadius: 10, border: '1.5px solid rgba(60,60,67,0.1)', background: expanded ? '#F8F9FA' : '#fff', color: TEXT2, fontSize: 12, fontWeight: 700, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        >
          {expanded ? 'Свернуть' : `Ещё ${forecast.length - 4}`}
        </button>
      )}
    </div>
  )
}

function MetricCard({ metric, value }) {
  const { label, color, format, subtitle, icon } = metric
  const displayValue = value != null ? (format ? format(value) : value) : '—'
  const sub = value != null && subtitle ? subtitle(value) : null

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: '20px 14px 18px',
        textAlign: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: color + '1F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon(color)}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: TEXT }}>
        {displayValue}
      </div>
      <div
        style={{
          fontSize: 12,
          color: TEXT2,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: -4, fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function RevenueContext({ stats, revenueLabel }) {
  if (!stats) return null

  const warehouseRows = stats.warehouse_sales || []
  const warehouseTotalQty = warehouseRows.reduce((s, r) => s + r.qty, 0)
  const warehouseTotalMarket = warehouseRows.reduce((s, r) => s + r.market, 0)
  const warehouseTotalCost = warehouseRows.reduce((s, r) => s + r.cost, 0)
  const hasWarehouseSales = warehouseRows.length > 0

  const factoryStats = stats.factory_stats || []
  const hasFactories = factoryStats.length > 0

  return (
    <>
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 14 }}>
          Выручка {revenueLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: TEXT }}>
            {Math.round(warehouseTotalCost).toLocaleString('ru-RU')}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT2 }}>сум</span>
          <span style={{ fontSize: 12, color: TEXT2, fontWeight: 400, marginLeft: 2 }}>себестоимость</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: GRAD, marginBottom: 0, opacity: 0.7 }} />

        {hasWarehouseSales && (
          <>
            <div style={{ height: 1, background: 'rgba(60,60,67,0.1)', margin: '14px -20px 12px' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Продажи со склада
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {warehouseRows.map((item, i) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 0',
                    borderBottom: i < warehouseRows.length - 1 ? '1px solid rgba(60,60,67,0.06)' : 'none',
                  }}
                >
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, flexShrink: 0 }}>{item.qty} шт.</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: CD, flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
                    {item.market > 0 ? `${Math.round(item.market).toLocaleString('ru-RU')} сум` : '—'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 4, borderTop: '1.5px solid rgba(60,60,67,0.1)' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: TEXT }}>Итого</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: CD }}>{warehouseTotalQty} шт.</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: CD, minWidth: 90, textAlign: 'right' }}>
                {Math.round(warehouseTotalMarket).toLocaleString('ru-RU')} сум
              </div>
            </div>
            {(stats.bottles_returned_to_warehouse || 0) > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(60,60,67,0.06)' }}>
                <span style={{ fontSize: 12, color: CD, fontWeight: 600 }}>
                  Возврат 19л бутылок: {stats.bottles_returned_to_warehouse} шт.
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {hasFactories && (
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9C36B5', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
            Заводы
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {factoryStats.map((f) => (
              <div key={f.name} style={{ background: '#F8EBFC', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#9C36B5', marginBottom: 8 }}>{f.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(f.items || []).map((it, i) => (
                    <div
                      key={it.product_name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 0',
                        borderBottom: i < (f.items || []).length - 1 ? '1px solid rgba(156,54,181,0.12)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.product_name}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, flexShrink: 0 }}>{it.qty} шт.</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#9C36B5', flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
                        {Math.round(it.total).toLocaleString('ru-RU')} сум
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 4, borderTop: '1.5px solid rgba(156,54,181,0.2)' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: TEXT }}>Итого</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#9C36B5' }}>{f.total_qty} шт.</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#9C36B5', minWidth: 90, textAlign: 'right' }}>
                    {Math.round(f.total_sum).toLocaleString('ru-RU')} сум
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </>
  )
}

function AgentEarningsCard({ agentRows, totalQty, totalAmt, totalAgentEarning, payStats }) {
  const [showPerAgent, setShowPerAgent] = useState(false)
  const [showPayHistory, setShowPayHistory] = useState(false)
  const ROLE_LABELS = { admin: 'Админ', manager: 'Менеджер', warehouse: 'Завсклада' }

  const perAgent = payStats?.per_agent || []
  const owedAgents = perAgent.filter(a => a.owed > 0)

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Заработок агентов</div>

      {agentRows.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {agentRows.map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < agentRows.length - 1 ? `1px solid rgba(60,60,67,0.08)` : 'none' }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT2, flexShrink: 0 }}>{p.qty} шт.</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>{Math.round(p.total).toLocaleString('ru-RU')} сум</div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 10, marginTop: 4, borderTop: `1.5px solid rgba(60,60,67,0.1)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: TEXT }}>Итого</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: CD }}>{totalQty} шт.</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: CD, minWidth: 80, textAlign: 'right' }}>{Math.round(totalAmt).toLocaleString('ru-RU')} сум</div>
            </div>
            {totalAgentEarning > 0 && (
              <div style={{ fontSize: 12, color: CD, fontWeight: 700, marginTop: 5 }}>
                Заработок агентов: +{Math.round(totalAgentEarning).toLocaleString('ru-RU')} сум
              </div>
            )}
          </div>
        </>
      )}

      {payStats && (
        <>
          <div style={{ height: 1, background: 'rgba(60,60,67,0.08)', margin: '12px -16px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ background: '#EBFBEE', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2B8A3E', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>Выдано сегодня</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#2B8A3E', lineHeight: 1 }}>{Math.round(payStats.today_paid_out).toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 10, color: '#2B8A3E', marginTop: 2 }}>сум</div>
            </div>
            <div style={{ background: payStats.total_owed > 0 ? '#FFF8E7' : '#F8F9FA', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: payStats.total_owed > 0 ? '#E67700' : TEXT2, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>Ещё не выдано</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: payStats.total_owed > 0 ? '#E67700' : TEXT2, lineHeight: 1 }}>{Math.round(payStats.total_owed).toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 10, color: payStats.total_owed > 0 ? '#E67700' : TEXT2, marginTop: 2 }}>сум</div>
            </div>
          </div>

          {owedAgents.length > 0 && (
            <>
              <button onClick={() => setShowPerAgent(v => !v)}
                style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: `1.5px solid rgba(60,60,67,0.1)`, background: showPerAgent ? `${C}12` : '#F8F9FA', color: showPerAgent ? CD : TEXT2, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: showPerAgent ? 8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M2 20c0-3 3.1-5.5 7-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="17" cy="13" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M14 20c0-2.2 1.3-4 3-4s3 1.8 3 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Список агентов ({owedAgents.length})
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transition: 'transform 0.2s', transform: showPerAgent ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {showPerAgent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
                  {owedAgents.map((a, i) => (
                    <div key={a.agent_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < owedAgents.length - 1 ? `1px solid rgba(60,60,67,0.07)` : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: TEXT2 }}>Заработано: {Math.round(a.earned).toLocaleString('ru-RU')} | Выдано: {Math.round(a.paid_out).toLocaleString('ru-RU')}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#E67700', flexShrink: 0 }}>{Math.round(a.owed).toLocaleString('ru-RU')} сум</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function ManagerStats({ Layout = ManagerLayout, title = 'Статистика', showExtended = false }) {
  const [dateFrom, setDateFrom] = useState(todayISO)
  const [dateTo, setDateTo] = useState(todayISO)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [stats, setStats] = useState(null)
  const [extStats, setExtStats] = useState(null)
  const [lentData, setLentData] = useState(null)
  const [lentRole, setLentRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [debtAdj, setDebtAdj] = useState([])
  const [soldAdj, setSoldAdj] = useState([])
  const [agentPayoutStats, setAgentPayoutStats] = useState(null)

  const isToday = dateFrom === todayISO() && dateTo === todayISO()

  const dateParams = { date_from: dateFrom, date_to: dateTo }

  const periodLabel = isToday
    ? `Сегодня, ${fmtDate(dateFrom)}`
    : dateFrom === dateTo
      ? fmtDate(dateFrom)
      : `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`

  const revenueLabel = isToday ? 'за сегодня'
    : dateFrom === dateTo ? `за ${fmtDate(dateFrom)}`
    : `за ${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`

  useEffect(() => {
    setLoading(true)
    setLentRole(null)
    const calls = [
      getAdminStats(dateParams).then(setStats).catch(console.error),
      getStatsLentBottles(dateParams).then(setLentData).catch(console.error),
      getDebtAdjustments({ limit: 100 }).then(setDebtAdj).catch(() => setDebtAdj([])),
      getSoldAdjustments({ limit: 100 }).then(setSoldAdj).catch(() => setSoldAdj([])),
      getAgentPayoutStats().then(setAgentPayoutStats).catch(() => {}),
    ]
    if (showExtended) calls.push(getAdminStatsExtended(dateParams).then(setExtStats).catch(console.error))
    Promise.all(calls).finally(() => setLoading(false))
  }, [dateFrom, dateTo, showExtended]) // eslint-disable-line

  return (
    <Layout title={title}>
      {/* Keyframes for spinner */}
      <style>{`@keyframes evSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Date filter — Panel style */}
      {pickerOpen && (
        <DateTimePickerModal
          initialDate={dateFrom}
          initialDateTo={dateTo !== dateFrom ? dateTo : null}
          onClose={() => setPickerOpen(false)}
          onApply={(start, end) => {
            setDateFrom(toISODate(start))
            setDateTo(toISODate(end || start))
            setPickerOpen(false)
          }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <button
          onClick={() => { const t = todayISO(); setDateFrom(t); setDateTo(t) }}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
            background: isToday ? GRAD : '#fff',
            color: isToday ? '#fff' : TEXT2,
            border: isToday ? 'none' : `1.5px solid ${BORDER}`,
            fontSize: 13, fontWeight: 700,
            boxShadow: isToday ? '0 2px 10px rgba(141,198,63,0.4)' : '0 1px 4px rgba(0,0,0,0.04)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Сегодня
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
            background: !isToday ? GRAD : '#fff',
            color: !isToday ? '#fff' : TEXT2,
            border: !isToday ? 'none' : `1.5px solid ${BORDER}`,
            fontSize: 13, fontWeight: 700,
            boxShadow: !isToday ? '0 2px 10px rgba(141,198,63,0.4)' : '0 1px 4px rgba(0,0,0,0.04)',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {!isToday ? periodLabel : 'Дата'}
        </button>
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid rgba(141,198,63,0.2)',
              borderTopColor: C,
              animation: 'evSpin 0.8s linear infinite',
            }}
          />
        </div>
      ) : !stats ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
          }}
        >
          <div style={{ color: TEXT2, fontSize: 15 }}>Нет данных</div>
        </div>
      ) : (
        <>
          {/* Water forecast */}
          <WaterForecastWidget />

          {/* Lent bottles card */}
          {lentData && (
            <div style={{ background: '#FFF8E7', borderRadius: 18, border: '1.5px solid #FFD87A', padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#E67700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Одолжено бутылок</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#E67700', lineHeight: 1 }}>{lentData.total}</div>
              <div style={{ fontSize: 11, color: '#E67700', marginTop: 2 }}>шт · {periodLabel}</div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#664400', marginBottom: 8 }}>Кто выдал:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['agent', 'Агент', lentData.by_agent], ['manager', 'Менеджер', lentData.by_manager], ['courier', 'Курьер', lentData.by_courier_creator], ['admin', 'Админ', lentData.by_admin]].map(([role, label, items]) => {
                    const count = lentData.by_role?.[role] || 0
                    if (count === 0) return null
                    return (
                      <button key={role} onClick={() => setLentRole(lentRole === role ? null : role)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid #FFD87A', background: lentRole === role ? '#E67700' : '#FFF3CD', color: lentRole === role ? '#fff' : '#664400', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {label}: {count}
                      </button>
                    )
                  })}
                </div>
                {lentRole && (() => {
                  const roleItems = { agent: lentData.by_agent, manager: lentData.by_manager, courier: lentData.by_courier_creator, admin: lentData.by_admin }[lentRole] || []
                  return (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {roleItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#FFF3CD', borderRadius: 10, padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600, color: '#664400' }}>{item.name}</span>
                          <span style={{ fontWeight: 800, color: '#E67700' }}>{item.lent} шт.</span>
                        </div>
                      ))}
                      {(lentData.delivery_by_courier?.length || 0) > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#664400', marginBottom: 6 }}>Кто доставил:</div>
                          {lentData.delivery_by_courier.map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#FFFBEE', borderRadius: 8, padding: '6px 10px', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, color: '#664400' }}>{d.courier_name}</span>
                              <span style={{ fontWeight: 700, color: '#E67700' }}>{d.lent} шт.</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Bottles card — debt only */}
          <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>Бутылки 19л</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: TEXT2, marginBottom: 4 }}>Долг</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color: (stats.bottle_debt_count || 0) > 0 ? '#E03131' : TEXT2, lineHeight: 1 }}>
                    {stats.bottle_debt_count ?? 0}
                  </span>
                  <span style={{ fontSize: 14, color: TEXT2, fontWeight: 500 }}>шт.</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: (stats.bottle_debt_value || 0) > 0 ? '#E03131' : TEXT2, marginTop: 4 }}>
                  {(stats.bottle_debt_value || 0) > 0 ? `${Math.round(stats.bottle_debt_value).toLocaleString('ru-RU')} сум` : '—'}
                </div>
              </div>
              {((stats.bottle_debt_clients || 0) > 0 || (stats.bottle_debt_couriers || 0) > 0 || (stats.bottle_debt_factories || 0) > 0) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {(stats.bottle_debt_clients || 0) > 0 && (
                    <div style={{ background: '#FFF5F5', borderRadius: 12, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#E03131', fontWeight: 600, marginBottom: 3 }}>Клиенты</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#E03131' }}>{stats.bottle_debt_clients}</div>
                      <div style={{ fontSize: 10, color: '#E03131' }}>шт.</div>
                    </div>
                  )}
                  {(stats.bottle_debt_couriers || 0) > 0 && (
                    <div style={{ background: '#FFF5F5', borderRadius: 12, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#E03131', fontWeight: 600, marginBottom: 3 }}>Курьеры</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#E03131' }}>{stats.bottle_debt_couriers}</div>
                      <div style={{ fontSize: 10, color: '#E03131' }}>шт.</div>
                    </div>
                  )}
                  {(stats.bottle_debt_factories || 0) > 0 && (
                    <div style={{ background: '#F8EBFC', borderRadius: 12, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#9C36B5', fontWeight: 600, marginBottom: 3 }}>Заводы</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#9C36B5' }}>{stats.bottle_debt_factories}</div>
                      <div style={{ fontSize: 10, color: '#9C36B5' }}>шт.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Revenue card — immediately after bottles */}
          <RevenueContext stats={stats} revenueLabel={revenueLabel} />

          {/* Courier sales card */}
          {(() => {
            const surchargeRow = (stats.bottles_surcharge_count || 0) > 0
              ? [{ name: 'Бутылка 19л', qty: stats.bottles_surcharge_count, total: stats.bottles_surcharge_total || 0, courier_earning: 0 }]
              : []
            const allRows = [...(stats.product_sales || []), ...surchargeRow]
            const totalQty = allRows.reduce((s, p) => s + p.qty, 0)
            const totalAmt = allRows.reduce((s, p) => s + p.total, 0)
            const totalEarning = allRows.reduce((s, p) => s + (p.courier_earning || 0), 0)
            return (
              <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Продажи курьеров</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {allRows.map((p, i) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < allRows.length - 1 ? `1px solid rgba(60,60,67,0.08)` : 'none' }}>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT2, flexShrink: 0 }}>{p.qty} шт.</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>{Math.round(p.total).toLocaleString('ru-RU')} сум</div>
                    </div>
                  ))}
                </div>
                <div style={{ paddingTop: 10, marginTop: 4, borderTop: `1.5px solid rgba(60,60,67,0.1)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: TEXT }}>Итого</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: CD }}>{totalQty} шт.</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: CD, minWidth: 80, textAlign: 'right' }}>{Math.round(totalAmt).toLocaleString('ru-RU')} сум</div>
                  </div>
                  {totalEarning > 0 && (
                    <div style={{ fontSize: 12, color: CD, fontWeight: 700, marginTop: 5 }}>
                      Заработок курьеров: +{Math.round(totalEarning).toLocaleString('ru-RU')} сум
                    </div>
                  )}
                </div>
                {(stats.bottles_returned || 0) > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid rgba(60,60,67,0.06)` }}>
                    <span style={{ fontSize: 12, color: CD, fontWeight: 600 }}>
                      Возврат 19л бутылок: {stats.bottles_returned} шт.
                    </span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Agent earnings card — orders created by agents only */}
          {(() => {
            const agentRows = stats.agent_sales || []
            if (agentRows.length === 0 && !agentPayoutStats) return null
            const totalQty = agentRows.reduce((s, p) => s + (p.qty || 0), 0)
            const totalAmt = agentRows.reduce((s, p) => s + (p.total || 0), 0)
            const totalAgentEarning = agentRows.reduce((s, p) => s + (p.agent_earning || 0), 0)
            const payStats = agentPayoutStats
            return (
              <AgentEarningsCard
                agentRows={agentRows} totalQty={totalQty} totalAmt={totalAmt}
                totalAgentEarning={totalAgentEarning} payStats={payStats}
              />
            )
          })()}

          {/* Manager sales card — orders created by managers only */}
          {(() => {
            const mgrRows = stats.manager_sales || []
            if (mgrRows.length === 0) return null
            const totalQty = mgrRows.reduce((s, p) => s + (p.qty || 0), 0)
            const totalAmt = mgrRows.reduce((s, p) => s + (p.total || 0), 0)
            return (
              <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Продажи менеджеров</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {mgrRows.map((p, i) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < mgrRows.length - 1 ? `1px solid rgba(60,60,67,0.08)` : 'none' }}>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT2, flexShrink: 0 }}>{p.qty} шт.</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>{Math.round(p.total).toLocaleString('ru-RU')} сум</div>
                    </div>
                  ))}
                </div>
                <div style={{ paddingTop: 10, marginTop: 4, borderTop: `1.5px solid rgba(60,60,67,0.1)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: TEXT }}>Итого</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: CD }}>{totalQty} шт.</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: CD, minWidth: 80, textAlign: 'right' }}>{Math.round(totalAmt).toLocaleString('ru-RU')} сум</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Bonus card */}
          <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16, display: 'flex', gap: 0 }}>
            <div style={{ flex: 1, paddingRight: 16, borderRight: `1px solid rgba(60,60,67,0.08)` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Начислено бонусов</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C, lineHeight: 1 }}>{Math.round(stats.bonus_earned || 0).toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>сум</div>
            </div>
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Использовано</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: CD, lineHeight: 1 }}>{Math.round(stats.bonus_used || 0).toLocaleString('ru-RU')}</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>сум скидки</div>
            </div>
          </div>

          {/* Key metrics grid */}
          {METRICS.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              {METRICS.map((m) => (
                <MetricCard key={m.key} metric={m} value={stats[m.key]} />
              ))}
            </div>
          )}

          {/* Cancelled card with expandable order list */}
          <CancelledCard count={stats.cancelled} dateParams={dateParams} />

          {/* Deleted orders card */}
          <DeletedCard count={stats.deleted || 0} dateParams={dateParams} />

          {/* Customer classification cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke={CD} strokeWidth="1.8"/>
                  <path d="M4 20C4 17 7.6 15 12 15s8 2 8 5" stroke={CD} strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M18 5l1.5 1.5L22 4" stroke={CD} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: CD, lineHeight: 1 }}>{stats.permanent_customers || 0}</div>
              <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, lineHeight: 1.3 }}>Постоянных клиентов</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F1F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#868E96" strokeWidth="1.8"/>
                  <path d="M4 20C4 17 7.6 15 12 15s8 2 8 5" stroke="#868E96" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M19 9v4M19 16h.01" stroke="#868E96" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#868E96', lineHeight: 1 }}>{stats.inactive_customers || 0}</div>
              <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, lineHeight: 1.3 }}>Не активных клиентов</div>
            </div>
          </div>

          {/* Extended analytics (admin-only) */}
          {showExtended && extStats && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginTop: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 16 }}>Расширенная аналитика</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Прибыль</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2B8A3E' }}>{extStats.profit?.toLocaleString()} сум</div>
                </div>
                <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>LTV клиента</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: CD }}>{Math.round(extStats.ltv || 0).toLocaleString()} сум</div>
                </div>
                <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Бонусов у клиентов</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C }}>{Math.round(extStats.bonus_load || 0).toLocaleString()} сум</div>
                </div>
                <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Новых клиентов</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C }}>{extStats.new_users ?? 0}</div>
                  {extStats.growth_pct != null && (
                    <div style={{ fontSize: 12, color: extStats.growth_pct >= 0 ? '#2B8A3E' : '#E03131', fontWeight: 600, marginTop: 2 }}>
                      {extStats.growth_pct >= 0 ? '+' : ''}{extStats.growth_pct}% vs пред. период
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: TEXT2 }}>Всего клиентов в базе: {extStats.total_users}</div>
            </div>
          )}

          {/* Debt adjustments log */}
          {debtAdj.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginTop: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0077B6', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Изменения долга бутылок</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {debtAdj.map((a, i) => {
                  const roleLabel = { warehouse: 'Склад', admin: 'Админ', manager: 'Менеджер' }[a.performed_by_role] || a.performed_by_role || '?'
                  const typeLabel = a.target_type === 'courier' ? 'Курьер' : 'Клиент'
                  const dt = a.created_at ? new Date(a.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                  return (
                    <div key={a.id} style={{ padding: '8px 0', borderBottom: i < debtAdj.length - 1 ? '1px solid rgba(60,60,67,0.07)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: TEXT2 }}>{roleLabel}</span> {a.performed_by || '—'} → <span style={{ color: '#0077B6' }}>{typeLabel}</span> {a.target_name || '—'}
                          </div>
                          {a.note && <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{a.note}</div>}
                          <div style={{ fontSize: 10, color: TEXT2, marginTop: 1 }}>{dt}</div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: a.delta > 0 ? '#E03131' : '#2B8A3E', flexShrink: 0 }}>
                          {a.delta > 0 ? `+${a.delta}` : a.delta} бут.
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sold-bottle adjustments log */}
          {soldAdj.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginTop: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0077B6', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Изменения проданных бутылок</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {soldAdj.map((a, i) => {
                  const roleLabel = { warehouse: 'Склад', admin: 'Админ', manager: 'Менеджер' }[a.performed_by_role] || a.performed_by_role || '?'
                  const dt = a.created_at ? new Date(a.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                  return (
                    <div key={a.id} style={{ padding: '8px 0', borderBottom: i < soldAdj.length - 1 ? '1px solid rgba(60,60,67,0.07)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: TEXT2 }}>{roleLabel}</span> {a.performed_by || '—'} → <span style={{ color: '#0077B6' }}>Курьер</span> {a.target_name || '—'}
                          </div>
                          {a.note && <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{a.note}</div>}
                          <div style={{ fontSize: 10, color: TEXT2, marginTop: 1 }}>{dt}</div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: a.delta > 0 ? '#0077B6' : '#2B8A3E', flexShrink: 0 }}>
                          {a.delta > 0 ? `+${a.delta}` : a.delta} бут.
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
