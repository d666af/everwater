import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { courierAccept, courierInDelivery } from '../../api'

const SAMARKAND_LAT = 39.6547
const SAMARKAND_LNG = 66.9758
const LEAFLET_CSS   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

const C      = '#8DC63F'
const CD     = '#6CA32F'
const TEXT   = '#1C1C1E'
const TEXT2  = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

// confirmed + assigned_to_courier → same orange (both are "Ожидает")
const STATUS_COLOR = {
  confirmed:           '#E67700',
  assigned_to_courier: '#E67700',
  in_delivery:         '#1971C2',
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function makeIcon(L, status) {
  const color = STATUS_COLOR[status] || '#888'
  return L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
    className: '', iconSize: [28, 28], iconAnchor: [14, 28],
  })
}

function fitOrders(map, L, orders) {
  if (!orders.length) return
  try {
    map.fitBounds(L.latLngBounds(orders.map(o => [o.latitude, o.longitude])),
      { padding: [30, 30], maxZoom: 15 })
  } catch (_) {}
}

/* ─── Small non-interactive preview ─────────────────────────────────────── */
function PreviewMap({ orders, onClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then(L => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, {
        zoomControl: false, dragging: false, touchZoom: false,
        scrollWheelZoom: false, doubleClickZoom: false,
        keyboard: false, attributionControl: false,
      }).setView([SAMARKAND_LAT, SAMARKAND_LNG], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
    })
    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.L) return
    const L = window.L
    map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer) })
    const pts = orders.filter(o => o.latitude && o.longitude)
    pts.forEach(o => L.marker([o.latitude, o.longitude], { icon: makeIcon(L, o.status), interactive: false }).addTo(map))
    fitOrders(map, L, pts)
  }, [orders])

  const withCoords = orders.filter(o => o.latitude && o.longitude)

  return (
    <div onClick={onClick} style={{
      position: 'relative', height: 108, borderRadius: 16, overflow: 'hidden',
      cursor: 'pointer', border: `1.5px solid ${BORDER}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12,
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 800 }} />
      <div style={{
        position: 'absolute', bottom: 8, left: 8, zIndex: 900, pointerEvents: 'none',
        background: 'rgba(28,28,30,0.72)', backdropFilter: 'blur(5px)',
        borderRadius: 10, padding: '4px 10px',
        fontSize: 12, fontWeight: 700, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="currentColor"/>
        </svg>
        {withCoords.length > 0 ? `${orders.length} заказов · открыть карту` : 'Карта заказов'}
      </div>
      <div style={{
        position: 'absolute', bottom: 8, right: 8, zIndex: 900, pointerEvents: 'none',
        background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '4px 5px',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke={TEXT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

/* ─── Full-screen map ────────────────────────────────────────────────────── */
function FullOrdersMap({ orders, onAction, onDeliverConfirm, actionLoading, onClose }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then(L => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, { zoomControl: true })
        .setView([SAMARKAND_LAT, SAMARKAND_LNG], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 150)

      const pts = orders.filter(o => o.latitude && o.longitude)
      pts.forEach(o => {
        L.marker([o.latitude, o.longitude], { icon: makeIcon(L, o.status) })
          .on('click', () => setSelected(o))
          .addTo(map)
      })
      fitOrders(map, L, pts)
    })
    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, []) // eslint-disable-line

  const noCoords = orders.filter(o => !o.latitude || !o.longitude).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500 }}>
      <style>{`@keyframes sheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9600,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)',
        boxShadow: '0 1px 10px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px 10px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Карта заказов</div>
          {noCoords > 0 && (
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{noCoords} без координат — не на карте</div>
          )}
        </div>
        {/* Legend: 2 statuses only */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {[
            ['#E67700', 'Ожидает'],
            ['#1971C2', 'В пути'],
          ].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11, color: TEXT2, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: '#F2F2F7', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke={TEXT} strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Order count pill */}
      {orders.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 24, right: 14, zIndex: 9600,
          background: `linear-gradient(135deg,${C},${CD})`,
          borderRadius: 20, padding: '8px 14px',
          fontSize: 12, fontWeight: 800, color: '#fff',
          boxShadow: '0 3px 12px rgba(80,140,20,0.3)',
        }}>
          {orders.length} активных
        </div>
      )}

      {selected && (
        <OrderSheet
          order={selected}
          onClose={() => setSelected(null)}
          onAction={onAction}
          onDeliverConfirm={onDeliverConfirm}
          actionLoading={actionLoading}
          onActionDone={() => { setSelected(null); onClose() }}
        />
      )}
    </div>
  )
}

/* ─── Order detail bottom sheet ─────────────────────────────────────────── */
function OrderSheet({ order, onClose, onAction, onDeliverConfirm, actionLoading, onActionDone }) {
  const isWaiting  = ['confirmed', 'assigned_to_courier'].includes(order.status)
  const scColor    = isWaiting ? '#E67700' : '#1971C2'
  const scBg       = isWaiting ? '#FFF3BF' : '#E7F5FF'
  const scLabel    = isWaiting ? 'Ожидает'  : 'В пути'

  const total      = Number(order.total || 0)
  const isCash     = order.payment_method === 'cash'
  const hasItems   = order.items?.length > 0
  const surcharge  = order.bottle_surcharge || 0
  const returnQty  = order.return_bottles_count || 0
  const hasSurcharge = surcharge > 0

  // Missing bottles count for surcharge line
  const qty20l  = (order.items || []).filter(i => (i.volume || 0) >= 18.9).reduce((s, i) => s + i.quantity, 0)
  const missing = Math.max(0, qty20l - returnQty)

  const payLabel = isCash ? 'Получить наличными' : 'Оплата картой'

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 9700,
      background: '#fff', borderRadius: '20px 20px 0 0',
      padding: '10px 20px max(32px, env(safe-area-inset-bottom, 32px))',
      boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
      animation: 'sheetUp 0.22s cubic-bezier(0.4,0,0.2,1)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px' }} />

      {/* Status + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: scColor, background: scBg, borderRadius: 7, padding: '3px 9px' }}>
          {scLabel}
        </span>
        <button onClick={onClose} style={{
          width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: '#F2F2F7', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* 📍 Address */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>📍</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, lineHeight: 1.4 }}>{order.address}</div>
          {order.extra_info && <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.3, marginTop: 2 }}>{order.extra_info}</div>}
        </div>
      </div>

      {/* 👤 Phone */}
      {order.recipient_phone && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <a href={`tel:${order.recipient_phone}`}
            style={{ fontSize: 14, fontWeight: 600, color: '#1971C2', textDecoration: 'none' }}>
            {order.recipient_phone}
          </a>
        </div>
      )}

      {/* Items */}
      {hasItems && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 }}>
            {hasSurcharge ? 'Состав:' : 'Доставить:'}
          </div>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: TEXT2, fontSize: 13, flexShrink: 0 }}>•</span>
              <span style={{ flex: 1, fontSize: 13, color: TEXT }}>
                {item.product_name} {item.quantity} шт.
              </span>
              {hasSurcharge && item.price > 0 && (
                <span style={{ fontSize: 13, color: TEXT2, fontWeight: 600, flexShrink: 0 }}>
                  — {Number(item.price * item.quantity).toLocaleString()} сум
                </span>
              )}
            </div>
          ))}
          {hasSurcharge && missing > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: '#E03131', fontSize: 13, flexShrink: 0 }}>•</span>
              <span style={{ flex: 1, fontSize: 13, color: '#C92A2A', fontWeight: 600 }}>
                Невозвращённые бутылки {missing} шт.
              </span>
              <span style={{ fontSize: 13, color: '#E03131', fontWeight: 700, flexShrink: 0 }}>
                — +{Number(surcharge).toLocaleString()} сум
              </span>
            </div>
          )}
        </div>
      )}

      {/* ♻️ Return bottles */}
      {returnQty > 0 && (
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0CA678' }}>
          ♻️ Забрать пустых бутылок: {returnQty} шт.
        </div>
      )}

      {/* Payment / total */}
      {hasSurcharge ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Итого</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: CD }}>
            {total.toLocaleString()} сум
            <span style={{ fontSize: 11, color: TEXT2, fontWeight: 500, marginLeft: 5 }}>
              ({isCash ? 'наличные' : 'карта'})
            </span>
          </span>
        </div>
      ) : total > 0 ? (
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
          {isCash ? '💵' : '💳'} {payLabel}:{' '}
          <span style={{ color: CD }}>{total.toLocaleString()} сум</span>
        </div>
      ) : null}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {order.status === 'confirmed' && (
          <button disabled={actionLoading}
            onClick={() => { onAction(courierAccept, order.id); onActionDone() }}
            style={{ ...btnSt, background: `linear-gradient(135deg,${C},${CD})` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Принял заказ
          </button>
        )}
        {order.status === 'assigned_to_courier' && (
          <button disabled={actionLoading}
            onClick={() => { onAction(courierInDelivery, order.id); onActionDone() }}
            style={{ ...btnSt, background: 'linear-gradient(135deg,#1C7ED6,#1864AB)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="1.6"/><path d="M5 18H3V10l4-5h9l3 5v3M7 18h10M14 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Выехал
          </button>
        )}
        {order.status === 'in_delivery' && (
          <button disabled={actionLoading}
            onClick={() => { onDeliverConfirm(order); onActionDone() }}
            style={{ ...btnSt, background: `linear-gradient(135deg,${C},${CD})` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Доставлено
          </button>
        )}
        {order.latitude && (
          <a href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 48, borderRadius: 14, background: '#111827',
              color: '#fff', textDecoration: 'none', flexShrink: 0,
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
          </a>
        )}
      </div>
    </div>
  )
}

const btnSt = {
  flex: 1, padding: '13px 0', border: 'none', borderRadius: 14,
  color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
}

/* ─── Main export ────────────────────────────────────────────────────────── */
export default function CourierOrdersMap({ orders, onAction, onDeliverConfirm, actionLoading }) {
  const [fullOpen, setFullOpen] = useState(false)

  const activeOrders = orders.filter(o =>
    ['confirmed', 'assigned_to_courier', 'in_delivery'].includes(o.status)
  )

  return (
    <>
      <PreviewMap orders={activeOrders} onClick={() => setFullOpen(true)} />
      {fullOpen && createPortal(
        <FullOrdersMap
          orders={activeOrders}
          onAction={onAction}
          onDeliverConfirm={onDeliverConfirm}
          actionLoading={actionLoading}
          onClose={() => setFullOpen(false)}
        />,
        document.body
      )}
    </>
  )
}
