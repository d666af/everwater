import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminStats } from '../../api'

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
    key: 'order_count',
    label: 'Заказов доставлено',
    color: '#2B8A3E',
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke={c} strokeWidth="1.8" />
        <path d="M7 9h10M7 13h6" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'revenue',
    label: 'Выручка',
    color: C,
    format: (v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)),
    subtitle: (v) => `${v.toLocaleString('ru-RU')} сум`,
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke={c} strokeWidth="1.8" />
        <path d="M2 10h20M8 15h3m5 0h-2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'avg_check',
    label: 'Средний чек',
    color: '#1971C2',
    format: (v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(Math.round(v))),
    subtitle: (v) => `${Math.round(v).toLocaleString('ru-RU')} сум`,
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
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
    key: 'bottles_returned',
    label: 'Возврат бутылок',
    color: '#12B886',
    icon: (c) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 3v5h5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

  return (
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
    </div>
  )
}

export default function ManagerStats() {
  const [period, setPeriod] = useState('day')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAdminStats(period)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  const byStatusTotal =
    stats?.by_status
      ? Object.values(stats.by_status).reduce((a, b) => a + b, 0)
      : 0

  return (
    <ManagerLayout title="Статистика">
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
        </>
      )}
    </ManagerLayout>
  )
}
