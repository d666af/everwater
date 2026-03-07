import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { loginByPhone } from '../api'
import { EverLogoMark } from '../components/EverLogo'

const ROLE_ROUTES = {
  client: '/',
  admin: '/admin',
  manager: '/manager',
  courier: '/courier',
}

// Actual Everwater logo SVG — bright lime bird/wing mark
function EverLogo({ size = 64 }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 120 102" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left wing */}
      <path
        d="M60 8 C48 8 14 28 10 52 C8 64 18 72 30 68 C42 64 54 44 60 36"
        fill="#8DC63F"
      />
      {/* Right wing */}
      <path
        d="M60 36 C66 44 78 64 90 68 C102 72 112 64 110 52 C106 28 72 8 60 8"
        fill="#6CA32F"
      />
      {/* Center stem */}
      <path
        d="M60 36 L60 88"
        stroke="#8DC63F"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Ground roots */}
      <path
        d="M46 88 Q60 82 74 88"
        stroke="#8DC63F"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
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
      setError(err.message || 'Пользователь не найден. Обратитесь к администратору.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') submit() }

  return (
    <div style={s.page}>
      {/* Decorative background shapes */}
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />

      <div style={s.container}>
        {/* Logo section */}
        <div style={s.logoSection}>
          <div style={s.logoMark}>
            <EverLogoMark width={72} />
          </div>
          <div style={s.brandName}>
            <span style={s.brandEver}>ever</span>
          </div>
          <div style={s.tagline}>Чистая вода с доставкой</div>
        </div>

        {/* Card */}
        <div style={s.card}>
          <h1 style={s.title}>Добро пожаловать</h1>
          <p style={s.subtitle}>Введите номер телефона для входа</p>

          <div style={s.inputGroup}>
            <label style={s.label}>Номер телефона</label>
            <div style={{ ...s.inputWrap, ...(error ? s.inputWrapError : {}) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill="#8DC63F"/>
              </svg>
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
              <div style={s.errorMsg}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#E53935"/>
                  <path d="M12 7v6M12 16.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}
          </div>

          <button style={s.btn} onClick={submit} disabled={loading}>
            {loading ? (
              <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
            ) : (
              <>Войти <span style={{ marginLeft: 4 }}>→</span></>
            )}
          </button>

          {/* Access info */}
          <div style={s.accessInfo}>
            <div style={s.accessTitle}>Доступ для всех ролей:</div>
            <div style={s.roleList}>
              {[
                { icon: '👤', label: 'Клиент', desc: 'Заказ воды' },
                { icon: '⚙️', label: 'Админ', desc: 'Управление' },
                { icon: '📋', label: 'Менеджер', desc: 'Контроль' },
                { icon: '🚴', label: 'Курьер', desc: 'Доставка' },
              ].map(r => (
                <div key={r.label} style={s.roleCard}>
                  <div style={s.roleIcon}>{r.icon}</div>
                  <div style={s.roleLabel}>{r.label}</div>
                  <div style={s.roleDesc}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Demo block */}
        {import.meta.env.DEV && (
          <div style={s.demoBlock}>
            <div style={s.demoHeader}>
              <span style={s.demoBadge}>DEV</span>
              Demo-номера для входа
            </div>
            <div style={s.demoList}>
              {[
                { phone: '+998 90 000-00-01', role: 'Клиент', color: '#8DC63F' },
                { phone: '+998 90 000-00-02', role: 'Админ', color: '#1565C0' },
                { phone: '+998 90 000-00-03', role: 'Менеджер', color: '#6A1B9A' },
                { phone: '+998 90 000-00-04', role: 'Курьер', color: '#00695C' },
              ].map(d => (
                <button key={d.phone} style={s.demoItem} onClick={() => setPhone(d.phone)}>
                  <span style={{ ...s.demoRole, background: d.color }}>{d.role}</span>
                  <span style={s.demoPhone}>{d.phone}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={s.footer}>© 2025 Ever · Доставка чистой воды</div>
      </div>
    </div>
  )
}

const P = '#8DC63F'
const PD = '#6CA32F'

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #F7FCF0 0%, #EDF7D6 50%, #d8f5a8 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 16px', position: 'relative', overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', width: 500, height: 500, borderRadius: '50%',
    background: 'rgba(141,198,63,0.08)', top: -150, right: -100,
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute', width: 300, height: 300, borderRadius: '50%',
    background: 'rgba(141,198,63,0.12)', bottom: -80, left: -100,
    pointerEvents: 'none',
  },
  blob3: {
    position: 'absolute', width: 200, height: 200, borderRadius: '50%',
    background: 'rgba(108,163,47,0.06)', top: '40%', left: '60%',
    pointerEvents: 'none',
  },
  container: {
    width: '100%', maxWidth: 420,
    display: 'flex', flexDirection: 'column', gap: 16,
    position: 'relative', zIndex: 1,
  },
  logoSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    paddingBottom: 8,
  },
  logoMark: {
    background: '#fff',
    borderRadius: 20,
    padding: '12px 16px',
    boxShadow: '0 4px 20px rgba(141,198,63,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandName: { display: 'flex', alignItems: 'baseline' },
  brandEver: { fontSize: 36, fontWeight: 900, color: '#1A1A1A', letterSpacing: -1.5 },
  tagline: { fontSize: 13, color: '#6CA32F', fontWeight: 500, letterSpacing: 0.2 },
  card: {
    background: '#fff', borderRadius: 24, padding: '28px 24px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column', gap: 20,
  },
  title: { fontSize: 24, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.2 },
  subtitle: { fontSize: 14, color: '#888', marginTop: -12, lineHeight: 1.5 },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    border: '2px solid #E8E8E8', borderRadius: 14,
    padding: '4px 14px', background: '#FAFAFA',
    transition: 'border-color 0.2s',
  },
  inputWrapError: { borderColor: '#E53935', background: '#FFF5F5' },
  input: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 17, padding: '11px 0', color: '#1A1A1A', fontWeight: 500,
  },
  errorMsg: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: '#E53935', paddingLeft: 2, fontWeight: 500,
  },
  btn: {
    background: `linear-gradient(135deg, ${P}, ${PD})`,
    color: '#fff', border: 'none', borderRadius: 14,
    padding: '15px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(141,198,63,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    letterSpacing: 0.3,
  },
  accessInfo: {
    background: '#F7FCF0', borderRadius: 14, padding: '14px',
    display: 'flex', flexDirection: 'column', gap: 10,
    border: '1px solid #E0F0C0',
  },
  accessTitle: { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 },
  roleList: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 },
  roleCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    background: '#fff', borderRadius: 10, padding: '8px 4px',
    border: '1px solid #E8F5D0',
  },
  roleIcon: { fontSize: 18 },
  roleLabel: { fontSize: 11, fontWeight: 700, color: '#1A1A1A' },
  roleDesc: { fontSize: 9, color: '#888', textAlign: 'center' },
  demoBlock: {
    background: '#fff', borderRadius: 16, padding: 16,
    border: '1.5px dashed #D0EBAA',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  demoHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, fontWeight: 600, color: '#555',
  },
  demoBadge: {
    background: P, color: '#fff', borderRadius: 6,
    padding: '2px 7px', fontSize: 10, fontWeight: 800, letterSpacing: 1,
  },
  demoList: { display: 'flex', flexDirection: 'column', gap: 6 },
  demoItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#F7FCF0', border: '1px solid #E0F0C0',
    borderRadius: 10, padding: '8px 12px', cursor: 'pointer', width: '100%',
    transition: 'background 0.15s',
  },
  demoRole: {
    color: '#fff', borderRadius: 6, padding: '2px 8px',
    fontSize: 10, fontWeight: 700, minWidth: 56, textAlign: 'center',
  },
  demoPhone: { fontSize: 13, color: '#333', fontWeight: 500, fontFamily: 'monospace' },
  footer: {
    textAlign: 'center', fontSize: 12, color: '#9E9E9E', paddingBottom: 8,
  },
}
