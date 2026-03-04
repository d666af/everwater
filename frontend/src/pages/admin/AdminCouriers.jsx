import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAdminCouriers, createCourier, deleteCourier } from '../../api'

export default function AdminCouriers() {
  const [couriers, setCouriers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', telegram_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getAdminCouriers()
      .then(setCouriers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    if (!form.name.trim() || !form.telegram_id.trim()) { setError('Имя и Telegram ID обязательны'); return }
    setSaving(true); setError('')
    try {
      await createCourier(form)
      setShowForm(false); setForm({ name: '', phone: '', telegram_id: '' }); load()
    } catch { setError('Ошибка при добавлении курьера') } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!window.confirm('Деактивировать курьера?')) return
    try { await deleteCourier(id); load() } catch { alert('Ошибка') }
  }

  return (
    <AdminLayout title="Курьеры">
      <div style={styles.topBar}>
        <div style={styles.count}>{couriers.length} курьеров</div>
        <button style={styles.addBtn} onClick={() => { setShowForm(true); setError('') }}>+ Добавить курьера</button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>Новый курьер</h3>
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Имя *</label>
              <input style={styles.input} placeholder="Иван Иванов" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Telegram ID *</label>
              <input style={styles.input} placeholder="123456789" value={form.telegram_id}
                onChange={e => setForm(f => ({ ...f, telegram_id: e.target.value }))} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Телефон</label>
              <input style={styles.input} placeholder="+7 999 000-00-00" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.formActions}>
            <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>Отмена</button>
            <button style={styles.saveBtn} onClick={save} disabled={saving}>
              {saving ? 'Сохраняем...' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.center}>Загрузка...</div>
      ) : couriers.length === 0 ? (
        <div style={styles.center}>Курьеров нет</div>
      ) : (
        <div style={styles.list}>
          {couriers.map(c => (
            <div key={c.id} style={styles.card}>
              <div style={styles.avatar}>{(c.name || 'K')[0].toUpperCase()}</div>
              <div style={styles.info}>
                <div style={styles.name}>{c.name}</div>
                <div style={styles.meta}>
                  {c.phone && <span>📱 {c.phone}</span>}
                  <span>🆔 {c.telegram_id}</span>
                </div>
                <div style={styles.stats}>
                  <div style={styles.statChip}>
                    <span style={styles.statVal}>{c.delivery_count || 0}</span>
                    <span style={styles.statLbl}>доставок</span>
                  </div>
                  <div style={styles.statChip}>
                    <span style={styles.statVal}>{c.earnings ? `${c.earnings} сум` : '—'}</span>
                    <span style={styles.statLbl}>заработано</span>
                  </div>
                  <span style={{ ...styles.activeBadge, background: c.is_active ? '#e8f5e9' : '#fbe9e7', color: c.is_active ? '#2e7d32' : '#c62828' }}>
                    {c.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              </div>
              <button style={styles.removeBtn} onClick={() => remove(c.id)}>Деактивировать</button>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  count: { fontSize: 14, color: '#888' },
  addBtn: {
    padding: '10px 20px', background: '#1a237e', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  formCard: {
    background: '#fff', borderRadius: 14, padding: 24, marginBottom: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 14,
  },
  formTitle: { margin: 0, fontSize: 18, fontWeight: 700, color: '#1a237e' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  input: {
    border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px',
    fontSize: 14, outline: 'none', background: '#fafafa',
  },
  error: { color: '#c62828', fontSize: 13 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '9px 20px', border: '1px solid #ddd', borderRadius: 8,
    background: '#fff', color: '#333', fontSize: 14, cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 24px', background: '#1a237e', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  center: { textAlign: 'center', padding: 60, color: '#888', fontSize: 16 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#fff', borderRadius: 14, padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'flex-start', gap: 16,
  },
  avatar: {
    width: 48, height: 48, borderRadius: '50%', background: '#3949ab',
    color: '#fff', fontWeight: 700, fontSize: 20, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  name: { fontWeight: 700, fontSize: 16 },
  meta: { display: 'flex', gap: 12, fontSize: 13, color: '#666', flexWrap: 'wrap' },
  stats: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statChip: {
    background: '#e8eaf6', borderRadius: 8, padding: '4px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  statVal: { fontWeight: 800, fontSize: 15, color: '#1a237e' },
  statLbl: { fontSize: 10, color: '#7986cb' },
  activeBadge: { fontSize: 12, padding: '3px 10px', borderRadius: 10, fontWeight: 600 },
  removeBtn: {
    padding: '7px 14px', border: '1px solid #e57373', borderRadius: 8,
    background: '#fff', color: '#e53935', fontSize: 13, cursor: 'pointer',
    alignSelf: 'flex-start', flexShrink: 0,
  },
}
