import { useState } from 'react'
import s, { C } from './styles'

export default function CardPayment({ settings, amount, balanceUsed, cardRemainder, onConfirm, loading, error }) {
  const [copied, setCopied] = useState(false)

  const copyCard = () => {
    navigator.clipboard?.writeText(settings.payment_card || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={s.page}>
      {cardRemainder > 0 && (
        <div style={s.section}>
          <div style={s.balanceNote}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 14, color: '#3c3c43' }}>
              С баланса списано <b style={{ color: C }}>{balanceUsed.toLocaleString()} сум</b>
            </span>
          </div>
        </div>
      )}
      <div style={s.section}>
        <div style={s.sLabel}>Оплата заказа</div>
        <div style={s.payCard}>
          <div style={s.payCardLabel}>Переведите на карту</div>
          <div style={s.payCardNum}>{settings.payment_card || '0000 0000 0000 0000'}</div>
          <div style={s.payCardHolder}>{settings.payment_holder || '—'}</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Сумма</div>
          <div style={s.payAmtBig}>{amount.toLocaleString()} <span style={s.payAmtCur}>сум</span></div>
          <button style={{ ...s.cpyBtn, ...(copied ? s.cpyBtnDone : {}) }} onClick={copyCard}>
            {copied ? 'Скопировано' : 'Скопировать номер карты'}
          </button>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.helpSteps}>
          <div style={s.helpStep}><span style={s.helpNum}>1</span> Переведите сумму на карту</div>
          <div style={s.helpStep}><span style={s.helpNum}>2</span> Нажмите «Я оплатил»</div>
          <div style={s.helpStep}><span style={s.helpNum}>3</span> Менеджер подтвердит заказ</div>
        </div>
      </div>

      {error && <div style={{ padding: '0 16px' }}><div style={s.errorBox}>{error}</div></div>}
      <div style={{ padding: '0 16px 32px' }}>
        <button style={s.primaryBtn} onClick={onConfirm} disabled={loading}>
          {loading ? <span style={s.spinner} /> : 'Я оплатил'}
        </button>
      </div>
    </div>
  )
}
