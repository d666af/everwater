import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function PhonePopup({ number, label, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(number).catch(() => {
      const el = document.createElement('textarea')
      el.value = number
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e5ea', margin: '0 auto' }} />
        <div style={{ fontSize: 13, color: '#8e8e93', textAlign: 'center' }}>{label}</div>

        <div
          onClick={handleCopy}
          style={{
            fontSize: 26, fontWeight: 800, color: '#1a1a1a', textAlign: 'center',
            letterSpacing: 1, cursor: 'pointer', padding: '10px 0',
          }}
        >
          {number}
        </div>

        <div style={{ fontSize: 12, color: '#8e8e93', textAlign: 'center', marginTop: -8 }}>
          {copied ? '✅ Скопировано!' : 'Нажмите на номер, чтобы скопировать'}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 4, background: 'none', border: '1.5px solid #e5e5ea', borderRadius: 14,
            padding: '13px', fontSize: 15, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
