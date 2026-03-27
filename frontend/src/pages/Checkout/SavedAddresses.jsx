import s from './styles'

export default function SavedAddresses({ addresses, onSelect, selectedId }) {
  if (!addresses.length) return null
  return (
    <div style={s.savedRow}>
      {addresses.map(a => (
        <button
          key={a.id}
          style={selectedId === a.id ? { ...s.savedChip, ...s.savedChipActive } : s.savedChip}
          onClick={() => onSelect(a)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="currentColor"/>
          </svg>
          {a.label || a.address.split(',')[0]}
        </button>
      ))}
    </div>
  )
}
