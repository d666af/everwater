const LOGO_URL = '/logo.jpg'

export default function EverLogo({ width = 160, style, ...props }) {
  return (
    <img
      src={LOGO_URL}
      alt="Ever"
      width={width}
      fetchpriority="high"
      decoding="async"
      style={{ objectFit: 'contain', display: 'block', ...style }}
      {...props}
    />
  )
}

export function EverLogoMark({ width = 48, style, ...props }) {
  return (
    <img
      src={LOGO_URL}
      alt="Ever"
      width={width}
      fetchpriority="high"
      decoding="async"
      style={{ objectFit: 'contain', display: 'block', borderRadius: 8, ...style }}
      {...props}
    />
  )
}

export function EverLogoHorizontal({ height = 32, className = '' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className={className}>
      <img
        src={LOGO_URL}
        alt="Ever"
        height={height}
        fetchpriority="high"
        decoding="async"
        style={{ objectFit: 'contain', display: 'block', borderRadius: 6 }}
      />
    </div>
  )
}
