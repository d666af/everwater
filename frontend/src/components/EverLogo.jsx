/**
 * Accurate SVG recreation of the "ever" logo
 * Two swooping wing/leaf shapes meeting at center-bottom point
 * Left wing: large, upper-left to center-bottom
 * Right wing: smaller, center-bottom to upper-right
 */
export function EverLogoMark({ width = 120, className = '' }) {
  const h = Math.round(width * 0.72)
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 200 144"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* LEFT WING — large sweeping leaf from upper-left to center-bottom */}
      <path
        d="M 12 20
           C 44 4, 98 16, 112 80
           C 107 92, 102 100, 100 104
           C 86 82, 62 48, 30 26
           C 20 20, 12 22, 12 20 Z"
        fill="#8DC63F"
      />
      {/* RIGHT WING — smaller sweep from center-bottom to upper-right */}
      <path
        d="M 100 104
           C 116 82, 148 50, 178 24
           C 184 18, 188 14, 186 16
           C 174 28, 152 52, 130 76
           C 118 90, 108 98, 100 104 Z"
        fill="#7DC040"
      />
      {/* Subtle shadow/depth at the meeting point */}
      <path
        d="M 100 104
           C 104 96, 110 88, 116 80
           C 110 88, 104 96, 100 104 Z"
        fill="#6CA32F"
        opacity="0.5"
      />
    </svg>
  )
}

export function EverLogoFull({ width = 120, className = '' }) {
  const markH = Math.round(width * 0.72)
  const textSize = Math.round(width * 0.42)
  const totalH = markH + textSize + 8
  return (
    <svg
      width={width}
      height={totalH}
      viewBox={`0 0 200 ${Math.round(200 * totalH / width)}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mark */}
      <path
        d="M 12 20
           C 44 4, 98 16, 112 80
           C 107 92, 102 100, 100 104
           C 86 82, 62 48, 30 26
           C 20 20, 12 22, 12 20 Z"
        fill="#8DC63F"
      />
      <path
        d="M 100 104
           C 116 82, 148 50, 178 24
           C 184 18, 188 14, 186 16
           C 174 28, 152 52, 130 76
           C 118 90, 108 98, 100 104 Z"
        fill="#7DC040"
      />
      {/* "ever" text */}
      <text
        x="100"
        y={Math.round(200 * totalH / width) - 4}
        textAnchor="middle"
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="800"
        fontSize="64"
        fill="#222222"
        letterSpacing="-1"
      >
        ever
      </text>
    </svg>
  )
}

// Compact horizontal logo: mark + "ever" text side by side
export function EverLogoHorizontal({ height = 32, className = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className={className}>
      <EverLogoMark width={Math.round(height * 1.4)} />
      <span style={{
        fontFamily: 'Inter, Arial, sans-serif',
        fontWeight: 900,
        fontSize: height,
        color: '#1A1A1A',
        letterSpacing: '-1px',
        lineHeight: 1,
      }}>ever</span>
    </div>
  )
}

export default EverLogoMark
