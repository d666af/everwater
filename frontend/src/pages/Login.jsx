import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { loginByPhone } from '../api'
import EverLogo from '../components/EverLogo'

const ROLE_ROUTES = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
}

const C = '#7CB342'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '')
    if (!digits) return ''
    let d = digits
    if (d.startsWith('998')) {
      const p = d.slice(3)
      let fmt = '+998'
      if (p.length > 0) fmt += ' ' + p.slice(0, 2)
      if (p.length > 2) fmt += ' ' + p.slice(2, 5)
      if (p.length > 5) fmt += '-' + p.slice(5, 7)
      if (p.length > 7) fmt += '-' + p.slice(7, 9)
      return fmt
    }
    if (d.startsWith('9') && d.length <= 9) return formatPhone('998' + d)
    return '+' + d
  }

  const handlePhone = (e) => {
    setError('')
    setPhone(formatPhone(e.target.value))
  }

  const submit = async () => {
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 12) { setError('Введите корректный номер: +998 XX XXX-XX-XX'); return }
    setLoading(true); setError('')
    try {
      const userData = await loginByPhone(phone)
      login(userData)
      navigate(ROLE_ROUTES[userData.role] || '/')
    } catch (err) {
      setError(err.message || 'Пользователь не найден')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') submit() }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.logoWrap}>
          <EverLogo width={80} style={{ borderRadius: 20 }} />
        </div>

        <div style={s.textBlock}>
          <h1 style={s.title}>Everwater</h1>
          <p style={s.subtitle}>Доставка чистой воды</p>
        </div>

        <div style={s.form}>
          <div style={{ ...s.inputWrap, ...(focused ? s.inputFocused : {}), ...(error ? s.inputError : {}) }}>
            <input
              style={s.input}
              type="tel"
              placeholder="+998 90 123-45-67"
              value={phone}
              onChange={handlePhone}
              onKeyDown={handleKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
          </div>
          {error && <div style={s.errorMsg}>{error}</div>}

          <button style={{ ...s.btn, ...(loading ? { opacity: 0.7 } : {}) }} onClick={submit} disabled={loading}>
            {loading ? <span style={s.spinner} /> : 'Войти'}
          </button>
        </div>

        {(import.meta.env.DEV || import.meta.env.VITE_MOCK === 'true') && (
          <div style={s.demoBlock}>
            <div style={s.demoLabel}>Тестовые аккаунты</div>
            <div style={s.demoGrid}>
              {[
                { phone: '+998 90 000-00-01', role: 'Клиент' },
                { phone: '+998 90 000-00-02', role: 'Админ' },
                { phone: '+998 90 000-00-03', role: 'Менеджер' },
                { phone: '+998 90 000-00-04', role: 'Курьер' },
              ].map(d => (
                <button key={d.phone} style={s.demoBtn} onClick={() => setPhone(d.phone)}>
                  <span style={s.demoRole}>{d.role}</span>
                  <span style={s.demoPhone}>{d.phone}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  container: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    animation: 'fadeIn 0.5s ease forwards',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    color: '#212121',
    letterSpacing: -1,
    margin: 0,
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    fontWeight: 400,
    margin: '8px 0 0',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#F5F5F5',
    border: '2px solid transparent',
    borderRadius: 16,
    padding: '0 18px',
    minHeight: 56,
    transition: 'all 0.2s',
  },
  inputFocused: {
    border: `2px solid ${C}`,
    background: '#FFFFFF',
    boxShadow: `0 0 0 4px rgba(124,179,66,0.12)`,
  },
  inputError: {
    border: '2px solid #EF5350',
    boxShadow: '0 0 0 4px rgba(239,83,80,0.08)',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 18,
    padding: 0,
    color: '#212121',
    fontWeight: 600,
    minHeight: 44,
    letterSpacing: 0.5,
  },
  errorMsg: {
    fontSize: 13,
    color: '#EF5350',
    fontWeight: 500,
    paddingLeft: 4,
  },
  btn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    minHeight: 56,
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(124,179,66,0.3)',
    transition: 'all 0.2s',
    letterSpacing: -0.2,
  },
  spinner: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTop: '2.5px solid #fff',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  demoBlock: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  demoLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  demoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  demoBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: '#FAFAFA',
    border: '1px solid #EEEEEE',
    borderRadius: 14,
    padding: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
  },
  demoRole: {
    fontSize: 12,
    fontWeight: 700,
    color: C,
  },
  demoPhone: {
    fontSize: 12,
    color: '#757575',
    fontFamily: 'monospace',
  },
}
