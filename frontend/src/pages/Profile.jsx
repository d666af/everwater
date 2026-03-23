import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram, getSettings } from '../api'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'

const tg = window.Telegram?.WebApp
const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const TOPUP_AMOUNTS = [500, 1000, 2000, 5000]

function TopupModal({ onClose, settings }) {
  const [amount, setAmount] = useState(1000)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [step, setStep] = useState('select')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const finalAmount = useCustom ? (Number(custom) || 0) : amount

  const copyCard = () => {
    navigator.clipboard?.writeText(settings?.payment_card || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (step === 'pending') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={s.pendingIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
              <path d="M12 7v5l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Запрос отправлен</div>
          <div style={{ fontSize: 14, color: '#8e8e93', marginTop: 6, lineHeight: 1.5 }}>
            Заявка на <strong>{finalAmount.toLocaleString()} сум</strong> отправлена.
            Менеджер проверит и зачислит средства.
          </div>
        </div>
        <button style={s.primaryBtn} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  )

  if (step === 'payment') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Оплата пополнения</div>
        <div style={s.payCard}>
          <div style={s.payLabel}>Переведите на карту</div>
          <div style={s.payNum}>{settings?.payment_card || '0000 0000 0000 0000'}</div>
          <div style={s.payHolder}>{settings?.payment_holder || '—'}</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Сумма</div>
          <div style={s.payAmt}>{finalAmount.toLocaleString()} <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>сум</span></div>
          <button style={{ ...s.copyBtn, ...(copied ? s.copyDone : {}) }} onClick={copyCard}>
            {copied ? 'Скопировано' : 'Скопировать номер карты'}
          </button>
        </div>
        <div style={s.helpSteps}>
          <div style={s.helpStep}><span style={s.helpNum}>1</span> Переведите сумму на карту</div>
          <div style={s.helpStep}><span style={s.helpNum}>2</span> Нажмите «Я оплатил»</div>
          <div style={s.helpStep}><span style={s.helpNum}>3</span> Менеджер подтвердит зачисление</div>
        </div>
        <button style={s.primaryBtn} onClick={async () => {
          setLoading(true); await new Promise(r => setTimeout(r, 1000)); setLoading(false); setStep('pending')
        }} disabled={loading}>
          {loading ? <span style={s.spinner} /> : 'Я оплатил'}
        </button>
        <button style={s.ghostBtn} onClick={() => setStep('select')}>Назад</button>
      </div>
    </div>
  )

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Пополнение баланса</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TOPUP_AMOUNTS.map(a => (
            <button key={a}
              style={!useCustom && amount === a ? { ...s.amtChip, ...s.amtChipActive } : s.amtChip}
              onClick={() => { setAmount(a); setUseCustom(false) }}
            >
              {a.toLocaleString()} сум
            </button>
          ))}
        </div>
        <div style={s.customWrap}>
          <div style={s.customLabel}>Своя сумма</div>
          <div style={{ ...s.customRow, ...(useCustom ? s.customRowActive : {}) }}>
            <input type="number" inputMode="numeric" placeholder="0"
              value={custom}
              onFocus={() => setUseCustom(true)}
              onChange={e => { setCustom(e.target.value); setUseCustom(true) }}
              style={s.customInput}
            />
            <span style={{ fontSize: 18, fontWeight: 600, color: '#8e8e93' }}>сум</span>
          </div>
        </div>
        <button style={{ ...s.primaryBtn, ...((!finalAmount || finalAmount < 100) ? { opacity: 0.5 } : {}) }}
          onClick={() => setStep('payment')} disabled={!finalAmount || finalAmount < 100}>
          К оплате · {finalAmount > 0 ? `${finalAmount.toLocaleString()} сум` : '—'}
        </button>
        <button style={s.ghostBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

export default function Profile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogout, setShowLogout] = useState(false)
  const [showTopup, setShowTopup] = useState(false)
  const [lang, setLang] = useState('ru')
  const [settings, setSettings] = useState({ payment_card: '', payment_holder: '' })
  const { logout, user: authUser } = useAuthStore()
  const userStore = useUserStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(u => { setUser(u); if (!userStore.initialized) userStore.init(u) })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (authUser) {
      setUser(authUser)
      if (!userStore.initialized) userStore.init(authUser)
      setLoading(false)
    } else {
      setLoading(false)
    }
    getSettings().then(setSettings).catch(console.error)
  }, [authUser]) // eslint-disable-line

  const doLogout = () => { logout(); navigate('/login') }

  const balance = userStore.initialized ? userStore.balance : (user?.balance || 0)
  const bonusPoints = userStore.initialized ? userStore.bonus_points : (user?.bonus_points || 0)
  const orderCount = userStore.initialized ? userStore.order_count : (user?.order_count || 0)

  if (loading) return (
    <div style={s.center}><div style={s.spinner} /></div>
  )

  if (!user) return (
    <div style={s.center}>
      <p style={{ color: '#8e8e93', fontSize: 14 }}>Откройте через Telegram</p>
      <button style={s.ghostBtn} onClick={doLogout}>Выйти</button>
    </div>
  )

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={s.page}>
      {showTopup && <TopupModal onClose={() => setShowTopup(false)} settings={settings} />}

      {/* Order count badge — top right */}
      <div style={s.orderBadge}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke={C} strokeWidth="1.8"/>
          <path d="M8 8h8M8 12h5" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span style={s.orderBadgeNum}>{orderCount}</span>
        <span style={s.orderBadgeLabel}>заказов</span>
      </div>

      {/* Avatar + name */}
      <div style={s.profileHeader}>
        <div style={s.avatar}>{initials}</div>
        <div style={s.profileName}>{user.name}</div>
        <div style={s.profilePhone}>{user.phone}</div>
      </div>

      {/* Balance card */}
      <div style={s.balanceCard}>
        <div style={s.balanceTop}>
          <div style={s.balanceIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="3" stroke="#fff" strokeWidth="1.8"/>
              <path d="M2 10h20" stroke="#fff" strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.balanceLabel}>Баланс</div>
            <div style={s.balanceAmount}>{balance.toLocaleString()} <span style={s.balanceCurrency}>сум</span></div>
          </div>
          <button style={s.topupBtn} onClick={() => setShowTopup(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Пополнить
          </button>
        </div>
      </div>

      {/* Bonus card */}
      {bonusPoints > 0 && (
        <div style={s.bonusCard}>
          <div style={s.bonusIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#F59E0B"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.bonusTitle}>{bonusPoints.toLocaleString()} бонусов</div>
            <div style={s.bonusDesc}>Используйте при оформлении заказа</div>
          </div>
        </div>
      )}

      {/* Menu */}
      <div style={s.menuCard}>
        <button style={s.menuItem} onClick={() => navigate('/support')}>
          <div style={{ ...s.menuIcon, background: `${C}12` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={C} strokeWidth="1.7" strokeLinejoin="round"/>
              <path d="M8 9h8M8 13h5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={s.menuLabel}>Поддержка</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div style={s.menuDivider} />
        <div style={s.menuItem}>
          <div style={{ ...s.menuIcon, background: `${C}12` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.7"/>
              <path d="M2 12h20" stroke={C} strokeWidth="1.7"/>
              <ellipse cx="12" cy="12" rx="4" ry="9" stroke={C} strokeWidth="1.7"/>
            </svg>
          </div>
          <span style={s.menuLabel}>Язык</span>
          <div style={s.langSwitch}>
            <button
              style={lang === 'ru' ? { ...s.langBtn, ...s.langBtnActive } : s.langBtn}
              onClick={() => setLang('ru')}
            >RU</button>
            <button
              style={lang === 'uz' ? { ...s.langBtn, ...s.langBtnActive } : s.langBtn}
              onClick={() => setLang('uz')}
            >UZ</button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={s.infoCard}>
        <div style={s.infoRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" fill={C}/>
          </svg>
          <span style={s.infoText}>Проверенное качество воды</span>
        </div>
        <div style={s.infoRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.8"/>
            <path d="M12 7v5l3 3" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={s.infoText}>Доставка от 1 часа</span>
        </div>
        <div style={s.infoRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="7" r="4" stroke={C} strokeWidth="1.8"/>
          </svg>
          <span style={s.infoText}>Персональные бонусы</span>
        </div>
      </div>

      {/* Logout */}
      {!tg?.initDataUnsafe?.user && (
        <>
          {!showLogout ? (
            <button style={s.logoutBtn} onClick={() => setShowLogout(true)}>Выйти из аккаунта</button>
          ) : (
            <div style={s.logoutCard}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>Выйти?</div>
              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
                <button style={s.cancelBtn} onClick={() => setShowLogout(false)}>Отмена</button>
                <button style={s.confirmLogout} onClick={doLogout}>Выйти</button>
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 100 }} />
    </div>
  )
}

const s = {
  page: {
    background: '#e4e4e8', minHeight: '100dvh',
    display: 'flex', flexDirection: 'column', gap: 10,
    paddingTop: 4, position: 'relative',
  },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, height: '70vh', padding: '0 32px',
    background: '#e4e4e8',
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `2.5px solid ${C}30`, borderTop: `2.5px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },

  /* Order badge top-right */
  orderBadge: {
    position: 'absolute', top: 12, right: 16,
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff', borderRadius: 12, padding: '6px 12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  orderBadgeNum: { fontSize: 15, fontWeight: 800, color: '#1a1a1a' },
  orderBadgeLabel: { fontSize: 12, color: '#8e8e93', fontWeight: 500 },

  /* Profile header */
  profileHeader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '20px 20px 8px', gap: 4,
  },
  avatar: {
    width: 72, height: 72, borderRadius: '50%',
    background: GRAD,
    color: '#fff', fontSize: 26, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    boxShadow: '0 4px 16px rgba(100,160,30,0.35)',
  },
  profileName: { fontSize: 20, fontWeight: 700, color: '#1a1a1a' },
  profilePhone: { fontSize: 14, color: '#8e8e93' },

  /* Balance */
  balanceCard: {
    background: GRAD, margin: '0 16px',
    borderRadius: 18, padding: '16px 16px',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  balanceTop: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  balanceIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
  balanceAmount: { fontSize: 22, fontWeight: 800, color: '#fff' },
  balanceCurrency: { fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.6)' },
  topupBtn: {
    background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },

  /* Bonus */
  bonusCard: {
    background: '#fff', margin: '0 16px',
    borderRadius: 18, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  bonusIcon: {
    width: 42, height: 42, borderRadius: 14,
    background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bonusTitle: { fontSize: 15, fontWeight: 700, color: '#92400E' },
  bonusDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },

  /* Menu */
  menuCard: {
    background: '#fff', margin: '0 16px', borderRadius: 18,
    overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  menuItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left',
  },
  menuIcon: {
    width: 38, height: 38, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: 600, color: '#1a1a1a' },
  menuDivider: { height: 1, background: '#f0f0f2', margin: '0 16px' },

  /* Language switcher */
  langSwitch: {
    display: 'flex', gap: 4, background: '#f0f0f2', borderRadius: 10, padding: 3,
  },
  langBtn: {
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: 'none', fontSize: 13, fontWeight: 700,
    color: '#8e8e93', cursor: 'pointer',
  },
  langBtnActive: {
    background: '#fff', color: C,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },

  /* Info */
  infoCard: {
    background: '#fff', margin: '0 16px', borderRadius: 18,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  infoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 13, color: '#3c3c43', fontWeight: 500 },

  /* Logout */
  logoutBtn: {
    margin: '0 16px', background: '#fff', border: 'none',
    borderRadius: 18, padding: '14px', fontSize: 15, fontWeight: 600,
    color: '#ef4444', cursor: 'pointer', textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  logoutCard: {
    background: '#fff', margin: '0 16px', borderRadius: 18,
    padding: 16, textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cancelBtn: {
    flex: 1, padding: '12px', borderRadius: 12,
    border: 'none', background: '#f0f0f2',
    fontSize: 14, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
  },
  confirmLogout: {
    flex: 1, padding: '12px', borderRadius: 12,
    border: 'none', background: '#ef4444',
    fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)', zIndex: 9000,
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    background: '#fff', borderRadius: '18px 18px 0 0', width: '100%',
    padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 12,
    animation: 'slideUp 0.25s ease', maxHeight: '88vh', overflowY: 'auto',
  },
  handle: { width: 36, height: 4, borderRadius: 2, background: '#ddd', alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', textAlign: 'center' },
  pendingIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#FFA726',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
  },
  primaryBtn: {
    width: '100%', height: 50, borderRadius: 14, border: 'none',
    background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  ghostBtn: {
    width: '100%', padding: '12px', borderRadius: 14,
    border: 'none', background: '#f0f0f2',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#8e8e93',
    textAlign: 'center',
  },
  amtChip: {
    padding: '14px 8px', borderRadius: 14, border: '1.5px solid #e5e5ea',
    background: '#fff', fontSize: 15, fontWeight: 700, color: '#1a1a1a',
    cursor: 'pointer', textAlign: 'center',
  },
  amtChipActive: { border: `1.5px solid ${C}`, background: `${C}08`, color: C },
  customWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  customLabel: { fontSize: 12, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.4 },
  customRow: {
    display: 'flex', alignItems: 'center', border: '1.5px solid #e5e5ea',
    borderRadius: 14, background: '#fff', padding: '0 14px', transition: 'all 0.2s',
  },
  customRowActive: { border: `1.5px solid ${C}`, background: '#fff' },
  customInput: {
    flex: 1, border: 'none', background: 'none', outline: 'none',
    fontSize: 20, fontWeight: 700, color: '#1a1a1a', padding: '12px 0', fontFamily: 'inherit',
  },

  // Payment card in modal
  payCard: {
    background: '#1a1a1a', borderRadius: 18, padding: '16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  payNum: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3, fontFamily: 'monospace' },
  payHolder: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 },
  payAmt: { fontSize: 28, fontWeight: 800, color: C },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  copyDone: { background: `${C}25`, borderColor: `${C}50`, color: C },

  // Help steps in payment modal
  helpSteps: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: '#f8f8fa', borderRadius: 14, padding: 14,
  },
  helpStep: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  helpNum: {
    width: 26, height: 26, borderRadius: '50%', background: GRAD, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
}
