import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram } from '../api'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'

const tg = window.Telegram?.WebApp

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'
const TRANSITION = 'all 0.2s cubic-bezier(0.4,0,0.2,1)'

const TOPUP_AMOUNTS = [500, 1000, 2000, 5000]

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l6-6-6-6" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function MenuRow({ icon, label, desc, value, onClick, danger }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      style={{
        ...s.menuRow,
        ...(danger ? { background: 'none' } : {}),
        cursor: onClick ? 'pointer' : 'default',
        transform: pressed && onClick ? 'scale(0.99)' : 'scale(1)',
        background: pressed && onClick ? '#F9F9F9' : 'none',
      }}
      onClick={onClick}
      disabled={!onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <div style={{
        ...s.menuIconWrap,
        background: danger ? 'rgba(255,59,48,0.1)' : 'rgba(142,142,147,0.1)',
      }}>
        {icon}
      </div>
      <div style={s.menuText}>
        <span style={{ ...s.menuLabel, color: danger ? '#FF3B30' : TEXT }}>{label}</span>
        {desc && <span style={s.menuDesc}>{desc}</span>}
      </div>
      {value && <span style={s.menuValue}>{value}</span>}
      {onClick && <ChevronRight />}
    </button>
  )
}

function MenuSection({ title, children }) {
  return (
    <div style={s.section}>
      {title && <div style={s.sectionTitle}>{title}</div>}
      <div style={s.menuCard}>
        {children}
      </div>
    </div>
  )
}

function MenuDivider() {
  return <div style={s.menuDivider} />
}

// ─── Topup Modal ─────────────────────────────────────────────────────────────
function TopupModal({ onClose }) {
  const [amount, setAmount] = useState(1000)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [step, setStep] = useState('select') // 'select' | 'pending'
  const [loading, setLoading] = useState(false)

  const finalAmount = useCustom ? (Number(custom) || 0) : amount

  const submit = async () => {
    if (!finalAmount || finalAmount < 100) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    setStep('pending')
  }

  return (
    <div style={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modalSheet}>
        <div style={s.modalHandle} />

        {step === 'pending' ? (
          <div style={s.pendingWrap}>
            <div style={s.pendingIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                <path d="M12 7v5l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={s.pendingTitle}>Запрос отправлен</div>
            <div style={s.pendingDesc}>
              Заявка на пополнение <strong>{finalAmount.toLocaleString()} ₸</strong> отправлена.
              Менеджер проверит оплату и зачислит средства в течение нескольких минут.
            </div>
            <div style={s.pendingNote}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#E67700" strokeWidth="1.7"/>
                <path d="M12 8v4M12 16h.01" stroke="#E67700" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Уведомление придёт в Telegram
            </div>
            <button style={s.closeModalBtn} onClick={onClose}>Закрыть</button>
          </div>
        ) : (
          <>
            <div style={s.modalTitle}>Пополнение баланса</div>
            <div style={s.modalSubtitle}>Выберите или введите сумму</div>

            <div style={s.chipRow}>
              {TOPUP_AMOUNTS.map(a => (
                <button
                  key={a}
                  style={{
                    ...s.amountChip,
                    ...(!useCustom && amount === a ? s.amountChipActive : {}),
                  }}
                  onClick={() => { setAmount(a); setUseCustom(false) }}
                >
                  {a.toLocaleString()} ₸
                </button>
              ))}
            </div>

            <div style={s.customInputWrap}>
              <div style={s.customLabel}>Своя сумма</div>
              <div style={{
                ...s.customInputRow,
                ...(useCustom ? s.customInputRowActive : {}),
              }}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={custom}
                  onFocus={() => setUseCustom(true)}
                  onChange={e => { setCustom(e.target.value); setUseCustom(true) }}
                  style={s.customInput}
                />
                <span style={s.customCurrency}>₸</span>
              </div>
            </div>

            {/* Preview card */}
            {finalAmount > 0 && (
              <div style={s.previewCard}>
                <div style={s.previewRow}>
                  <span style={s.previewKey}>Сумма пополнения</span>
                  <span style={s.previewVal}>{finalAmount.toLocaleString()} ₸</span>
                </div>
                <div style={s.previewDivider} />
                <div style={s.previewRow}>
                  <span style={s.previewKey}>Подтверждение</span>
                  <span style={{ ...s.previewVal, color: '#E67700', fontSize: 12 }}>
                    Вручную менеджером
                  </span>
                </div>
              </div>
            )}

            <button
              style={{
                ...s.payModalBtn,
                ...(!finalAmount || finalAmount < 100 ? s.payModalBtnDisabled : {}),
              }}
              onClick={submit}
              disabled={loading || !finalAmount || finalAmount < 100}
            >
              {loading ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ) : `Запросить пополнение · ${finalAmount.toLocaleString()} ₸`}
            </button>
            <button style={s.cancelModalBtn} onClick={onClose}>Отмена</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Profile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogout, setShowLogout] = useState(false)
  const [showTopup, setShowTopup] = useState(false)
  const { logout, user: authUser } = useAuthStore()
  const userStore = useUserStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(u => {
          setUser(u)
          if (!userStore.initialized) userStore.init(u)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (authUser) {
      setUser(authUser)
      if (!userStore.initialized) userStore.init(authUser)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [authUser]) // eslint-disable-line

  const doLogout = () => { logout(); navigate('/login') }

  const balance = userStore.initialized ? userStore.balance : (user?.balance || 0)
  const bonusPoints = userStore.initialized ? userStore.bonus_points : (user?.bonus_points || 0)
  const orderCount = userStore.initialized ? userStore.order_count : (user?.order_count || 0)

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
    </div>
  )

  if (!user) return (
    <div style={s.center}>
      <div style={s.emptyIconWrap}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="5" fill="#F2F2F7" stroke="#C7C7CC" strokeWidth="1.5"/>
          <path d="M3 21C3 18 7 16 12 16C17 16 21 18 21 21" stroke="#C7C7CC" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p style={{ color: TEXT2, fontSize: 14, textAlign: 'center', maxWidth: 220 }}>
        Откройте приложение через Telegram
      </p>
      <button style={s.outlineBtn} onClick={doLogout}>Выйти</button>
    </div>
  )

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={s.page}>
      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}

      {/* Avatar + name card */}
      <div style={s.profileCard}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>{initials}</div>
          <div style={s.avatarOnline} />
        </div>
        <div style={s.profileName}>{user.name}</div>
        <div style={s.profilePhone}>{user.phone}</div>
        <div style={s.memberBadge}>Клиент Everwater</div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{orderCount}</div>
          <div style={s.statLabel}>Заказов</div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={s.statNum}>{bonusPoints.toLocaleString()}</div>
          <div style={s.statLabel}>Бонусы</div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <div style={s.statNum}>{balance.toLocaleString()}</div>
          <div style={s.statLabel}>Баланс ₸</div>
        </div>
      </div>

      {/* Bonus promo */}
      {bonusPoints > 0 && (
        <div style={s.promoCard}>
          <div>
            <div style={s.promoTitle}>Бонусная программа</div>
            <div style={s.promoDesc}>5% с каждого заказа — к оплате следующего</div>
          </div>
          <div style={s.promoBadge}>
            <span style={s.promoBadgeNum}>{bonusPoints.toLocaleString()}</span>
            <span style={s.promoBadgeLabel}>бонусов</span>
          </div>
        </div>
      )}

      {/* Balance section */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Баланс</div>
        <div style={{ ...s.menuCard, overflow: 'visible' }}>
          <div style={s.balanceRow}>
            <div>
              <div style={s.balanceLabel}>Доступно</div>
              <div style={s.balanceAmount}>{balance.toLocaleString()} ₸</div>
            </div>
            <button style={s.topupBtn} onClick={() => setShowTopup(true)}>
              + Пополнить
            </button>
          </div>
        </div>
      </div>

      {/* Account section */}
      <MenuSection title="Аккаунт">
        <MenuRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill={TEXT2}/>
            </svg>
          }
          label="Телефон"
          value={user.phone || 'Не указан'}
        />
        <MenuDivider />
        <MenuRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke={TEXT2} strokeWidth="1.7"/>
              <path d="M7 9h10M7 13h6" stroke={TEXT2} strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          }
          label="История заказов"
          desc="Все ваши заказы"
          onClick={() => navigate('/orders')}
        />
        <MenuDivider />
        <MenuRow
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={TEXT2} strokeWidth="1.7" strokeLinejoin="round"/>
              <path d="M8 9h8M8 13h5" stroke={TEXT2} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
          label="Поддержка"
          desc="Чат с командой Everwater"
          onClick={() => navigate('/support')}
        />
      </MenuSection>

      {/* Logout */}
      {!tg?.initDataUnsafe?.user && (
        <MenuSection>
          {!showLogout ? (
            <MenuRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C4.5 21 4 20.5 4 20V4C4 3.5 4.5 3 5 3H9M16 17L21 12L16 7M21 12H9" stroke="#FF3B30" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="Выйти из аккаунта"
              danger
              onClick={() => setShowLogout(true)}
            />
          ) : (
            <div style={s.logoutConfirm}>
              <div style={s.logoutTitle}>Выйти из аккаунта?</div>
              <div style={s.logoutDesc}>Вам потребуется снова войти</div>
              <div style={s.logoutBtns}>
                <button style={s.cancelBtn} onClick={() => setShowLogout(false)}>Отмена</button>
                <button style={s.confirmBtn} onClick={doLogout}>Выйти</button>
              </div>
            </div>
          )}
        </MenuSection>
      )}

      <div style={{ height: 120 }} />
    </div>
  )
}

const s = {
  page: {
    background: BG,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    height: '70vh',
    padding: '0 32px',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${BORDER}`,
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)',
    borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  outlineBtn: {
    border: `1.5px solid ${BORDER}`,
    background: '#FFFFFF',
    color: TEXT,
    borderRadius: 12,
    padding: '11px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  profileCard: {
    background: '#FFFFFF',
    padding: '32px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    borderBottom: `1px solid ${BORDER}`,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${C} 0%, ${CD} 100%)`,
    color: '#fff',
    fontSize: 30,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: -1,
    boxShadow: `0 6px 24px rgba(141,198,63,0.35)`,
  },
  avatarOnline: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#34C759',
    border: '2.5px solid #FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: -0.3,
  },
  profilePhone: {
    fontSize: 14,
    color: TEXT2,
    fontWeight: 400,
  },
  memberBadge: {
    background: 'rgba(141,198,63,0.12)',
    color: CD,
    borderRadius: 999,
    padding: '4px 14px',
    fontSize: 12,
    fontWeight: 600,
    marginTop: 4,
    border: '1px solid rgba(141,198,63,0.2)',
  },
  statsRow: {
    background: '#FFFFFF',
    display: 'flex',
    borderBottom: `1px solid ${BORDER}`,
  },
  statCard: {
    flex: 1,
    padding: '16px 8px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    background: BORDER,
    alignSelf: 'stretch',
    margin: '12px 0',
  },
  statNum: {
    fontSize: 20,
    fontWeight: 800,
    color: TEXT,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: TEXT2,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  promoCard: {
    background: '#FFFFFF',
    margin: '12px 16px 0',
    borderRadius: 16,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: `1px solid ${BORDER}`,
    gap: 12,
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: TEXT,
    marginBottom: 3,
  },
  promoDesc: {
    fontSize: 12,
    color: TEXT2,
    lineHeight: 1.4,
    maxWidth: 200,
  },
  promoBadge: {
    background: 'rgba(141,198,63,0.12)',
    borderRadius: 12,
    padding: '8px 14px',
    textAlign: 'center',
    flexShrink: 0,
    border: '1px solid rgba(141,198,63,0.2)',
  },
  promoBadgeNum: {
    display: 'block',
    fontSize: 20,
    fontWeight: 800,
    color: C,
    letterSpacing: -0.5,
    lineHeight: 1.1,
  },
  promoBadgeLabel: {
    fontSize: 11,
    color: CD,
    fontWeight: 600,
  },
  section: {
    padding: '16px 16px 0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: TEXT2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuCard: {
    background: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  },
  menuRow: {
    width: '100%',
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    transition: TRANSITION,
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: 500,
  },
  menuDesc: {
    fontSize: 12,
    color: TEXT2,
  },
  menuValue: {
    fontSize: 14,
    color: TEXT2,
    fontWeight: 400,
    marginRight: 4,
  },
  menuDivider: {
    height: 1,
    background: BORDER,
    margin: '0 16px',
  },
  // Balance
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px',
  },
  balanceLabel: {
    fontSize: 12,
    color: TEXT2,
    fontWeight: 500,
    marginBottom: 3,
  },
  balanceAmount: {
    fontSize: 26,
    fontWeight: 800,
    color: TEXT,
    letterSpacing: -0.5,
  },
  topupBtn: {
    background: `linear-gradient(135deg, #8DC63F 0%, #6CA32F 100%)`,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(141,198,63,0.35)',
    transition: TRANSITION,
    WebkitTapHighlightColor: 'transparent',
  },
  // Topup modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(4px)',
    zIndex: 9000,
    display: 'flex',
    alignItems: 'flex-end',
  },
  modalSheet: {
    background: '#FFFFFF',
    borderRadius: '20px 20px 0 0',
    width: '100%',
    padding: '12px 20px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    background: '#E0E0E5',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: TEXT,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: TEXT2,
    textAlign: 'center',
    marginTop: -8,
  },
  chipRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  amountChip: {
    flex: '1 1 calc(50% - 4px)',
    padding: '13px 8px',
    borderRadius: 12,
    border: `1.5px solid ${BORDER}`,
    background: '#F5F5F7',
    fontSize: 15,
    fontWeight: 700,
    color: TEXT,
    cursor: 'pointer',
    transition: TRANSITION,
    textAlign: 'center',
  },
  amountChipActive: {
    background: 'rgba(141,198,63,0.1)',
    border: `1.5px solid ${C}`,
    color: CD,
  },
  customInputWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  customLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: TEXT2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  customInputRow: {
    display: 'flex',
    alignItems: 'center',
    border: `1.5px solid ${BORDER}`,
    borderRadius: 12,
    background: '#FAFAFA',
    padding: '0 14px',
    transition: TRANSITION,
  },
  customInputRowActive: {
    border: `1.5px solid ${C}`,
    boxShadow: `0 0 0 3px rgba(141,198,63,0.15)`,
    background: '#fff',
  },
  customInput: {
    flex: 1,
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    padding: '13px 0',
    width: '100%',
    fontFamily: 'inherit',
  },
  customCurrency: {
    fontSize: 20,
    fontWeight: 700,
    color: TEXT2,
    paddingLeft: 4,
  },
  previewCard: {
    background: '#F5F5F7',
    borderRadius: 14,
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewKey: {
    fontSize: 13,
    color: TEXT2,
    fontWeight: 500,
  },
  previewVal: {
    fontSize: 15,
    fontWeight: 700,
    color: TEXT,
  },
  previewDivider: {
    height: 1,
    background: BORDER,
  },
  payModalBtn: {
    width: '100%',
    padding: '16px 0',
    borderRadius: 14,
    border: 'none',
    background: `linear-gradient(135deg, #8DC63F 0%, #6CA32F 100%)`,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(141,198,63,0.4)',
    transition: TRANSITION,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payModalBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  cancelModalBtn: {
    width: '100%',
    padding: '14px 0',
    borderRadius: 14,
    border: `1.5px solid ${BORDER}`,
    background: 'none',
    color: TEXT2,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: -4,
  },
  // Pending state
  pendingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    padding: '8px 0 8px',
    textAlign: 'center',
  },
  pendingIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#E67700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(230,119,0,0.3)',
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: TEXT,
    letterSpacing: -0.3,
  },
  pendingDesc: {
    fontSize: 14,
    color: TEXT2,
    lineHeight: 1.6,
    maxWidth: 300,
  },
  pendingNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#FFF8E6',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#E67700',
    fontWeight: 600,
    border: '1px solid #FFD8A8',
  },
  closeModalBtn: {
    width: '100%',
    padding: '15px 0',
    borderRadius: 14,
    border: 'none',
    background: `linear-gradient(135deg, #8DC63F 0%, #6CA32F 100%)`,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(141,198,63,0.4)',
    marginTop: 4,
  },
  // Logout
  logoutConfirm: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  logoutTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#FF3B30',
    letterSpacing: -0.2,
  },
  logoutDesc: {
    fontSize: 13,
    color: TEXT2,
    textAlign: 'center',
  },
  logoutBtns: {
    display: 'flex',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    padding: '13px 0',
    borderRadius: 12,
    border: `1.5px solid ${BORDER}`,
    background: BG,
    color: TEXT,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: TRANSITION,
  },
  confirmBtn: {
    flex: 1,
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    background: '#FF3B30',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: TRANSITION,
  },
}
