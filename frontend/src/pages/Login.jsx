import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { loginByPhone } from '../api'

const ROLE_ROUTES = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
}

const ROLE_LABELS = {
  client: 'Клиент',
  admin: 'Администратор',
  manager: 'Менеджер',
  courier: 'Курьер',
}

export default function Login() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, '')
    if (!digits) return ''
    let d = digits
    // Normalize: 8 → 998, 9XX → 998 9XX
    if (d.startsWith('998')) {
      const p = d.slice(3)
      let fmt = '+998'
      if (p.length > 0) fmt += ' ' + p.slice(0, 2)
      if (p.length > 2) fmt += ' ' + p.slice(2, 5)
      if (p.length > 5) fmt += '-' + p.slice(5, 7)
      if (p.length > 7) fmt += '-' + p.slice(7, 9)
      return fmt
    }
    if (d.startsWith('9') && d.length <= 9) {
      return formatPhone('998' + d)
    }
    return '+' + d
  }

  const handlePhone = (e) => {
    setError('')
    setPhone(formatPhone(e.target.value))
  }

  const submit = async () => {
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 12) { setError('Введите корректный узбекский номер (+998 XX XXX-XX-XX)'); return }
    setLoading(true); setError('')
    try {
      const userData = await loginByPhone(phone)
      login(userData)
      navigate(ROLE_ROUTES[userData.role] || '/')
    } catch (err) {
      setError(err.message || 'Пользователь не найден. Обратитесь к администратору.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') submit()
  }

  return (
    <div style={s.page}>
      {/* Background decoration */}
      <div style={s.bgCircle1} />
      <div style={s.bgCircle2} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="28" fill="#2d6a4f" />
              <path d="M28 10 C28 10, 16 26, 16 34 C16 41.7 21.4 48 28 48 C34.6 48 40 41.7 40 34 C40 26 28 10 28 10Z" fill="white" opacity="0.9"/>
              <path d="M28 20 C28 20, 20 31, 20 36 C20 40.4 23.6 44 28 44 C32.4 44 36 40.4 36 36 C36 31 28 20 28 20Z" fill="#74c69d"/>
              <path d="M24 34 C24 34, 26 31, 30 33" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </div>
          <div style={s.brand}>
            <span style={s.brandEver}>ever</span>
            <span style={s.brandWater}>water</span>
          </div>
          <div style={s.tagline}>Чистая вода с доставкой</div>
        </div>

        <h2 style={s.title}>Вход в систему</h2>
        <p style={s.subtitle}>Введите номер телефона для входа</p>

        <div style={s.inputWrap}>
          <span style={s.inputIcon}>📱</span>
          <input
            style={s.input}
            type="tel"
            placeholder="+998 90 123-45-67"
            value={phone}
            onChange={handlePhone}
            onKeyDown={handleKey}
            autoFocus
          />
        </div>

        {error && (
          <div style={s.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        <button style={s.btn} onClick={submit} disabled={loading}>
          {loading ? (
            <span style={s.spinner}>◌</span>
          ) : (
            'Войти →'
          )}
        </button>

        {/* Role hint */}
        <div style={s.hint}>
          <div style={s.hintTitle}>Вход для:</div>
          <div style={s.roles}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <div key={role} style={s.roleChip}>
                {role === 'client' && '👤'}
                {role === 'admin' && '⚙️'}
                {role === 'manager' && '📋'}
                {role === 'courier' && '🚴'}
                {' '}{label}
              </div>
            ))}
          </div>
        </div>

        {/* Demo hint */}
        {import.meta.env.DEV && (
          <div style={s.demo}>
            <div style={s.demoTitle}>Demo номера (dev mode):</div>
            <div style={s.demoCodes}>
              <span style={s.demoCode} onClick={() => setPhone('+998 90 000-00-01')}>+998 90 000-00-01 → Клиент</span>
              <span style={s.demoCode} onClick={() => setPhone('+998 90 000-00-02')}>+998 90 000-00-02 → Админ</span>
              <span style={s.demoCode} onClick={() => setPhone('+998 90 000-00-03')}>+998 90 000-00-03 → Менеджер</span>
              <span style={s.demoCode} onClick={() => setPhone('+998 90 000-00-04')}>+998 90 000-00-04 → Курьер</span>
            </div>
          </div>
        )}
      </div>

      <div style={s.footer}>© 2025 Everwater. Доставка чистой воды.</div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(145deg, #d8f3dc 0%, #b7e4c7 40%, #74c69d 100%)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px', position: 'relative', overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', top: -100, right: -100, pointerEvents: 'none',
  },
  bgCircle2: {
    position: 'absolute', width: 300, height: 300, borderRadius: '50%',
    background: 'rgba(45,106,79,0.2)', bottom: -80, left: -80, pointerEvents: 'none',
  },
  card: {
    background: '#fff', borderRadius: 24, padding: '36px 32px',
    width: '100%', maxWidth: 400,
    boxShadow: '0 20px 60px rgba(45,106,79,0.2)',
    display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1,
  },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  logoIcon: { marginBottom: 4 },
  brand: { display: 'flex', alignItems: 'baseline', gap: 1 },
  brandEver: { fontSize: 32, fontWeight: 900, color: '#2d6a4f', letterSpacing: -1 },
  brandWater: { fontSize: 32, fontWeight: 300, color: '#52b788', letterSpacing: -1 },
  tagline: { fontSize: 13, color: '#74c69d', fontWeight: 500 },
  title: { fontSize: 22, fontWeight: 700, color: '#1b4332', margin: 0, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', margin: '−4px 0 4px', lineHeight: 1.4 },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    border: '2px solid #b7e4c7', borderRadius: 14,
    padding: '4px 16px', background: '#f8fffc',
    transition: 'border-color 0.2s',
  },
  inputIcon: { fontSize: 20, flexShrink: 0 },
  input: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 18, padding: '10px 0', color: '#1b4332', fontWeight: 500,
    letterSpacing: 1,
  },
  error: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff5f5', border: '1px solid #ffcccc',
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: '#c62828',
  },
  btn: {
    background: 'linear-gradient(135deg, #2d6a4f, #52b788)',
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '16px 0', fontSize: 18, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(45,106,79,0.35)',
    transition: 'opacity 0.2s',
  },
  spinner: { fontSize: 20, display: 'inline-block', animation: 'spin 1s linear infinite' },
  hint: {
    background: '#f0faf4', borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  hintTitle: { fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' },
  roles: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  roleChip: {
    fontSize: 12, padding: '4px 10px', borderRadius: 8,
    background: '#d8f3dc', color: '#2d6a4f', fontWeight: 500,
  },
  demo: {
    background: '#fffde7', border: '1px dashed #f9a825',
    borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  demoTitle: { fontSize: 11, color: '#f57f17', fontWeight: 700, textTransform: 'uppercase' },
  demoCodes: { display: 'flex', flexDirection: 'column', gap: 4 },
  demoCode: {
    fontSize: 12, color: '#1565c0', cursor: 'pointer', textDecoration: 'underline',
    textDecorationStyle: 'dashed',
  },
  footer: {
    marginTop: 24, fontSize: 12, color: '#2d6a4f',
    textAlign: 'center', position: 'relative', zIndex: 1,
  },
}
