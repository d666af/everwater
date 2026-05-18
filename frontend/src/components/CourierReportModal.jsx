import { useState } from 'react'
import { getCourierReport, getCourierReportPdfUrl } from '../api'

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

  const downloadPdf = () => {
    const url = getCourierReportPdfUrl(courierId, dateFrom, dateTo)
    const a = document.createElement('a')
    a.href = url; a.download = `courier_${courierId}_${dateFrom}_${dateTo}.pdf`
    a.click()
  }

  const payLabel = { cash: 'Нал.', card: 'Карта', online: 'Онлайн' }

  const periodLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`

  const totalReturnedFromClients = (data?.orders || []).reduce((s, o) => s + (o.return_bottles || 0), 0)
  const hasWarehouse = (data?.warehouse_received || []).length > 0
  const hasBottleReturns = (data?.bottle_returns_in_period || []).length > 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Отчёт курьера</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>{courierName}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F2F2F7', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 18, cursor: 'pointer', color: TEXT2 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

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
              {/* KPI: Заработано + Доставок */}
              <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, display: 'flex' }}>
                <div style={{ flex: 1, padding: '14px 16px', borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Заработано</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: CD, lineHeight: 1 }}>
                    {Number(Math.round(data.total_earned || 0)).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>сум · {periodLabel}</div>
                </div>
                <div style={{ flex: 1, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Доставок</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: TEXT, lineHeight: 1 }}>{data.deliveries ?? 0}</div>
                  <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>{periodLabel}</div>
                </div>
              </div>

              {/* Extra KPIs: revenue, rating */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: '#F8F9FA', borderRadius: 12, padding: '10px 12px', border: `1px solid ${BORDER}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TEXT, lineHeight: 1 }}>{Math.round((data.total_revenue || 0) / 1000)}к</div>
                  <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>Выручка (сум)</div>
                </div>
                {data.avg_rating != null && (
                  <div style={{ flex: 1, background: '#FFFBEE', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(230,119,0,0.15)', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#E67700', lineHeight: 1 }}>{data.avg_rating} ⭐</div>
                    <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>Рейтинг</div>
                  </div>
                )}
                {(data.total_delivery_revenue || 0) > 0 && (
                  <div style={{ flex: 1, background: '#EBF4FF', borderRadius: 12, padding: '10px 12px', border: '1px solid #BFDBFE', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1971C2', lineHeight: 1 }}>{data.paid_delivery_orders || 0}</div>
                    <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>Платных дост.</div>
                  </div>
                )}
              </div>

              {/* Транзакции склада */}
              {(hasWarehouse || hasBottleReturns) && (
                <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Транзакции склада</span>
                    <span style={{ fontSize: 11, color: TEXT2 }}>{periodLabel}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {data.warehouse_received.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M5 12h14M14 6l6 6-6 6" stroke={C} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 500 }}>{item.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.quantity} шт.</span>
                        {item.total > 0 && <span style={{ fontSize: 12, color: TEXT2 }}>{Number(item.total).toLocaleString()} сум</span>}
                      </div>
                    ))}
                    {hasBottleReturns && data.bottle_returns_in_period.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: hasWarehouse ? `1px solid ${BORDER}` : 'none', borderBottom: 'none' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M19 12H5M10 18l-6-6 6-6" stroke={TEXT2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span style={{ flex: 1, fontSize: 13, color: TEXT, fontWeight: 500 }}>{item.name} · возврат тары</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{item.quantity} шт.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Возвращённые бутылки от клиентов */}
              {totalReturnedFromClients > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(18,184,134,0.25)', borderLeft: '3px solid #12B886', padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0CA678', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Возвращённые бутылки</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>Получено от клиентов</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#12B886' }}>+{totalReturnedFromClients} шт.</span>
                  </div>
                </div>
              )}

              {/* Download button */}
              <button onClick={downloadPdf}
                style={{ width: '100%', padding: '11px', borderRadius: 12, border: `1.5px solid ${C}`, background: '#EBFBEE', color: CD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Скачать PDF
              </button>

              {/* Orders history */}
              {data.orders?.length > 0 ? (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    История доставок ({data.orders.length}) · {periodLabel}
                  </div>
                  <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, padding: '0 16px' }}>
                    {data.orders.map((o, i) => {
                      const isCash = o.payment_method === 'cash'
                      const dt = o.delivered_at_iso ? new Date(new Date(o.delivered_at_iso).getTime() + 5 * 60 * 60 * 1000) : null
                      const timeStr = dt ? dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
                      const dateStr = dt ? dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''
                      const orderItems = (o.items || []).filter(it => it.quantity > 0)
                      return (
                        <div key={o.order_id} style={{ padding: '11px 0', borderBottom: i < data.orders.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flexShrink: 0, color: TEXT2 }}>
                              {isCash
                                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 7v10M9 9.5C9 8.12 10.34 7 12 7s3 1.12 3 2.5S13.66 12 12 12s-3 1.12-3 2.5S10.34 17 12 17s3-1.12 3-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/></svg>
                                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M2 10h20M6 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</div>
                              <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{dateStr}{dateStr && timeStr ? ' · ' : ''}{timeStr} · {isCash ? 'Наличные' : 'Карта'}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{Number(o.total).toLocaleString()} сум</div>
                              {o.rating != null && <div style={{ fontSize: 11, color: '#E67700' }}>{'★'.repeat(o.rating)}{'☆'.repeat(5 - o.rating)}</div>}
                            </div>
                          </div>
                          {(orderItems.length > 0 || o.return_bottles > 0) && (
                            <div style={{ marginTop: 6, paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {orderItems.map((it, j) => (
                                <div key={j} style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 4 }}>
                                  <span style={{ color: '#E03131', fontWeight: 700 }}>−{it.quantity} шт.</span>
                                  <span>{it.name}{it.volume > 0 ? ` ${it.volume.toFixed(0)}л` : ''}</span>
                                </div>
                              ))}
                              {o.return_bottles > 0 && (
                                <div style={{ fontSize: 12, color: TEXT2, display: 'flex', gap: 4 }}>
                                  <span style={{ color: '#12B886', fontWeight: 700 }}>+{o.return_bottles} шт.</span>
                                  <span>Возврат бутылок</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
