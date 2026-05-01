import { createPortal } from 'react-dom'

function callNumber(number) {
  const url = `tel:${number}`
  // Telegram WebApp: openLink passes tel: to the OS dialer
  try {
    const tg = window.Telegram?.WebApp
    if (tg?.openLink) { tg.openLink(url); return }
  } catch (_) {}
  // Fallback: programmatic anchor click (works in Android WebView and standard browsers)
  try {
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  } catch (_) {}
  window.location.href = url
}

export default function PhonePopup({ number, label, onClose }) {
  const content = (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 99999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
        padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e5ea', margin: '0 auto' }} />
        <div style={{ fontSize: 13, color: '#8e8e93', textAlign: 'center' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', textAlign: 'center', letterSpacing: 1 }}>{number}</div>
        {/* Visible anchor so user can also long-press to copy/call natively */}
        <a
          href={`tel:${number}`}
          onClick={e => { e.preventDefault(); callNumber(number) }}
          style={{
            display: 'block', background: '#8DC63F', color: '#fff', borderRadius: 14,
            padding: '14px', fontSize: 16, fontWeight: 700, textAlign: 'center', textDecoration: 'none',
          }}
        >
          📞 Позвонить
        </a>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1.5px solid #e5e5ea', borderRadius: 14,
            padding: '13px', fontSize: 15, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
