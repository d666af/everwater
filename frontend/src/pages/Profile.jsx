import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram } from '../api'
import { useAuthStore } from '../store/auth'

const tg = window.Telegram?.WebApp

export default function Profile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogout, setShowLogout] = useState(false)
  const { logout, user: authUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(setUser)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (authUser) {
      setUser(authUser)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [authUser])

  const openSupport = () => {
    tg?.openTelegramLink('https://t.me/your_support_bot')
  }

  const doLogout = () => {
    logout()
    navigate('/login')
  }

  if (loading) return <div style={styles.center}>Загрузка...</div>
  if (!user) return (
    <div style={styles.center}>
      <div style={{ fontSize: 48 }}>👤</div>
      <div>Откройте приложение через Telegram</div>
      <button style={styles.logoutBtn} onClick={doLogout}>← Выйти</button>
    </div>
  )

  return (
    <div style={styles.page}>
      {/* Avatar block */}
      <div style={styles.avatarBlock}>
        <div style={styles.avatar}>
          {(user.name || 'U')[0].toUpperCase()}
        </div>
        <div style={styles.userName}>{user.name}</div>
        <div style={styles.userPhone}>{user.phone}</div>
      </div>

      {/* Balance & Bonuses */}
      <div style={styles.balanceRow}>
        <div style={styles.balanceCard}>
          <div style={styles.balanceLabel}>Баланс</div>
          <div style={styles.balanceValue}>{user.balance || 0} сум</div>
        </div>
        <div style={styles.balanceCard}>
          <div style={styles.balanceLabel}>Бонусы</div>
          <div style={{ ...styles.balanceValue, color: '#f57c00' }}>{user.bonus_points || 0} сум</div>
        </div>
      </div>

      {/* Info */}
      <div style={styles.section}>
        <div style={styles.row}>
          <span style={styles.rowIcon}>📱</span>
          <div>
            <div style={styles.rowLabel}>Телефон</div>
            <div style={styles.rowValue}>{user.phone || 'Не указан'}</div>
          </div>
        </div>
        <div style={styles.divider} />
        <div style={styles.row}>
          <span style={styles.rowIcon}>👤</span>
          <div>
            <div style={styles.rowLabel}>Имя</div>
            <div style={styles.rowValue}>{user.name || 'Не указано'}</div>
          </div>
        </div>
        <div style={styles.divider} />
        <div style={styles.row}>
          <span style={styles.rowIcon}>🆔</span>
          <div>
            <div style={styles.rowLabel}>Telegram ID</div>
            <div style={styles.rowValue}>{user.telegram_id}</div>
          </div>
        </div>
      </div>

      {/* Bonus info */}
      <div style={styles.bonusInfo}>
        <span style={{ fontSize: 18 }}>🎁</span>
        <div>
          <div style={styles.bonusTitle}>Бонусная программа</div>
          <div style={styles.bonusText}>Получайте 5% бонусами с каждой доставки и тратьте их на следующие заказы</div>
        </div>
      </div>

      {/* Support */}
      <button style={styles.supportBtn} onClick={openSupport}>
        💬 Связаться с поддержкой
      </button>

      {/* Logout */}
      {!tg?.initDataUnsafe?.user && (
        showLogout ? (
          <div style={styles.logoutConfirm}>
            <div style={styles.logoutQuestion}>Выйти из аккаунта?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={styles.logoutCancelBtn} onClick={() => setShowLogout(false)}>Отмена</button>
              <button style={styles.logoutConfirmBtn} onClick={doLogout}>Выйти</button>
            </div>
          </div>
        ) : (
          <button style={styles.logoutBtn} onClick={() => setShowLogout(true)}>
            🚪 Выйти из аккаунта
          </button>
        )
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}

const styles = {
  page: { padding: '0 0 100px', display: 'flex', flexDirection: 'column', gap: 16 },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, height: '60vh',
    color: '#888', fontSize: 16,
  },
  avatarBlock: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 16px 16px', gap: 6,
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
  },
  avatar: {
    width: 80, height: 80, borderRadius: '50%',
    background: 'var(--tg-theme-button-color, #2481cc)',
    color: '#fff', fontSize: 36, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  userName: { fontSize: 22, fontWeight: 700 },
  userPhone: { fontSize: 15, color: '#888' },
  balanceRow: {
    display: 'flex', gap: 12, padding: '0 16px',
  },
  balanceCard: {
    flex: 1, background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 14, padding: '16px 12px', textAlign: 'center',
  },
  balanceLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  balanceValue: {
    fontSize: 24, fontWeight: 800,
    color: 'var(--tg-theme-button-color, #2481cc)',
  },
  section: {
    margin: '0 16px',
    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
    borderRadius: 14, overflow: 'hidden',
  },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' },
  rowIcon: { fontSize: 22, flexShrink: 0 },
  rowLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: 500 },
  divider: { height: 1, background: 'var(--tg-theme-hint-color, #e0e0e0)', margin: '0 16px' },
  bonusInfo: {
    margin: '0 16px',
    background: '#fff8e1',
    borderRadius: 14, padding: 16,
    display: 'flex', alignItems: 'flex-start', gap: 12,
  },
  bonusTitle: { fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#e65100' },
  bonusText: { fontSize: 13, color: '#bf360c', lineHeight: 1.5 },
  supportBtn: {
    margin: '0 16px',
    background: 'none',
    border: '2px solid var(--tg-theme-button-color, #2d6a4f)',
    borderRadius: 14, padding: '14px 0',
    color: 'var(--tg-theme-button-color, #2d6a4f)',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  logoutBtn: {
    margin: '0 16px',
    background: 'none',
    border: '2px solid #e53935',
    borderRadius: 14, padding: '14px 0',
    color: '#e53935', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  logoutConfirm: {
    margin: '0 16px', background: '#fff5f5',
    border: '1px solid #ffcdd2', borderRadius: 14,
    padding: '16px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12,
  },
  logoutQuestion: { fontWeight: 600, fontSize: 16, color: '#c62828' },
  logoutCancelBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10,
    border: '1px solid #ddd', background: '#fff',
    color: '#333', fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
  logoutConfirmBtn: {
    flex: 1, padding: '10px 0', borderRadius: 10,
    border: 'none', background: '#e53935',
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
}
