import { useState } from 'react'
import s, { C } from './styles'

export default function CardPayment({ settings, amount, onConfirm, loading, error }) {
  const [copied, setCopied] = useState(false)

  const copyCard = () => {
    const text = settings.payment_card || ''
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'
        document.body.appendChild(ta); ta.select(); document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={s.page}>
      <div style={s.section}>
        <div style={s.sLabel}>Оплата заказа</div>
        <div style={s.payCard}>
          <div style={s.payCardLabel}>Переведите на карту</div>
          <div style={{ ...s.payCardNum, cursor: 'pointer' }} onClick={copyCard}>{settings.payment_card || '0000 0000 0000 0000'}</div>
          <div style={{ fontSize: 11, color: copied ? '#8DC63F' : 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'center' }}>
            {copied ? 'Скопировано!' : 'Нажмите на номер чтобы скопировать'}
          </div>
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
