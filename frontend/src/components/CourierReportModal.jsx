import { useState } from 'react'
import { getCourierReport, getCourierReportCsvUrl } from '../api'

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
  { label: 'Сегодня',  from: today(),    to: today() },
  { label: '7 дней',   from: daysAgo(6), to: today() },
  { label: '30 дней',  from: daysAgo(29),to: today() },
  { label: 'Этот мес.', from: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` })(), to: today() },
]

export default function CourierReportModal({ courierId, courierName, onClose }) {
  const [dateFrom, setDateFrom] = useState(daysAgo(29))
  const [dateTo, setDateTo]     = useState(today())
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [loaded, setLoaded]     = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCourierReport(courierId, dateFrom, dateTo)
      setData(res)
      setLoaded(true)
    } catch { }
    setLoading(false)
  }

  const downloadCsv = () => {
    const url = getCourierReportCsvUrl(courierId, dateFrom, dateTo)
    const a = document.createElement('a')
    a.href = url; a.download = `courier_${courierId}_${dateFrom}_${dateTo}.csv`
    a.click()
  }

  const payLabel = { cash: 'Нал.', card: 'Карта', online: 'Онлайн' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>📊 Отчёт</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{courierName}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: TEXT2 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Period presets */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button key={p.label}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${dateFrom === p.from && dateTo === p.to ? C : BORDER}`, background: dateFrom === p.from && dateTo === p.to ? '#EBFBEE' : '#fff', color: dateFrom === p.from && dateTo === p.to ? CD : TEXT2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); setLoaded(false) }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="date" value={dateFrom} max={dateTo}
              onChange={e => { setDateFrom(e.target.value); setLoaded(false) }}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 13, color: TEXT }} />
            <span style={{ color: TEXT2, fontSize: 13 }}>—</span>
            <input type="date" value={dateTo} min={dateFrom}
              onChange={e => { setDateTo(e.target.value); setLoaded(false) }}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 13, color: TEXT }} />
          </div>

          {/* Load button */}
          <button onClick={load} disabled={loading}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Загрузка...' : 'Показать'}
          </button>

          {/* Results */}
          {loaded && data && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  [data.deliveries, 'Доставок'],
                  [`${Math.round((data.total_revenue || 0) / 1000)}к`, 'Выручка (сум)'],
                  [data.avg_rating != null ? `${data.avg_rating}⭐` : '—', 'Рейтинг'],
                ].map(([v, l]) => (
                  <div key={l} style={{ flex: 1, background: '#F8F9FA', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>{v}</div>
                    <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Download button */}
              <button onClick={downloadCsv}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: `1.5px solid ${C}`, background: '#EBFBEE', color: CD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ⬇️ Скачать CSV
              </button>

              {/* Orders table */}
              {data.orders?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Доставки ({data.orders.length})
                  </div>
                  {data.orders.map(o => (
                    <div key={o.order_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: TEXT2, background: '#F2F2F7', padding: '3px 8px', borderRadius: 7, flexShrink: 0 }}>#{o.order_id}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</div>
                        <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>
                          {o.delivered_at}
                          {o.return_bottles > 0 && ` · ♻ ${o.return_bottles} бут.`}
                          {o.rating !== '—' && ` · ${o.rating}⭐`}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{(o.total || 0).toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: TEXT2 }}>{payLabel[o.payment_method] || o.payment_method}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: TEXT2, fontSize: 14, padding: '20px 0' }}>Нет доставок за этот период</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
