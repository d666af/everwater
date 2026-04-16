import { useEffect, useState } from 'react'
import { useUserStore } from '../store/user'
import { getSettings } from '../api'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const ALL_COMPANIES = ['Grand Water', 'Fresco', 'Hamd', 'Hydrolife', 'Zam-Zam', 'Kavsar', 'Montella']

const LS_SURVEY_EXT = 'everwater_survey_company'

export default function WelcomeSurvey() {
  const { survey_done, completeSurvey } = useUserStore()
  const [step, setStep] = useState('ask') // ask | company | count
  const [company, setCompany] = useState(null)
  const [count, setCount] = useState(0)
  const [acceptedCompanies, setAcceptedCompanies] = useState([])

  useEffect(() => {
    getSettings().then(s => setAcceptedCompanies(s.accepted_bottle_companies || [])).catch(() => {})
  }, [])

  if (survey_done) return null

  const finish = (bottles, companyName, source) => {
    if (companyName) localStorage.setItem(LS_SURVEY_EXT, JSON.stringify({ company: companyName, source }))
    completeSurvey(bottles)
  }

  if (step === 'ask') return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#fff"/>
          </svg>
        </div>
        <h3 style={s.title}>Добро пожаловать!</h3>
        <p style={s.desc}>Есть ли у вас 20-литровые бутылки?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <button style={s.optionBtn} onClick={() => { setCompany('our'); setCount(0); setStep('count') }}>
            <div style={{ ...s.optIcon, background: '#EBFBEE' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#2B8A3E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Наши бутылки</div>
              <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>Everwater, уже покупал у нас</div>
            </div>
          </button>
          <button style={s.optionBtn} onClick={() => setStep('company')}>
            <div style={{ ...s.optIcon, background: '#FFF3D9' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#E67700" strokeWidth="2" strokeLinecap="round"/><path d="M3 3v5h5" stroke="#E67700" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>От другой компании</div>
              <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>Бутылки другой марки</div>
            </div>
          </button>
          <button style={{ ...s.optionBtn, background: '#F2F2F7' }} onClick={() => finish(0, null, 'none')}>
            <div style={{ ...s.optIcon, background: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#8e8e93' }}>Нет бутылок</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'company') return (
    <div style={s.overlay}>
      <div style={{ ...s.card, gap: 10 }}>
        <div style={{ ...s.iconWrap, background: 'linear-gradient(135deg,#FFA726,#E67700)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 3v5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 style={s.title}>Чья бутылка?</h3>
        <p style={{ ...s.desc, marginBottom: 4 }}>Выберите марку</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
          {ALL_COMPANIES.map(c => {
            const accepted = acceptedCompanies.includes(c)
            return (
              <button key={c} onClick={() => { setCompany(c); setCount(0); setStep('count') }} style={{
                flex: '1 1 calc(50% - 4px)', padding: '10px 12px', borderRadius: 12,
                background: company === c ? GRAD : '#f2f2f7',
                color: company === c ? '#fff' : '#1a1a1a',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
              }}>
                <span style={{ flex: 1 }}>{c}</span>
                {accepted && <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.3)', padding: '2px 6px', borderRadius: 99, color: company === c ? '#fff' : '#2B8A3E', fontWeight: 700 }}>Принимаем</span>}
              </button>
            )
          })}
        </div>
        <button style={{ ...s.btnGhost, width: '100%', marginTop: 4 }} onClick={() => setStep('ask')}>← Назад</button>
      </div>
    </div>
  )

  if (step === 'count') {
    const isOur = company === 'our'
    const isAccepted = isOur || acceptedCompanies.includes(company)
    return (
      <div style={s.overlay}>
        <div style={s.card}>
          <div style={{ ...s.iconWrap, background: isAccepted ? GRAD : 'linear-gradient(135deg,#aaa,#888)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 2h6v3l3 3v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8l3-3V2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 2v3h6V2" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 style={s.title}>Сколько бутылок?</h3>
          <p style={s.desc}>
            {isOur ? 'Наши бутылки (Everwater)' : company}
            {isAccepted
              ? <span style={{ color: '#2B8A3E', fontWeight: 700 }}> · принимаем</span>
              : <span style={{ color: '#E03131', fontWeight: 700 }}> · не принимаем</span>}
          </p>
          {!isAccepted && (
            <div style={{ background: '#FFF5F5', borderRadius: 12, padding: '10px 12px', fontSize: 12, color: '#c0392b', textAlign: 'center' }}>
              Бутылки этой марки мы не принимаем — они не будут учитываться
            </div>
          )}
          <div style={s.stepper}>
            <button style={count <= 0 ? { ...s.stepBtn, opacity: 0.3 } : s.stepBtn}
              onClick={() => setCount(Math.max(0, count - 1))} disabled={count <= 0}>−</button>
            <span style={s.stepVal}>{count}</span>
            <button style={s.stepBtn} onClick={() => setCount(count + 1)}>+</button>
          </div>
          <button style={{ ...s.btnPrimary, width: '100%' }} onClick={() => finish(isAccepted ? count : 0, company, isOur ? 'our' : 'other')}>
            Продолжить
          </button>
          <button style={{ ...s.btnGhost, width: '100%' }} onClick={() => setStep(isOur ? 'ask' : 'company')}>← Назад</button>
        </div>
      </div>
    )
  }

  return null
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(6px)', zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#fff', borderRadius: 24, padding: '28px 20px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    maxWidth: 360, width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  iconWrap: {
    width: 58, height: 58, borderRadius: '50%', background: GRAD,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)', flexShrink: 0,
  },
  title: { fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0, textAlign: 'center' },
  desc: { fontSize: 14, color: '#8e8e93', textAlign: 'center', margin: 0, lineHeight: 1.5 },
  optionBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14, border: '1.5px solid #f0f0f2',
    background: '#fff', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  },
  optIcon: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  btnGhost: {
    padding: '12px', borderRadius: 14, border: 'none',
    background: '#f0f0f2', fontSize: 14, fontWeight: 600,
    color: '#8e8e93', cursor: 'pointer',
  },
  btnPrimary: {
    flex: 1, padding: '14px', borderRadius: 14, border: 'none',
    background: GRAD, color: '#fff', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  stepper: { display: 'flex', alignItems: 'center', gap: 20, margin: '8px 0' },
  stepBtn: {
    width: 44, height: 44, borderRadius: 14,
    border: `2px solid ${C}`, background: '#fff',
    fontSize: 22, fontWeight: 700, color: C,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepVal: { fontSize: 28, fontWeight: 800, color: '#1a1a1a', minWidth: 40, textAlign: 'center' },
}
