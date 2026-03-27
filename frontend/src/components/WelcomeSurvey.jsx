import { useState } from 'react'
import { useUserStore } from '../store/user'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

export default function WelcomeSurvey() {
  const { survey_done, completeSurvey } = useUserStore()
  const [step, setStep] = useState('ask') // ask | count | done
  const [count, setCount] = useState(0)

  if (survey_done) return null

  const finish = (bottles) => {
    completeSurvey(bottles)
  }

  if (step === 'ask') return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.iconWrap}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#fff"/>
          </svg>
        </div>
        <h3 style={s.title}>Добро пожаловать!</h3>
        <p style={s.desc}>
          Есть ли у вас 20-литровые бутылки от других компаний по доставке воды?
        </p>
        <div style={s.btnRow}>
          <button style={s.btnGhost} onClick={() => finish(0)}>Нет</button>
          <button style={s.btnPrimary} onClick={() => setStep('count')}>Да, есть</button>
        </div>
      </div>
    </div>
  )

  if (step === 'count') return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={{ ...s.iconWrap, background: '#FFA726' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 3v5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 style={s.title}>Сколько бутылок?</h3>
        <p style={s.desc}>Укажите количество 20-литровых бутылок от других компаний</p>
        <div style={s.stepper}>
          <button style={count <= 0 ? { ...s.stepBtn, opacity: 0.3 } : s.stepBtn}
            onClick={() => setCount(Math.max(0, count - 1))} disabled={count <= 0}>−</button>
          <span style={s.stepVal}>{count}</span>
          <button style={s.stepBtn} onClick={() => setCount(count + 1)}>+</button>
        </div>
        <button style={{ ...s.btnPrimary, width: '100%' }} onClick={() => finish(count)}>
          Продолжить
        </button>
      </div>
    </div>
  )

  return null
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(6px)', zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 24, padding: '32px 24px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    maxWidth: 340, width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: '50%', background: GRAD,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  title: { fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0, textAlign: 'center' },
  desc: { fontSize: 14, color: '#8e8e93', textAlign: 'center', margin: 0, lineHeight: 1.5 },
  btnRow: { display: 'flex', gap: 10, width: '100%', marginTop: 8 },
  btnGhost: {
    flex: 1, padding: '14px', borderRadius: 14, border: 'none',
    background: '#f0f0f2', fontSize: 15, fontWeight: 600,
    color: '#8e8e93', cursor: 'pointer',
  },
  btnPrimary: {
    flex: 1, padding: '14px', borderRadius: 14, border: 'none',
    background: GRAD, color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  stepper: {
    display: 'flex', alignItems: 'center', gap: 20, margin: '8px 0',
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 14,
    border: `2px solid ${C}`, background: '#fff',
    fontSize: 22, fontWeight: 700, color: C,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepVal: { fontSize: 28, fontWeight: 800, color: '#1a1a1a', minWidth: 40, textAlign: 'center' },
}
