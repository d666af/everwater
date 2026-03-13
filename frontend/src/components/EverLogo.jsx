const LOGO_URL = 'https://i.ibb.co/qwn4Bwz/Ever-Jpg.jpg'

export default function EverLogo({ width = 160, ...props }) {
  return (
    <img
      src={LOGO_URL}
      alt="Ever"
      width={width}
      style={{ objectFit: 'contain', display: 'block', ...props.style }}
      {...props}
    />
  )
}

export function EverLogoMark({ width = 48, ...props }) {
  return (
    <img
      src={LOGO_URL}
      alt="Ever"
      width={width}
      style={{ objectFit: 'contain', display: 'block', borderRadius: 8, ...props.style }}
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
        style={{ objectFit: 'contain', display: 'block', borderRadius: 6 }}
      />
    </div>
  )
}
