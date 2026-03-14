import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAdminManagers, createManager, deleteManager, broadcastMessage } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

const GRADIENTS = [
  'linear-gradient(135deg,#3B5BDB,#2C4BC7)',
  'linear-gradient(135deg,#8DC63F,#6CA32F)',
  'linear-gradient(135deg,#6741D9,#5730C0)',
  'linear-gradient(135deg,#E67700,#CC6900)',
  'linear-gradient(135deg,#1971C2,#1560A8)',
  'linear-gradient(135deg,#12B886,#0FA07A)',
]

const BROADCAST_TARGETS = [
  { key: 'all', label: 'Всем' },
  { key: 'managers', label: 'Менеджерам' },
  { key: 'couriers', label: 'Курьерам' },
]

export default function AdminManagers() {
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', telegram_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState('all')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const load = () => {
    setLoading(true)
    getAdminManagers().then(setManagers).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    if (!form.name.trim() || !form.telegram_id.trim()) { setError('Имя и Telegram ID обязательны'); return }
    setSaving(true); setError('')
    try {
      await createManager(form)
      setShowForm(false); setForm({ name: '', phone: '', telegram_id: '' }); load()
    } catch { setError('Ошибка при добавлении') } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!window.confirm('Удалить менеджера?')) return
    try { await deleteManager(id); load() } catch { alert('Ошибка') }
  }

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) return
    setSending(true)
    try {
      await broadcastMessage(broadcastText, broadcastTarget)
      setSent(true); setBroadcastText('')
      setTimeout(() => { setSent(false); setShowBroadcast(false) }, 2000)
    } catch { alert('Ошибка при отправке') } finally { setSending(false) }
  }

  return (
    <AdminLayout title="Менеджеры">
      {/* Top bar */}
      <div style={s.topBar}>
        <div style={s.counts}>
          <span style={s.countChip}>{managers.length} менеджеров</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.broadcastBtn} onClick={() => setShowBroadcast(v => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Рассылка
          </button>
          <button style={s.addBtn} onClick={() => { setShowForm(true); setError('') }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            Добавить
          </button>
        </div>
      </div>

      {/* Broadcast form */}
      {showBroadcast && (
        <div style={s.formCard}>
          <div style={s.formTitle}>Рассылка уведомлений</div>
          <div style={s.field}>
            <div style={s.label}>Получатели</div>
            <div style={s.segmented}>
              {BROADCAST_TARGETS.map(t => (
                <button key={t.key}
                  style={{ ...s.segBtn, ...(broadcastTarget === t.key ? s.segBtnActive : {}) }}
                  onClick={() => setBroadcastTarget(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={s.field}>
            <div style={s.label}>Сообщение</div>
            <textarea style={s.textarea} rows={3} placeholder="Введите сообщение для рассылки..."
              value={broadcastText} onChange={e => setBroadcastText(e.target.value)} />
          </div>
          {sent && (
            <div style={s.successMsg}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#2B8A3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Отправлено!
            </div>
          )}
          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={() => setShowBroadcast(false)}>Отмена</button>
            <button style={{ ...s.saveBtn, ...(sending ? { opacity: 0.6 } : {}) }}
              onClick={sendBroadcast} disabled={sending || !broadcastText.trim()}>
              {sending ? 'Отправляю...' : 'Отправить'}
            </button>
          </div>
        </div>
      )}

      {/* Add manager form */}
      {showForm && (
        <div style={s.formCard}>
          <div style={s.formTitle}>Новый менеджер</div>
          <div style={s.formGrid}>
            <div style={s.field}>
              <div style={s.label}>Имя *</div>
              <input style={s.input} placeholder="Иван Иванов" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={s.field}>
              <div style={s.label}>Telegram ID *</div>
              <input style={s.input} placeholder="123456789" value={form.telegram_id}
                onChange={e => setForm(f => ({ ...f, telegram_id: e.target.value }))} />
            </div>
            <div style={s.field}>
              <div style={s.label}>Телефон</div>
              <input style={s.input} placeholder="+998 99 000-00-00" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          {error && <div style={s.error}>{error}</div>}
          <div style={s.formActions}>
            <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Отмена</button>
            <button style={{ ...s.saveBtn, ...(saving ? { opacity: 0.6 } : {}) }} onClick={save} disabled={saving}>
              {saving ? 'Сохраняю...' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={s.center}><div style={s.spinner} /></div>
      ) : managers.length === 0 ? (
        <div style={s.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="4" stroke={C} strokeWidth="1.5"/>
            <path d="M3 21C3 18 5.7 16 9 16" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="17" cy="10" r="3" stroke={C} strokeWidth="1.5"/>
            <path d="M14 21C14 19 15.3 17 17 17C18.7 17 20 19 20 21" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={s.emptyText}>Менеджеров нет</div>
          <button style={s.addBtn} onClick={() => setShowForm(true)}>Добавить первого менеджера</button>
        </div>
      ) : (
        <div style={s.list}>
          {managers.map((m, i) => (
            <div key={m.id} style={s.card}>
              <div style={{ ...s.avatar, background: GRADIENTS[i % GRADIENTS.length] }}>
                {(m.name || 'M')[0].toUpperCase()}
              </div>
              <div style={s.info}>
                <div style={s.name}>{m.name}</div>
                <div style={s.meta}>
                  {m.phone && (
                    <span style={s.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4l1.9-1.9c.2-.2.5-.3.8-.1 1 .4 2.1.6 3.1.6.4 0 .8.3.8.8V19c0 .4-.4.8-.8.8C9.1 19.8 4.2 14.9 4.2 8.8c0-.5.4-.8.8-.8H8c.5 0 .8.4.8.8 0 1.1.2 2.1.6 3.1.1.3 0 .6-.1.8l-1.9 1.9-.6-3.8z" fill={TEXT2}/>
                      </svg>
                      {m.phone}
                    </span>
                  )}
                  <span style={s.metaItem}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M21.6 12.3C21.6 17.4 17.4 21.6 12 21.6C9.8 21.6 7.7 20.9 6 19.7L2.4 20.4 3.1 17C1.9 15.2 1.2 13.1 1.2 10.9 1.2 5.8 5.4 1.6 10.8 1.6" stroke={TEXT2} strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="19" cy="5" r="3" fill={C}/>
                    </svg>
                    {m.telegram_id}
                  </span>
                </div>
                <div style={s.chips}>
                  <span style={{
                    ...s.badge,
                    background: m.is_active !== false ? '#EBFBEE' : '#FFF5F5',
                    color: m.is_active !== false ? '#2B8A3E' : '#E03131',
                  }}>
                    {m.is_active !== false ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              </div>
              <button style={s.removeBtn} onClick={() => remove(m.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const s = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  counts: { display: 'flex', gap: 8 },
  countChip: { fontSize: 13, background: '#F2F2F7', color: TEXT2, padding: '5px 12px', borderRadius: 999, fontWeight: 600 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)', WebkitTapHighlightColor: 'transparent',
  },
  broadcastBtn: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px',
    background: '#F2F2F7', color: TEXT, border: `1.5px solid ${BORDER}`,
    borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },

  formCard: {
    background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20,
    border: `1px solid ${BORDER}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  formTitle: { fontWeight: 800, fontSize: 18, color: TEXT },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', background: '#FAFAFA', color: TEXT,
  },
  textarea: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', resize: 'vertical', background: '#FAFAFA',
    color: TEXT, fontFamily: 'inherit',
  },
  segmented: { display: 'flex', background: '#F2F2F7', borderRadius: 10, padding: 3, gap: 2 },
  segBtn: {
    flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
    background: 'none', color: TEXT2, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  segBtnActive: { background: '#fff', color: TEXT, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  successMsg: {
    display: 'flex', alignItems: 'center', gap: 6,
    color: '#2B8A3E', fontSize: 13, fontWeight: 600,
    background: '#EBFBEE', padding: '10px 14px', borderRadius: 10,
  },
  error: { color: '#E03131', fontSize: 13, fontWeight: 500 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: {
    padding: '12px 20px', border: `1.5px solid ${BORDER}`, borderRadius: 12,
    background: '#fff', color: TEXT2, fontSize: 14, cursor: 'pointer', fontWeight: 600,
  },
  saveBtn: {
    padding: '12px 24px', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)',
  },

  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px' },
  emptyText: { fontSize: 16, fontWeight: 700, color: TEXT2 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#fff', borderRadius: 16, padding: '16px 18px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', alignItems: 'flex-start', gap: 14,
  },
  avatar: {
    width: 48, height: 48, borderRadius: '50%',
    color: '#fff', fontWeight: 800, fontSize: 20, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  name: { fontWeight: 700, fontSize: 16, color: TEXT },
  meta: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  metaItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: TEXT2 },
  chips: { display: 'flex', alignItems: 'center', gap: 8 },
  badge: { fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 600 },
  removeBtn: {
    width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid rgba(224,49,49,0.3)', borderRadius: 10,
    background: '#FFF5F5', color: '#E03131', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
}
