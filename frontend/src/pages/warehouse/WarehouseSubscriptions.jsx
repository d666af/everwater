import { useEffect, useState, useCallback } from 'react'
import WarehouseLayout from '../../components/warehouse/WarehouseLayout'
import { getAdminSubscriptions, getWarehouseOverview } from '../../api'

const C = '#8DC63F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const PLAN_TABS = [
  { key: 'weekly', label: '📅 Еженедельные' },
  { key: 'monthly', label: '🗓 Ежемесячные' },
]

const WEEKDAY_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

function parseWaterSummary(summary) {
  const result = {}
  if (!summary) return result
  for (const part of summary.split(',')) {
    const m = part.trim().match(/(.+?)\s*[xхX×]\s*(\d+)/)
    if (m) result[m[1].trim()] = (result[m[1].trim()] || 0) + parseInt(m[2])
    else if (part.trim()) result[part.trim()] = (result[part.trim()] || 0) + 1
  }
  return result
}

export default function WarehouseSubscriptions() {
  const [plan, setPlan] = useState('weekly')
  const [subs, setSubs] = useState([])
  const [shortfallItems, setShortfallItems] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p) => {
    setLoading(true)
    try {
      const [data, overview] = await Promise.all([
        getAdminSubscriptions({ plan: p, status: 'active' }),
        getWarehouseOverview('week'),
      ])
      setSubs(data || [])
      setShortfallItems((overview?.shortfall_items || []).filter(it => it.qty > 0))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(plan) }, [plan, load])

  // Aggregate total water needed for this week (weekly subs)
  const weeklyTotals = {}
  if (plan === 'weekly') {
    subs.forEach(s => {
      const parsed = parseWaterSummary(s.water_summary)
      Object.entries(parsed).forEach(([name, qty]) => {
        weeklyTotals[name] = (weeklyTotals[name] || 0) + qty
      })
    })
  }

  const grouped = plan === 'weekly'
    ? WEEKDAY_ORDER.reduce((acc, day) => {
        const g = subs.filter(s => s.day === day)
        if (g.length) acc.push({ day, items: g })
        return acc
      }, [])
    : [{ day: null, items: subs }]

  return (
    <WarehouseLayout title="Подписки">
      <div style={{ padding: '16px 16px 80px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: TEXT, marginBottom: 14 }}>Подписки</div>

        {/* Shortfall alert */}
        {shortfallItems.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg,#FFE8E8,#FFF5F5)',
            border: '1.5px solid #FFB4B4', borderRadius: 14, padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#C92A2A', marginBottom: 6 }}>
              🔴 Нехватка товара для подписок:
            </div>
            {shortfallItems.map(it => (
              <div key={it.product_name} style={{ fontSize: 13, color: '#862020' }}>
                • {it.product_name} — не хватает {it.qty} шт.
              </div>
            ))}
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

        {/* Weekly totals */}
        {plan === 'weekly' && Object.keys(weeklyTotals).length > 0 && (
          <div style={{
            background: '#F0F9E8', border: `1px solid ${C}`, borderRadius: 14,
            padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: TEXT, marginBottom: 6 }}>
              📦 Нужно за эту неделю:
            </div>
            {Object.entries(weeklyTotals).sort().map(([name, qty]) => (
              <div key={name} style={{ fontSize: 13, color: TEXT }}>• {name} × {qty} шт.</div>
            ))}
          </div>
        )}

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
                <SubRow key={sub.id} sub={sub} />
              ))}
            </div>
          ))
        )}
      </div>
    </WarehouseLayout>
  )
}

function SubRow({ sub }) {
  const [expanded, setExpanded] = useState(false)
  const ndd = sub.next_delivery_date
  let dateLabel = '—'
  if (ndd) {
    try {
      const d = new Date(ndd)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      d.setHours(0, 0, 0, 0)
      if (d < today) dateLabel = `🔴 ${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
      else if (d.getTime() === today.getTime()) dateLabel = `⚡ Сегодня`
      else dateLabel = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    } catch { dateLabel = ndd.slice(0, 10) }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`,
      marginBottom: 8, overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
           onClick={() => setExpanded(e => !e)}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{sub.client_name || '—'}</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>💧 {sub.water_summary}</div>
        </div>
        <div style={{ fontSize: 12, color: sub.overdue ? '#FF3B30' : TEXT2, fontWeight: 600 }}>{dateLabel}</div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ paddingTop: 8, fontSize: 13, color: TEXT2 }}>
            <div>📍 {sub.address}</div>
            <div>📞 {sub.phone || '—'}</div>
            <div>📅 {sub.day || '—'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
