import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminStats, getAdminStatsExtended } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.08)'

const PERIODS = [
  { key: 'day', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
]

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

const METRICS = [
  {
    key: 'repeat_customers',
    label: 'Повторных клиентов',
    color: '#6741D9',
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8" />
        <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'cancelled',
    label: 'Отменено',
    color: '#E03131',
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.8" />
        <path d="M15 9L9 15M9 9l6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

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

function StatusBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 140,
          fontSize: 13,
          color: TEXT,
          fontWeight: 500,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 10,
          background: BG,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 999,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: count > 0 ? 4 : 0,
          }}
        />
      </div>
      <div
        style={{
          minWidth: 60,
          textAlign: 'right',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'flex-end',
          gap: 3,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 14, color }}>{count}</span>
        <span style={{ fontWeight: 400, fontSize: 11, color: TEXT2 }}>{pct}%</span>
      </div>
    </div>
  )
}

function RevenueContext({ stats, period }) {
  if (!stats || !stats.revenue) return null

  const periodLabel =
    period === 'day' ? 'за сегодня' : period === 'week' ? 'за неделю' : 'за месяц'

  const avgPerOrder =
    stats.order_count > 0
      ? Math.round(stats.revenue / stats.order_count).toLocaleString('ru-RU')
      : '—'

  const warehouseRows = stats.warehouse_sales || []
  const warehouseTotalQty = warehouseRows.reduce((s, r) => s + r.qty, 0)
  const warehouseTotalCost = warehouseRows.reduce((s, r) => s + r.cost, 0)
  const hasWarehouseSales = warehouseRows.length > 0

  return (
    <>
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          marginTop: 12,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 14 }}>
          Выручка {periodLabel}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 800, color: TEXT }}>
            {stats.revenue.toLocaleString('ru-RU')}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT2 }}>сум</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: GRAD,
            marginBottom: 12,
            opacity: 0.7,
          }}
        />
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: TEXT2, marginBottom: 2 }}>Заказов</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>
              {stats.order_count ?? '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: TEXT2, marginBottom: 2 }}>Средний на заказ</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{avgPerOrder} сум</div>
          </div>
          {stats.cancelled > 0 && (
            <div>
              <div style={{ fontSize: 11, color: TEXT2, marginBottom: 2 }}>Потеряно (отмены)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#E03131' }}>
                {stats.cancelled}
              </div>
            </div>
          )}
        </div>

        {hasWarehouseSales && (
          <>
            <div style={{ height: 1, background: 'rgba(60,60,67,0.1)', margin: '16px -20px 14px' }} />
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1971C2', flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
                    {item.cost > 0 ? `${Math.round(item.cost).toLocaleString('ru-RU')} сум` : '—'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 4, borderTop: '1.5px solid rgba(60,60,67,0.1)' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: TEXT }}>Итого</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1971C2' }}>{warehouseTotalQty} шт.</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#1971C2', minWidth: 90, textAlign: 'right' }}>
                {Math.round(warehouseTotalCost).toLocaleString('ru-RU')} сум
              </div>
            </div>
            {(stats.bottles_returned_to_warehouse || 0) > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(60,60,67,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>↩</span>
                <span style={{ fontSize: 12, color: '#1971C2', fontWeight: 600 }}>
                  Возврат 19л бутылок: {stats.bottles_returned_to_warehouse} шт.
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {(stats.delivery_revenue > 0 || stats.delivery_orders_count > 0) && (
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            marginTop: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 14 }}>
            🚚 Доставка {periodLabel}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '12px 16px', flex: 1 }}>
              <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Выручка с доставки</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1971C2' }}>
                {(stats.delivery_revenue || 0).toLocaleString('ru-RU')} сум
              </div>
            </div>
            <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '12px 16px', flex: 1 }}>
              <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Платных доставок</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#6741D9' }}>
                {stats.delivery_orders_count ?? 0}
              </div>
            </div>
            <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '12px 16px', flex: 1 }}>
              <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Бесплатных</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#12B886' }}>
                {stats.free_delivery_count ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ManagerStats({ Layout = ManagerLayout, title = 'Статистика', showExtended = false }) {
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [extStats, setExtStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const calls = [getAdminStats(period).then(setStats).catch(console.error)]
    if (showExtended) calls.push(getAdminStatsExtended(period).then(setExtStats).catch(console.error))
    Promise.all(calls).finally(() => setLoading(false))
  }, [period, showExtended])

  const byStatusTotal =
    stats?.by_status
      ? Object.values(stats.by_status).reduce((a, b) => a + b, 0)
      : 0

  return (
    <Layout title={title}>
      {/* Keyframes for spinner */}
      <style>{`@keyframes evSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Period segmented control */}
      <div
        style={{
          display: 'flex',
          background: '#fff',
          borderRadius: 18,
          padding: 4,
          marginBottom: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        {PERIODS.map((p) => {
          const active = period === p.key
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: 12,
                border: 'none',
                background: active ? GRAD : 'none',
                color: active ? '#fff' : TEXT2,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: active ? '0 2px 10px rgba(141,198,63,0.4)' : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {p.label}
            </button>
          )
        })}
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
              {((stats.bottle_debt_clients || 0) > 0 || (stats.bottle_debt_couriers || 0) > 0) && (
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
                </div>
              )}
            </div>
          </div>

          {/* Courier sales card */}
          {(stats.product_sales?.length > 0 || (stats.bottles_surcharge_count || 0) > 0) && (() => {
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
                    <div key={p.name} style={{ padding: '8px 0', borderBottom: i < allRows.length - 1 ? `1px solid rgba(60,60,67,0.08)` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: TEXT, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT2, flexShrink: 0 }}>{p.qty} шт.</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>{Math.round(p.total).toLocaleString('ru-RU')} сум</div>
                      </div>
                      {(p.courier_earning || 0) > 0 && (
                        <div style={{ fontSize: 11, color: '#6741D9', fontWeight: 600, marginTop: 3 }}>
                          заработок: +{Math.round(p.courier_earning).toLocaleString('ru-RU')} сум
                        </div>
                      )}
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
                    <div style={{ fontSize: 12, color: '#6741D9', fontWeight: 700, marginTop: 5 }}>
                      Заработок курьеров: +{Math.round(totalEarning).toLocaleString('ru-RU')} сум
                    </div>
                  )}
                </div>
                {(stats.bottles_returned || 0) > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid rgba(60,60,67,0.06)`, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>↩</span>
                    <span style={{ fontSize: 12, color: '#12B886', fontWeight: 600 }}>
                      Возврат 19л бутылок: {stats.bottles_returned} шт.
                    </span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Bonus card */}
          {(stats.bonus_earned > 0 || stats.bonus_used > 0) && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16, display: 'flex', gap: 0 }}>
              <div style={{ flex: 1, paddingRight: 16, borderRight: `1px solid rgba(60,60,67,0.08)` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Начислено бонусов</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#E67700', lineHeight: 1 }}>{Math.round(stats.bonus_earned || 0).toLocaleString('ru-RU')}</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>сум</div>
              </div>
              <div style={{ flex: 1, paddingLeft: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Использовано</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#6741D9', lineHeight: 1 }}>{Math.round(stats.bonus_used || 0).toLocaleString('ru-RU')}</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>сум скидки</div>
              </div>
            </div>
          )}

          {/* Key metrics grid */}
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

          {/* Status breakdown card */}
          {stats.by_status && byStatusTotal > 0 && (
            <div
              style={{
                background: '#fff',
                borderRadius: 18,
                padding: '20px 20px 18px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 2 }}>
                Разбивка по статусам
              </div>
              {Object.entries(stats.by_status)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <StatusBar
                    key={status}
                    label={STATUS_LABELS[status] || status}
                    count={count}
                    total={byStatusTotal}
                    color={STATUS_COLORS[status] || TEXT2}
                  />
                ))}
            </div>
          )}

          {/* Revenue trend context card */}
          <RevenueContext stats={stats} period={period} />

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
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1971C2' }}>{Math.round(extStats.ltv || 0).toLocaleString()} сум</div>
                </div>
                <div style={{ background: '#f8f8fa', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: TEXT2, marginBottom: 4 }}>Бонусов у клиентов</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#E67700' }}>{Math.round(extStats.bonus_load || 0).toLocaleString()} сум</div>
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
        </>
      )}
    </Layout>
  )
}
