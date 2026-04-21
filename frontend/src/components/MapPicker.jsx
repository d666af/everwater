import { useEffect, useRef, useState, useCallback } from 'react'

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
  const searchTimeout = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  // Track pending coords — only applied on confirm
  const pendingRef = useRef({ lat: lat || DEFAULT_LAT, lng: lng || DEFAULT_LNG })

  const initLat = lat || DEFAULT_LAT
  const initLng = lng || DEFAULT_LNG

  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstanceRef.current) return
        setLoading(false)
        const map = L.map(mapRef.current, { zoomControl: true }).setView([initLat, initLng], 15)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '', maxZoom: 19,
        }).addTo(map)

        // Track map center but do NOT call onChange yet
        map.on('moveend', () => {
          const center = map.getCenter()
          pendingRef.current = { lat: center.lat, lng: center.lng }
        })

        mapInstanceRef.current = map
        setTimeout(() => map.invalidateSize(), 100)
        setTimeout(() => map.invalidateSize(), 400)
      })
      .catch(() => { if (!cancelled) setError('Не удалось загрузить карту'); setLoading(false) })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null }
    }
  }, []) // eslint-disable-line

  const doSearch = useCallback((query) => {
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=uz&limit=5&accept-language=ru`)
      .then(r => r.json())
      .then(results => {
        setSearchResults(results.map(r => ({
          name: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        })))
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }, [])

  const handleSearchInput = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(val), 500)
  }

  const selectResult = (result) => {
    setSearchQuery(result.name.split(',')[0])
    setSearchResults([])
    mapInstanceRef.current?.setView([result.lat, result.lng], 16)
  }

  const goToMe = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lt, longitude: ln } = pos.coords
      mapInstanceRef.current?.setView([lt, ln], 16)
    })
  }

  // Only save coordinates when user explicitly confirms
  const handleConfirm = () => {
    onChange(pendingRef.current.lat, pendingRef.current.lng)
    onClose()
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

        {/* Search bar */}
        <div style={s.searchWrap}>
          <div style={s.searchRow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" stroke="#8e8e93" strokeWidth="2"/>
              <path d="M20 20l-4-4" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              style={s.searchInput}
              placeholder="Поиск адреса..."
              value={searchQuery}
              onChange={handleSearchInput}
            />
            {searching && <span style={s.searchSpinner} />}
          </div>
          {searchResults.length > 0 && (
            <div style={s.searchResults}>
              {searchResults.map((r, i) => (
                <button key={i} style={s.searchItem} onClick={() => selectResult(r)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="#8DC63F"/>
                  </svg>
                  <span style={s.searchItemText}>{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={s.mapWrap}>
          {loading && <div style={s.loader}>Загрузка карты...</div>}
          {error && <div style={s.errMsg}>{error}</div>}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {/* Fixed center pin */}
          <div style={s.centerPin}>
            <div style={s.pinIcon} />
            <div style={s.pinShadow} />
          </div>
        </div>

        <div style={s.actions}>
          <button style={s.myLocBtn} onClick={goToMe}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="#8DC63F"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#8DC63F" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Моё место
          </button>
          <button style={s.confirmBtn} onClick={handleConfirm}>Подтвердить</button>
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
    width: '100%', height: '85vh',
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

  // Search
  searchWrap: {
    padding: '0 16px 8px', flexShrink: 0, position: 'relative',
  },
  searchRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#f2f2f7', borderRadius: 12, padding: '10px 12px',
  },
  searchInput: {
    border: 'none', background: 'transparent', flex: 1,
    fontSize: 14, color: '#1a1a1a', outline: 'none', fontFamily: 'inherit',
  },
  searchSpinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid #e5e5ea', borderTop: '2px solid #8DC63F',
    animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0,
  },
  searchResults: {
    position: 'absolute', left: 16, right: 16, top: '100%',
    background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    zIndex: 10, maxHeight: 200, overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
  },
  searchItem: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 14px', border: 'none', background: 'none',
    cursor: 'pointer', textAlign: 'left',
    borderBottom: '1px solid #f0f0f2',
  },
  searchItemText: {
    fontSize: 13, color: '#3c3c43', lineHeight: 1.3,
  },

  mapWrap: { flex: 1, minHeight: 350, position: 'relative', background: '#f0f0f0' },

  // Fixed center pin (always in the middle of the map)
  centerPin: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -100%)',
    zIndex: 500, pointerEvents: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  pinIcon: {
    width: 30, height: 30,
    borderRadius: '50% 50% 50% 0',
    background: '#8DC63F',
    border: '3px solid #fff',
    transform: 'rotate(-45deg)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  pinShadow: {
    width: 12, height: 4,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.15)',
    marginTop: 2,
  },

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
    flex: 1, padding: '12px 0', border: '1.5px solid #8DC63F',
    borderRadius: 12, background: '#fff', color: '#2e7d32',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  confirmBtn: {
    flex: 2, padding: '12px 0', border: 'none',
    borderRadius: 12, background: '#8DC63F', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
}
