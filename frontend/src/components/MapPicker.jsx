import { useEffect, useRef, useState } from 'react'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const DEFAULT_LAT = 41.2995
const DEFAULT_LNG = 69.2401

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

export default function MapPicker({ lat, lng, onChange, onClose }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const initLat = lat || DEFAULT_LAT
  const initLng = lng || DEFAULT_LNG

  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstanceRef.current) return
        setLoading(false)
        const map = L.map(mapRef.current, { zoomControl: true }).setView([initLat, initLng], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '', maxZoom: 19,
        }).addTo(map)

        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#4CAF50;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`,
          iconSize: [28, 28], iconAnchor: [14, 28], className: '',
        })
        const marker = L.marker([initLat, initLng], { draggable: true, icon }).addTo(map)
        markerRef.current = marker

        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng()
          onChange(lat, lng)
        })
        map.on('click', (e) => {
          marker.setLatLng(e.latlng)
          onChange(e.latlng.lat, e.latlng.lng)
        })
        mapInstanceRef.current = map
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить карту'); setLoading(false) })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    }
  }, [])

  const goToMe = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lt, longitude: ln } = pos.coords
      mapInstanceRef.current?.setView([lt, ln], 16)
      markerRef.current?.setLatLng([lt, ln])
      onChange(lt, ln)
    })
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.topBar}>
          <span style={s.topTitle}>Выберите место доставки</span>
          <button style={s.closeBtn} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#888" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={s.hint}>Нажмите на карту или перетащите маркер</div>

        <div style={s.mapWrap}>
          {loading && <div style={s.loader}>Загрузка карты...</div>}
          {error && <div style={s.errMsg}>{error}</div>}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <div style={s.actions}>
          <button style={s.myLocBtn} onClick={goToMe}>Моё местоположение</button>
          <button style={s.confirmBtn} onClick={onClose}>Подтвердить</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    width: '100%', maxHeight: '90vh',
    background: '#fff', borderRadius: '18px 18px 0 0',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    animation: 'slideUp 0.25s ease',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px 6px', flexShrink: 0,
  },
  topTitle: { fontWeight: 700, fontSize: 16, color: '#111' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center',
  },
  hint: { fontSize: 12, color: '#999', padding: '0 16px 8px', flexShrink: 0 },
  mapWrap: { flex: 1, minHeight: 320, position: 'relative', background: '#f0f0f0' },
  loader: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#f7f7f8', zIndex: 10, fontSize: 14, color: '#888',
  },
  errMsg: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#fff5f5', zIndex: 10, fontSize: 14, color: '#ef4444',
  },
  actions: { display: 'flex', gap: 8, padding: '12px 16px 16px', flexShrink: 0 },
  myLocBtn: {
    flex: 1, padding: '12px 0', border: '1.5px solid #4CAF50',
    borderRadius: 12, background: '#fff', color: '#2e7d32',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  confirmBtn: {
    flex: 2, padding: '12px 0', border: 'none',
    borderRadius: 12, background: '#4CAF50', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
}
