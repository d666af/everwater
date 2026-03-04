import { useEffect, useRef, useState } from 'react'

// Leaflet loaded from CDN to avoid npm install requirement
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

// Default center: Tashkent
const DEFAULT_LAT = 41.2995
const DEFAULT_LNG = 69.2401

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return }

    // CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }

    // JS
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
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map)

        // Custom green icon
        const icon = L.divIcon({
          html: `<div style="
            width:32px;height:32px;border-radius:50% 50% 50% 0;
            background:#2d6a4f;border:3px solid #fff;
            transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          className: '',
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
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить карту')
        setLoading(false)
      })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
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
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.topBar}>
          <div style={s.topTitle}>📍 Выберите место доставки</div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={s.hint}>Нажмите на карту или перетащите маркер</div>

        <div style={s.mapWrap}>
          {loading && <div style={s.loader}>Загрузка карты...</div>}
          {error && <div style={s.errorMsg}>{error}</div>}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <div style={s.actions}>
          <button style={s.myLocBtn} onClick={goToMe}>🎯 Моё местоположение</button>
          <button style={s.confirmBtn} onClick={onClose} disabled={!lat && !lng}>
            ✅ Подтвердить точку
          </button>
        </div>

        {lat && lng && (
          <div style={s.coords}>
            Координаты: {lat.toFixed(5)}, {lng.toFixed(5)}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    width: '100%', maxHeight: '92vh',
    background: '#fff', borderRadius: '20px 20px 0 0',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px 8px', flexShrink: 0,
  },
  topTitle: { fontWeight: 700, fontSize: 16, color: '#1b4332' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 20,
    cursor: 'pointer', color: '#888', padding: '4px 8px',
  },
  hint: { fontSize: 12, color: '#888', padding: '0 20px 8px', flexShrink: 0 },
  mapWrap: {
    flex: 1, minHeight: 320, position: 'relative',
    background: '#e8f5e9',
  },
  loader: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#f5faf7', zIndex: 10, fontSize: 14, color: '#888',
  },
  errorMsg: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#fff5f5', zIndex: 10, fontSize: 14, color: '#c62828',
  },
  actions: {
    display: 'flex', gap: 10, padding: '12px 16px 4px', flexShrink: 0,
  },
  myLocBtn: {
    flex: 1, padding: '11px 0', border: '2px solid #2d6a4f',
    borderRadius: 12, background: '#fff', color: '#2d6a4f',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  confirmBtn: {
    flex: 2, padding: '11px 0', border: 'none',
    borderRadius: 12, background: '#2d6a4f', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  coords: {
    textAlign: 'center', fontSize: 11, color: '#888',
    padding: '6px 0 12px', flexShrink: 0,
  },
}
