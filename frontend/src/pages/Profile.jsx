import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram, getSettings } from '../api'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'

const tg = window.Telegram?.WebApp

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

      {/* Profile header */}
      <div style={s.profileCard}>
        <div style={s.avatar}>{initials}</div>
        <div style={s.profileName}>{user.name}</div>
        <div style={s.profilePhone}>{user.phone}</div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.stat}>
          <div style={s.statNum}>{orderCount}</div>
          <div style={s.statLabel}>Заказов</div>
        </div>
        <div style={s.statDiv} />
        <div style={s.stat}>
          <div style={s.statNum}>{bonusPoints.toLocaleString()}</div>
          <div style={s.statLabel}>Бонусы</div>
        </div>
        <div style={s.statDiv} />
        <div style={s.stat}>
          <div style={s.statNum}>{balance.toLocaleString()}</div>
          <div style={s.statLabel}>Баланс</div>
        </div>
      </div>

      {/* Balance */}
      <div style={s.section}>
        <div style={s.balanceCard}>
          <div>
            <div style={{ fontSize: 12, color: '#888' }}>Доступно</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{balance.toLocaleString()} сум</div>
          </div>
          <button style={s.topupBtn} onClick={() => setShowTopup(true)}>+ Пополнить</button>
        </div>
      </div>

      {/* Menu */}
      <div style={s.section}>
        <div style={s.menuCard}>
          <button style={s.menuItem} onClick={() => navigate('/orders')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke="#888" strokeWidth="1.7"/>
              <path d="M7 9h10M7 13h6" stroke="#888" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            <span style={s.menuLabel}>История заказов</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <div style={s.menuDivider} />
          <button style={s.menuItem} onClick={() => navigate('/support')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="#888" strokeWidth="1.7" strokeLinejoin="round"/>
              <path d="M8 9h8M8 13h5" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={s.menuLabel}>Поддержка</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
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
    border: '2.5px solid rgba(76,175,80,0.2)', borderTop: '2.5px solid #4CAF50',
    animation: 'spin 0.8s linear infinite',
  },
  profileCard: {
    background: '#fff', padding: '28px 20px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    borderBottom: '1px solid #f0f0f0',
  },
  avatar: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#4CAF50', color: '#fff',
    fontSize: 26, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  profileName: { fontSize: 18, fontWeight: 700, color: '#111' },
  profilePhone: { fontSize: 14, color: '#888' },

  statsRow: { display: 'flex', background: '#fff', borderBottom: '1px solid #f0f0f0' },
  stat: { flex: 1, padding: '14px 8px', textAlign: 'center' },
  statNum: { fontSize: 18, fontWeight: 800, color: '#111' },
  statLabel: { fontSize: 11, color: '#999', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDiv: { width: 1, background: '#f0f0f0', alignSelf: 'stretch', margin: '10px 0' },

  section: { padding: '12px 16px 0' },
  balanceCard: {
    background: '#fff', borderRadius: 14, padding: '14px 16px',
    border: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  topupBtn: {
    background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },

  menuCard: { background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', overflow: 'hidden' },
  menuItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: 500, color: '#111' },
  menuDivider: { height: 1, background: '#f0f0f0', margin: '0 16px' },

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
    background: '#4CAF50', color: '#fff', fontSize: 16, fontWeight: 700,
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
  amtChipActive: { border: '1.5px solid #4CAF50', background: '#f0faf0', color: '#2e7d32' },
  customWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  customLabel: { fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 },
  customRow: {
    display: 'flex', alignItems: 'center', border: '1.5px solid #eee',
    borderRadius: 12, background: '#f7f7f8', padding: '0 14px', transition: 'all 0.2s',
  },
  customRowActive: { border: '1.5px solid #4CAF50', background: '#fff' },
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
  payAmt: { fontSize: 28, fontWeight: 800, color: '#4CAF50' },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  copyDone: { background: 'rgba(76,175,80,0.15)', borderColor: 'rgba(76,175,80,0.3)', color: '#4CAF50' },
}
