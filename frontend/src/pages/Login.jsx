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

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

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
      setError(err.message || 'Пользователь не найден. Обратитесь к администратору.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') submit() }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Logo */}
        <div style={s.logoSection}>
          <EverLogo width={140} />
          <p style={s.tagline}>Чистая вода с доставкой</p>
        </div>

        {/* Login form card */}
        <div style={s.card}>
          <h1 style={s.title}>Войти</h1>
          <p style={s.subtitle}>Введите номер телефона</p>

          <div style={s.inputGroup}>
            <div style={{
              ...s.inputWrap,
              ...(focused ? s.inputWrapFocused : {}),
              ...(error ? s.inputWrapError : {}),
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z"
                  fill={focused ? C : TEXT2}
                  style={{ transition: TRANSITION }}
                />
              </svg>
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
            {error && (
              <div style={s.errorMsg}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#FF3B30"/>
                  <path d="M12 7v6M12 16.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}
          </div>

          <button
            style={{ ...s.btn, ...(loading ? s.btnLoading : {}) }}
            onClick={submit}
            disabled={loading}
          >
            {loading ? (
              <span style={s.spinner} />
            ) : (
              'Войти'
            )}
          </button>
        </div>

        {/* Roles info */}
        <div style={s.rolesSection}>
          <div style={s.rolesTitle}>Для всех ролей системы</div>
          <div style={s.rolesList}>
            {[
              { label: 'Клиент', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" fill={C}/>
                  <path d="M4 20C4 17 7.6 15 12 15C16.4 15 20 17 20 20" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )},
              { label: 'Менеджер', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="3" fill={C}/>
                  <path d="M7 9h10M7 13h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )},
              { label: 'Курьер', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="5.5" cy="17.5" r="2.5" fill={C}/>
                  <circle cx="17.5" cy="17.5" r="2.5" fill={C}/>
                  <path d="M8 17.5H15M15 17.5V10L13 7H6L5 10V14" stroke={C} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )},
              { label: 'Админ', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L14.09 8.26L21 9L15.5 14L17.18 21L12 17.77L6.82 21L8.5 14L3 9L9.91 8.26L12 2Z" fill={C}/>
                </svg>
              )},
            ].map(r => (
              <div key={r.label} style={s.roleChip}>
                {r.icon}
                <span style={s.roleLabel}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dev demo codes */}
        {(import.meta.env.DEV || import.meta.env.VITE_MOCK === 'true') && (
          <div style={s.demoBlock}>
            <div style={s.demoHeader}>
              <span style={s.devBadge}>DEV</span>
              <span style={{ color: TEXT2, fontSize: 13 }}>Тестовые номера</span>
            </div>
            <div style={s.demoList}>
              {[
                { phone: '+998 90 000-00-01', role: 'Клиент', color: C },
                { phone: '+998 90 000-00-02', role: 'Админ', color: '#007AFF' },
                { phone: '+998 90 000-00-03', role: 'Менеджер', color: '#AF52DE' },
                { phone: '+998 90 000-00-04', role: 'Курьер', color: '#34C759' },
              ].map(d => (
                <button key={d.phone} style={s.demoItem} onClick={() => setPhone(d.phone)}>
                  <span style={{ ...s.demoRolePill, background: d.color }}>{d.role}</span>
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

const s = {
  page: {
    minHeight: '100vh',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
  },
  container: {
    width: '100%',
    maxWidth: 390,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    animation: 'fadeIn 0.4s ease forwards',
  },
  logoSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  tagline: {
    fontSize: 14,
    color: TEXT2,
    fontWeight: 500,
    letterSpacing: 0.1,
    margin: 0,
  },
  card: {
    background: '#F9F9FB',
    borderRadius: 20,
    padding: '28px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    border: `1px solid ${BORDER}`,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: -0.5,
    margin: 0,
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT2,
    margin: 0,
    marginTop: -8,
    lineHeight: 1.4,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#FFFFFF',
    border: `1.5px solid ${BORDER}`,
    borderRadius: 12,
    padding: '0 14px',
    minHeight: 52,
    transition: TRANSITION,
  },
  inputWrapFocused: {
    border: `1.5px solid ${C}`,
    boxShadow: `0 0 0 3px rgba(141,198,63,0.15)`,
  },
  inputWrapError: {
    border: '1.5px solid #FF3B30',
    boxShadow: '0 0 0 3px rgba(255,59,48,0.1)',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 17,
    padding: '0',
    color: TEXT,
    fontWeight: 500,
    minHeight: 44,
  },
  errorMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#FF3B30',
    paddingLeft: 2,
    fontWeight: 500,
  },
  btn: {
    background: C,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    minHeight: 52,
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: TRANSITION,
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
    letterSpacing: 0.1,
    marginTop: 4,
  },
  btnLoading: {
    background: CD,
    boxShadow: 'none',
  },
  spinner: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.35)',
    borderTop: '2.5px solid #fff',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
  rolesSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '0 4px',
  },
  rolesTitle: {
    fontSize: 12,
    color: TEXT2,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rolesList: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  roleChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#F2F2F7',
    borderRadius: 999,
    padding: '6px 12px',
    border: `1px solid ${BORDER}`,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: TEXT,
  },
  demoBlock: {
    background: '#F9F9FB',
    borderRadius: 16,
    padding: 16,
    border: `1px dashed ${BORDER}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  demoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  devBadge: {
    background: C,
    color: '#fff',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
  },
  demoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  demoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#FFFFFF',
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '9px 12px',
    cursor: 'pointer',
    width: '100%',
    transition: TRANSITION,
  },
  demoRolePill: {
    color: '#fff',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 700,
    minWidth: 60,
    textAlign: 'center',
    flexShrink: 0,
  },
  demoPhone: {
    fontSize: 13,
    color: TEXT,
    fontWeight: 500,
    fontFamily: 'monospace',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: TEXT2,
    paddingBottom: 12,
  },
}
