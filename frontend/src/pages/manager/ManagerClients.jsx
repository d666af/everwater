import { useEffect, useState } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getAdminUsers } from '../../api'

export default function ManagerClients() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAdminUsers().then(setUsers).catch(console.error).finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  )

  return (
    <ManagerLayout title="Клиенты">
      <div style={s.page}>
        <div style={s.topBar}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>🔍</span>
            <input style={s.searchInput} placeholder="Поиск по имени или телефону..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={s.count}>{filtered.length} клиентов</div>
        </div>

        {loading ? <div style={s.center}>Загрузка...</div> : filtered.length === 0 ? (
          <div style={s.center}>Клиентов не найдено</div>
        ) : (
          <div style={s.list}>
            {filtered.map(u => (
              <div key={u.id} style={s.card}>
                <div style={s.avatar}>{(u.name || '?')[0].toUpperCase()}</div>
                <div style={s.info}>
                  <div style={s.name}>{u.name || 'Без имени'}</div>
                  <div style={s.meta}>
                    {u.phone && <span>📱 {u.phone}</span>}
                    <span style={{ color: '#888' }}>ID: {u.telegram_id}</span>
                  </div>
                  <div style={s.chips}>
                    {u.bonus_points > 0 && (
                      <span style={s.bonusChip}>🎁 {u.bonus_points} бонусов</span>
                    )}
                    {u.balance > 0 && (
                      <span style={s.balanceChip}>💰 {u.balance} ₽</span>
                    )}
                    {u.is_registered ? (
                      <span style={s.regChip}>✅ Зарегистрирован</span>
                    ) : (
                      <span style={s.unregChip}>⏳ Не завершил регистрацию</span>
                    )}
                  </div>
                </div>
                {u.phone && (
                  <a href={`tel:${u.phone}`} style={s.callBtn}>📞</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  )
}

const GREEN = '#2d6a4f'
const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16 },
  topBar: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  searchWrap: {
    flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1px solid #b7e4c7', borderRadius: 12, padding: '8px 14px',
  },
  searchIcon: { fontSize: 16, color: '#888' },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' },
  count: { fontSize: 13, color: '#888', whiteSpace: 'nowrap' },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background: '#fff', borderRadius: 12, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)', border: '1px solid #e8f5e9',
  },
  avatar: {
    width: 44, height: 44, borderRadius: '50%', background: '#d8f3dc',
    color: GREEN, fontWeight: 700, fontSize: 18, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  name: { fontWeight: 600, fontSize: 15, color: '#1b4332' },
  meta: { display: 'flex', gap: 12, fontSize: 12, color: '#666', flexWrap: 'wrap' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  bonusChip: { fontSize: 11, background: '#fff8e1', color: '#f57f17', padding: '2px 8px', borderRadius: 8, fontWeight: 500 },
  balanceChip: { fontSize: 11, background: '#e8f5e9', color: GREEN, padding: '2px 8px', borderRadius: 8, fontWeight: 500 },
  regChip: { fontSize: 11, background: '#e8f5e9', color: GREEN, padding: '2px 8px', borderRadius: 8 },
  unregChip: { fontSize: 11, background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 8 },
  callBtn: {
    width: 38, height: 38, borderRadius: '50%', border: `1px solid ${GREEN}`,
    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, textDecoration: 'none', flexShrink: 0,
  },
}
