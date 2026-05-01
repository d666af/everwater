export default function PhonePopup({ number, label, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'slideUp 0.25s ease' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e5ea', margin: '0 auto' }} />
        <div style={{ fontSize: 13, color: '#8e8e93', textAlign: 'center' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', textAlign: 'center', letterSpacing: 1 }}>{number}</div>
        <button
          onClick={() => { window.location.href = `tel:${number}` }}
          style={{ display: 'block', width: '100%', background: '#8DC63F', color: '#fff', borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 700, textAlign: 'center', border: 'none', cursor: 'pointer' }}>
          📞 Позвонить
        </button>
        <button onClick={onClose} style={{ background: 'none', border: '1.5px solid #e5e5ea', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 600, color: '#3c3c43', cursor: 'pointer' }}>
          Отмена
        </button>
      </div>
    </div>
  )
}
