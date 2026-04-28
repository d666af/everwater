import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { loginByPhone } from '../api'
import EverLogo from '../components/EverLogo'

const tg = window.Telegram?.WebApp
const isTelegramWebApp = () => !!tg?.initDataUnsafe?.user

const ROLE_ROUTES = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
  warehouse: '/warehouse',
}

export default function Login() {
  const [step, setStep] = useState('phone') // 'phone' | 'password'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedPhone, setFocusedPhone] = useState(false)
  const [focusedPass, setFocusedPass] = useState(false)
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

  const handlePhone = (e) => { setError(''); setPhone(formatPhone(e.target.value)) }
  const handlePassword = (e) => { setError(''); setPassword(e.target.value) }

  const submit = async () => {
    if (step === 'phone') {
      const raw = phone.replace(/\D/g, '')
      if (raw.length < 12) { setError('Введите корректный номер: +998 XX XXX-XX-XX'); return }
      setLoading(true); setError('')
      try {
        const result = await loginByPhone(phone)
        if (result?.needs_password) {
          setStep('password')
        } else {
          login(result)
          navigate(ROLE_ROUTES[result.role] || '/')
        }
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Пользователь не найден')
      } finally {
        setLoading(false)
      }
    } else {
      if (!password.trim()) { setError('Введите пароль'); return }
      setLoading(true); setError('')
      try {
        const userData = await loginByPhone(phone, password)
        login(userData)
        navigate(ROLE_ROUTES[userData.role] || '/')
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Неверный пароль')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') submit() }

  // When opened from Telegram WebApp without a registered account
  if (isTelegramWebApp()) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.brand}>
            <EverLogo width={120} style={{ borderRadius: 22 }} />
          </div>
          <div style={s.tgCard}>
            <div style={s.tgIcon}>💬</div>
            <div style={s.tgTitle}>Завершите регистрацию в боте</div>
            <div style={s.tgDesc}>
              Чтобы войти в приложение, нужно сначала зарегистрироваться через Telegram-бот:
              введите имя и номер телефона. После этого вернитесь в приложение.
            </div>
            <button
              style={s.tgBtn}
              onClick={() => tg?.close?.()}
            >
              Вернуться в бот
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.brand}>
          <EverLogo width={120} style={{ borderRadius: 22 }} />
        </div>

        <div style={s.form}>
          {step === 'phone' ? (
            <>
              <label style={s.label}>Номер телефона</label>
              <div style={{
                ...s.inputWrap,
                ...(focusedPhone ? s.inputFocused : {}),
                ...(error ? s.inputError : {}),
              }}>
                <input
                  style={s.input}
                  type="tel"
                  placeholder="+998 90 123-45-67"
                  value={phone}
                  onChange={handlePhone}
                  onKeyDown={handleKey}
                  onFocus={() => setFocusedPhone(true)}
                  onBlur={() => setFocusedPhone(false)}
                  autoFocus
                />
              </div>
            </>
          ) : (
            <>
              <button style={s.backBtn} onClick={() => { setStep('phone'); setError(''); setPassword('') }}>
                ← {phone}
              </button>
              <label style={s.label}>Пароль</label>
              <div style={{
                ...s.inputWrap,
                ...(focusedPass ? s.inputFocused : {}),
                ...(error ? s.inputError : {}),
              }}>
                <input
                  style={s.input}
                  type="text"
                  placeholder="Ваш пароль из бота"
                  value={password}
                  onChange={handlePassword}
                  onKeyDown={handleKey}
                  onFocus={() => setFocusedPass(true)}
                  onBlur={() => setFocusedPass(false)}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="characters"
                />
              </div>
            </>
          )}
          {error && <div style={s.errorMsg}>{error}</div>}

          <button
            style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
            onClick={submit}
            disabled={loading}
          >
            {loading ? <span style={s.spinner} /> : (step === 'phone' ? 'Далее' : 'Войти')}
          </button>
        </div>

        {(import.meta.env.DEV || import.meta.env.VITE_MOCK === 'true') && (
          <div style={s.demoBlock}>
            <div style={s.demoLabel}>Демо</div>
            <div style={s.demoGrid}>
              {[
                { phone: '+998 90 000-00-01', role: 'Клиент' },
                { phone: '+998 90 000-00-02', role: 'Админ' },
                { phone: '+998 90 000-00-03', role: 'Менеджер' },
                { phone: '+998 90 000-00-04', role: 'Курьер' },
                { phone: '+998 90 000-00-05', role: 'Завсклад' },
              ].map(d => (
                <button key={d.phone} style={s.demoBtn} onClick={() => { setPhone(d.phone); setStep('phone') }}>
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
    minHeight: '100dvh',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  container: {
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
    animation: 'fadeIn 0.4s ease',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    paddingLeft: 2,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#f7f7f8',
    border: '1.5px solid #eee',
    borderRadius: 14,
    padding: '0 16px',
    height: 52,
    transition: 'all 0.2s',
  },
  inputFocused: {
    borderColor: '#8DC63F',
    background: '#fff',
    boxShadow: '0 0 0 3px rgba(141,198,63,0.1)',
  },
  inputError: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239,68,68,0.08)',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 17,
    color: '#111',
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  errorMsg: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: 500,
    paddingLeft: 2,
  },
  btn: {
    background: '#8DC63F',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    height: 52,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    transition: 'opacity 0.2s',
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTop: '2.5px solid #fff',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  demoBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  demoLabel: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    gap: 3,
    background: '#f7f7f8',
    border: '1px solid #eee',
    borderRadius: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s',
  },
  demoRole: {
    fontSize: 12,
    fontWeight: 700,
    color: '#8DC63F',
  },
  demoPhone: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#8DC63F',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 0 4px',
    textAlign: 'left',
  },
  tgCard: {
    background: '#f7f9f3',
    border: '1.5px solid #d4edaa',
    borderRadius: 20,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
  },
  tgIcon: {
    fontSize: 40,
  },
  tgTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  tgDesc: {
    fontSize: 14,
    color: '#555',
    lineHeight: 1.6,
  },
  tgBtn: {
    marginTop: 8,
    background: '#8DC63F',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    height: 48,
    width: '100%',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
}
