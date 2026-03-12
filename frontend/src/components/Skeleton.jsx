/**
 * Skeleton loaders for Apple-style loading states
 */

export function SkeletonLine({ width = '100%', height = 16, borderRadius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #F2F2F7 25%, #E5E5EA 50%, #F2F2F7 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(60,60,67,0.12)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Image area */}
      <div style={{
        width: '100%',
        aspectRatio: '1/1',
        background: 'linear-gradient(90deg, #F2F2F7 25%, #E5E5EA 50%, #F2F2F7 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
      {/* Body */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine height={14} width="80%" />
        <SkeletonLine height={11} width="60%" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <SkeletonLine height={16} width="45%" />
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(90deg, #F2F2F7 25%, #E5E5EA 50%, #F2F2F7 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            flexShrink: 0,
          }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonListItem() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: 12,
      display: 'flex',
      gap: 12,
      border: '1px solid rgba(60,60,67,0.12)',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(90deg, #F2F2F7 25%, #E5E5EA 50%, #F2F2F7 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
        <SkeletonLine height={15} width="75%" />
        <SkeletonLine height={12} width="50%" />
        <SkeletonLine height={12} width="40%" />
      </div>
    </div>
  )
}

export function SkeletonOrderCard() {
  return (
    <div style={{
      background: '#fff',
      margin: '0 16px',
      borderRadius: 16,
      padding: '14px 16px',
      border: '1px solid rgba(60,60,67,0.12)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <SkeletonLine height={16} width="40%" />
        <SkeletonLine height={12} width="60%" />
        <SkeletonLine height={11} width="30%" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <SkeletonLine height={18} width={80} />
        <SkeletonLine height={10} width={20} borderRadius={5} />
      </div>
    </div>
  )
}
