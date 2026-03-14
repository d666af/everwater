// Ever — inline SVG logo (no external network request, loads instantly)

function EverSVGFull({ width = 160 }) {
  const h = Math.round(width * 0.52)
  return (
    <svg width={width} height={h} viewBox="0 0 160 83" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      {/* Droplet icon */}
      <path d="M24 6C24 6 8 24 8 35C8 44.4 15.16 52 24 52C32.84 52 40 44.4 40 35C40 24 24 6 24 6Z" fill="#8DC63F"/>
      <path d="M24 6C24 6 8 24 8 35C8 44.4 15.16 52 24 52C32.84 52 40 44.4 40 35C40 24 24 6 24 6Z" fill="url(#drop_grad)"/>
      {/* Shine inside droplet */}
      <ellipse cx="19" cy="30" rx="3.5" ry="5" fill="rgba(255,255,255,0.35)" transform="rotate(-15 19 30)"/>
      {/* "ever" wordmark */}
      <text x="52" y="44" fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" fontWeight="900" fontSize="38" fill="#1C1C1E" letterSpacing="-2">ever</text>
      {/* Tagline */}
      <text x="52" y="63" fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" fontWeight="600" fontSize="13" fill="#8DC63F" letterSpacing="2.5">WATER</text>
      <defs>
        <linearGradient id="drop_grad" x1="24" y1="6" x2="24" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A8D85F"/>
          <stop offset="100%" stopColor="#6CA32F"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function EverSVGMark({ width = 48 }) {
  return (
    <svg width={width} height={width} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', borderRadius: 8 }}>
      <rect width="48" height="48" rx="10" fill="#EDF7D6"/>
      <path d="M24 7C24 7 11 21 11 30.5C11 37.4 16.9 43 24 43C31.1 43 37 37.4 37 30.5C37 21 24 7 24 7Z" fill="url(#mark_grad)"/>
      <ellipse cx="19.5" cy="27" rx="3" ry="5" fill="rgba(255,255,255,0.4)" transform="rotate(-15 19.5 27)"/>
      <defs>
        <linearGradient id="mark_grad" x1="24" y1="7" x2="24" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A8D85F"/>
          <stop offset="100%" stopColor="#6CA32F"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function EverLogo({ width = 160, style, ...props }) {
  return <EverSVGFull width={width} style={style} {...props} />
}

export function EverLogoMark({ width = 48, style, ...props }) {
  return <EverSVGMark width={width} style={style} {...props} />
}

export function EverLogoHorizontal({ height = 32, className = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className={className}>
      <EverSVGMark width={height} />
      <span style={{
        fontWeight: 900,
        fontSize: height * 0.7,
        color: '#1C1C1E',
        letterSpacing: -1,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        lineHeight: 1,
      }}>ever</span>
    </div>
  )
}
