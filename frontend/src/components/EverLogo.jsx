/**
 * EverLogo — unified SVG logo (mark + "ever" text as one SVG)
 * EverLogoMark — wings only, for compact spaces
 */

// Full logo: mark + "ever" text in a single SVG
export default function EverLogo({ width = 160, ...props }) {
  const h = Math.round(width * 1.15)
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 200 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Left wing — large sweep from upper-left to center-bottom */}
      <path
        d="M 14 28 C 45 8 100 20 114 82 C 109 94 104 102 101 106 C 87 84 62 50 30 30 C 20 24 14 28 14 28 Z"
        fill="#8DC63F"
      />
      {/* Right wing — smaller sweep from center-bottom to upper-right */}
      <path
        d="M 101 106 C 117 84 148 52 178 28 C 184 22 188 18 186 20 C 172 32 148 58 126 80 C 116 90 108 100 101 106 Z"
        fill="#7DC040"
      />
      {/* "ever" text centered below the mark */}
      <text
        x="100"
        y="195"
        textAnchor="middle"
        fontFamily="'Inter', Arial, sans-serif"
        fontWeight="800"
        fontSize="72"
        fill="#1A1A1A"
        letterSpacing="-2"
      >ever</text>
    </svg>
  )
}

// Mark only — wings without text, for sidebars and compact spaces
export function EverLogoMark({ width = 48, ...props }) {
  const h = Math.round(width * 0.7)
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M 14 28 C 45 8 100 20 114 82 C 109 94 104 102 101 106 C 87 84 62 50 30 30 C 20 24 14 28 14 28 Z"
        fill="#8DC63F"
      />
      <path
        d="M 101 106 C 117 84 148 52 178 28 C 184 22 188 18 186 20 C 172 32 148 58 126 80 C 116 90 108 100 101 106 Z"
        fill="#7DC040"
      />
    </svg>
  )
}

// Horizontal layout: mark + "ever" text side by side (for admin/manager sidebars)
export function EverLogoHorizontal({ height = 32, className = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className={className}>
      <EverLogoMark width={Math.round(height * 1.4)} />
      <span style={{
        fontFamily: "'Inter', Arial, sans-serif",
        fontWeight: 900,
        fontSize: height,
        color: '#1A1A1A',
        letterSpacing: '-1px',
        lineHeight: 1,
      }}>ever</span>
    </div>
  )
}
