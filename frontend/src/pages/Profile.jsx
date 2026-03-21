import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram, getSettings } from '../api'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'

const tg = window.Telegram?.WebApp
const C = '#8DC63F'

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
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFA726', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
              <path d="M12 7v5l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Запрос отправлен</div>
          <div style={{ fontSize: 14, color: '#888', marginTop: 6 }}>
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
            <span style={{ fontSize: 18, fontWeight: 600, color: '#999' }}>сум</span>
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
      <p style={{ color: '#888', fontSize: 14 }}>Откройте через Telegram</p>
      <button style={s.ghostBtn} onClick={doLogout}>Выйти</button>
    </div>
  )

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={s.page}>
      {showTopup && <TopupModal onClose={() => setShowTopup(false)} settings={settings} />}

      {/* Profile header with gradient */}
      <div style={s.profileBanner}>
        <div style={s.bannerBg} />
        <div style={s.avatar}>{initials}</div>
        <div style={s.profileName}>{user.name}</div>
        <div style={s.profilePhone}>{user.phone}</div>
      </div>

      {/* Stats row */}
      <div style={s.statsCard}>
        <div style={s.stat}>
          <div style={s.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke={C} strokeWidth="1.8"/>
              <path d="M8 8h8M8 12h5" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={s.statNum}>{orderCount}</div>
          <div style={s.statLabel}>Заказов</div>
        </div>
        <div style={s.statDiv} />
        <div style={s.stat}>
          <div style={s.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#F59E0B" strokeWidth="1.8" fill="#FEF3C7"/>
            </svg>
          </div>
          <div style={s.statNum}>{bonusPoints.toLocaleString()}</div>
          <div style={s.statLabel}>Бонусы</div>
        </div>
        <div style={s.statDiv} />
        <div style={s.stat}>
          <div style={s.statIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="3" stroke={C} strokeWidth="1.8"/>
              <path d="M2 10h20" stroke={C} strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={s.statNum}>{balance.toLocaleString()}</div>
          <div style={s.statLabel}>Баланс</div>
        </div>
      </div>

      {/* Balance card */}
      <div style={s.section}>
        <div style={s.balanceCard}>
          <div style={s.balanceLeft}>
            <div style={s.balanceLabel}>Доступно на балансе</div>
            <div style={s.balanceAmount}>{balance.toLocaleString()} <span style={s.balanceCurrency}>сум</span></div>
          </div>
          <button style={s.topupBtn} onClick={() => setShowTopup(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Пополнить
          </button>
        </div>
      </div>

      {/* Bonus info */}
      {bonusPoints > 0 && (
        <div style={s.section}>
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
        </div>
      )}

      {/* Menu */}
      <div style={s.section}>
        <div style={s.menuCard}>
          <button style={s.menuItem} onClick={() => navigate('/orders')}>
            <div style={{ ...s.menuIcon, background: '#f0faf0' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="3" stroke={C} strokeWidth="1.7"/>
                <path d="M7 9h10M7 13h6" stroke={C} strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={s.menuLabel}>История заказов</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <div style={s.menuDivider} />
          <button style={s.menuItem} onClick={() => navigate('/support')}>
            <div style={{ ...s.menuIcon, background: '#EBF4FF' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="#3B82F6" strokeWidth="1.7" strokeLinejoin="round"/>
                <path d="M8 9h8M8 13h5" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={s.menuLabel}>Поддержка</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <div style={s.menuDivider} />
          <button style={s.menuItem} onClick={() => navigate('/')}>
            <div style={{ ...s.menuIcon, background: '#FEF3C7' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F59E0B" strokeWidth="1.7" strokeLinejoin="round"/>
                <path d="M9 22V12h6v10" stroke="#F59E0B" strokeWidth="1.7" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={s.menuLabel}>Каталог</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* Info section */}
      <div style={s.section}>
        <div style={s.infoCard}>
          <div style={s.infoRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" fill={C}/>
            </svg>
            <span style={s.infoText}>Проверенное качество воды</span>
          </div>
          <div style={s.infoRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.8"/>
              <path d="M12 7v5l3 3" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={s.infoText}>Доставка от 1 часа</span>
          </div>
          <div style={s.infoRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="7" r="4" stroke={C} strokeWidth="1.8"/>
            </svg>
            <span style={s.infoText}>Персональные бонусы</span>
          </div>
        </div>
      </div>

      {/* Logout */}
      {!tg?.initDataUnsafe?.user && (
        <div style={s.section}>
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
        </div>
      )}
      <div style={{ height: 100 }} />
    </div>
  )
}

const s = {
  page: { background: '#fafafa', minHeight: '100dvh' },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, height: '70vh', padding: '0 32px',
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `2.5px solid ${C}30`, borderTop: `2.5px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },

  profileBanner: {
    background: '#fff', padding: '24px 20px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    position: 'relative', overflow: 'hidden',
  },
  bannerBg: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80,
    background: `linear-gradient(135deg, ${C}20 0%, ${C}08 100%)`,
  },
  avatar: {
    width: 72, height: 72, borderRadius: '50%',
    background: `linear-gradient(135deg, ${C} 0%, #6CA32F 100%)`,
    color: '#fff', fontSize: 26, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, position: 'relative', zIndex: 1,
    boxShadow: `0 4px 12px ${C}40`,
  },
  profileName: { fontSize: 18, fontWeight: 700, color: '#111', position: 'relative', zIndex: 1 },
  profilePhone: { fontSize: 14, color: '#888', position: 'relative', zIndex: 1 },

  statsCard: {
    display: 'flex', background: '#fff', margin: '8px 16px',
    borderRadius: 14, border: '1px solid #f0f0f0', padding: '4px 0',
  },
  stat: { flex: 1, padding: '12px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statIcon: { display: 'flex' },
  statNum: { fontSize: 18, fontWeight: 800, color: '#111' },
  statLabel: { fontSize: 11, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDiv: { width: 1, background: '#f0f0f0', alignSelf: 'stretch', margin: '10px 0' },

  section: { padding: '0 16px', marginTop: 10 },

  balanceCard: {
    background: '#fff', borderRadius: 14, padding: '16px',
    border: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  balanceLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  balanceLabel: { fontSize: 12, color: '#888' },
  balanceAmount: { fontSize: 22, fontWeight: 800, color: '#111' },
  balanceCurrency: { fontSize: 14, fontWeight: 400, color: '#888' },
  topupBtn: {
    background: C, color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  },

  bonusCard: {
    background: '#FFFBEB', borderRadius: 14, padding: '14px 16px',
    border: '1px solid #FEF3C7',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  bonusIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bonusTitle: { fontSize: 15, fontWeight: 700, color: '#92400E' },
  bonusDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },

  menuCard: { background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', overflow: 'hidden' },
  menuItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left',
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: 500, color: '#111' },
  menuDivider: { height: 1, background: '#f0f0f0', margin: '0 16px' },

  infoCard: {
    background: '#fff', borderRadius: 14, padding: '14px 16px',
    border: '1px solid #f0f0f0',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  infoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 13, color: '#666', fontWeight: 500 },

  logoutBtn: {
    width: '100%', background: 'none', border: '1px solid #fecaca',
    borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 600,
    color: '#ef4444', cursor: 'pointer', textAlign: 'center',
  },
  logoutCard: {
    background: '#fff', borderRadius: 14, padding: 16,
    border: '1px solid #f0f0f0', textAlign: 'center',
  },
  cancelBtn: {
    flex: 1, padding: '12px', borderRadius: 10,
    border: '1px solid #eee', background: '#f7f7f8',
    fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer',
  },
  confirmLogout: {
    flex: 1, padding: '12px', borderRadius: 10,
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
  sheetTitle: { fontSize: 18, fontWeight: 700, color: '#111', textAlign: 'center' },
  primaryBtn: {
    width: '100%', height: 50, borderRadius: 14, border: 'none',
    background: C, color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ghostBtn: {
    width: '100%', padding: '12px', borderRadius: 14,
    border: 'none', background: '#f2f2f3',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#888',
    textAlign: 'center',
  },
  amtChip: {
    padding: '14px 8px', borderRadius: 12, border: '1.5px solid #eee',
    background: '#f7f7f8', fontSize: 15, fontWeight: 700, color: '#111',
    cursor: 'pointer', textAlign: 'center',
  },
  amtChipActive: { border: `1.5px solid ${C}`, background: '#f0faf0', color: '#6CA32F' },
  customWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  customLabel: { fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 },
  customRow: {
    display: 'flex', alignItems: 'center', border: '1.5px solid #eee',
    borderRadius: 12, background: '#f7f7f8', padding: '0 14px', transition: 'all 0.2s',
  },
  customRowActive: { border: `1.5px solid ${C}`, background: '#fff' },
  customInput: {
    flex: 1, border: 'none', background: 'none', outline: 'none',
    fontSize: 20, fontWeight: 700, color: '#111', padding: '12px 0', fontFamily: 'inherit',
  },

  // Payment card
  payCard: {
    background: '#111', borderRadius: 16, padding: '16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  payNum: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3, fontFamily: 'monospace' },
  payHolder: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 },
  payAmt: { fontSize: 28, fontWeight: 800, color: C },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  copyDone: { background: `${C}25`, borderColor: `${C}50`, color: C },
}
