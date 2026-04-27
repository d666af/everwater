import { useEffect, useState } from 'react'
import { getSettings, getUserByTelegram } from '../api'
import { useUserStore } from '../store/user'
import { useAuthStore } from '../store/auth'
import { SubscriptionModal, SubscriptionDetail } from './Profile'

const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const tg = window.Telegram?.WebApp

export default function Subscription() {
  const userStore = useUserStore()
  const authUser = useAuthStore(s => s.user)
  const [settings, setSettings] = useState({ payment_card: '', payment_holder: '' })
  const [showSub, setShowSub] = useState(false)
  const [subDetail, setSubDetail] = useState(null)

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
    if (!userStore.initialized) {
      const tgUser = tg?.initDataUnsafe?.user
      if (tgUser?.id) {
        getUserByTelegram(tgUser.id).then(u => { if (u) userStore.init(u) }).catch(() => {})
      } else if (authUser) {
        userStore.init(authUser)
      }
    }
  }, [])

  const subs = userStore.subscriptions || []

  return (
    <div style={s.page}>
      {showSub && <SubscriptionModal onClose={() => setShowSub(false)} settings={settings} userStore={userStore} />}
      {subDetail && (
        <SubscriptionDetail
          sub={subDetail}
          onClose={() => setSubDetail(null)}
          onExtend={() => { setSubDetail(null); setShowSub(true) }}
          onCancel={(id) => {
            const list = userStore.subscriptions.filter(x => x.id !== id)
            localStorage.setItem('everwater_subscriptions', JSON.stringify(list))
            useUserStore.setState({ subscriptions: list })
          }}
        />
      )}

      <div style={s.hero}>
        <div style={s.heroIcon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <path d="M3 3v5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={s.heroTitle}>Подписка на воду</div>
        <div style={s.heroDesc}>Регулярная доставка со скидкой</div>
      </div>

      {subs.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={s.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="3" stroke="#c7c7cc" strokeWidth="1.8"/>
              <path d="M3 10h18" stroke="#c7c7cc" strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={s.emptyTitle}>У вас пока нет активных подписок</div>
          <div style={s.emptyDesc}>Оформите подписку — и мы будем доставлять воду регулярно</div>
        </div>
      ) : (
        <div style={s.list}>
          {subs.map(sub => {
            const endDate = new Date(sub.created)
            endDate.setDate(endDate.getDate() + (sub.plan === 'weekly' ? 7 : 30))
            const daysLeft = Math.max(0, Math.ceil((endDate - Date.now()) / 86400000))
            const isExpiring = daysLeft <= 3
            return (
              <div key={sub.id} style={s.subCard} onClick={() => setSubDetail(sub)}>
                <div style={{ ...s.subIcon, background: isExpiring ? 'linear-gradient(135deg, #FF6B6B, #E03131)' : 'linear-gradient(135deg, #4FC3F7, #2196F3)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M3 3v5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.subTitle}>{sub.plan === 'weekly' ? 'Еженедельная' : 'Ежемесячная'}</div>
                  <div style={s.subDesc}>
                    {sub.water}
                    {isExpiring ? ` · ${daysLeft} дн.` : ` · до ${endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`}
                  </div>
                </div>
                {isExpiring && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E03131', flexShrink: 0 }} />}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            )
          })}
        </div>
      )}

      <button style={s.createBtn} onClick={() => setShowSub(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        {subs.length > 0 ? 'Новая подписка' : 'Оформить подписку'}
      </button>

      <div style={s.benefits}>
        <div style={s.benefitsTitle}>Преимущества подписки</div>
        <div style={s.benefitRow}>
          <div style={s.benefitIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={s.benefitText}>Автоматическая доставка по расписанию</span>
        </div>
        <div style={s.benefitRow}>
          <div style={s.benefitIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={s.benefitText}>Фиксированная цена — без повышений</span>
        </div>
        <div style={s.benefitRow}>
          <div style={s.benefitIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={s.benefitText}>Отмена или пауза в любой момент</span>
        </div>
      </div>

      <div style={{ height: 100 }} />
    </div>
  )
}

const s = {
  page: {
    background: '#e4e4e8', minHeight: '100dvh',
    display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8,
  },
  hero: {
    margin: '0 16px', background: GRAD, borderRadius: 20, padding: '22px 20px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    boxShadow: '0 4px 18px rgba(100,160,30,0.3)', textAlign: 'center',
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.22)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  heroTitle: { fontSize: 20, fontWeight: 800, color: '#fff' },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  list: { margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  subCard: {
    background: '#fff', borderRadius: 18, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer',
  },
  subIcon: {
    width: 42, height: 42, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  subTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  subDesc: { fontSize: 12, color: '#8e8e93', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  emptyCard: {
    margin: '0 16px', background: '#fff', borderRadius: 18,
    padding: '28px 20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: '50%', background: '#f0f0f2',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  emptyDesc: { fontSize: 13, color: '#8e8e93', lineHeight: 1.4, maxWidth: 260 },
  createBtn: {
    margin: '0 16px', background: GRAD, color: '#fff', border: 'none',
    borderRadius: 16, padding: '14px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  benefits: {
    margin: '0 16px', background: '#fff', borderRadius: 18,
    padding: '16px', display: 'flex', flexDirection: 'column', gap: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  benefitsTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 },
  benefitRow: { display: 'flex', alignItems: 'center', gap: 10 },
  benefitIcon: {
    width: 28, height: 28, borderRadius: 10, background: `${C}14`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benefitText: { fontSize: 13, color: '#3c3c43', fontWeight: 500 },
}
