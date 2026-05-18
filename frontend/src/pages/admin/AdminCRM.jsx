import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import ManagerClients from '../manager/ManagerClients'
import ManagerCouriers from '../manager/ManagerCouriers'
import { getAdminManagers, createManager, deleteManager, broadcastMessage } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
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

const TABS = [
  { key: 'clients', label: 'Клиенты' },
  { key: 'couriers', label: 'Курьеры' },
  { key: 'managers', label: 'Менеджеры' },
]

const FragmentLayout = ({ children }) => <>{children}</>

function ManagersTab() {
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', telegram_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <>
      <div style={ms.topBar}>
        <span style={ms.countChip}>{managers.length} менеджеров</span>
        <button style={ms.addBtn} onClick={() => { setShowForm(true); setError('') }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Добавить
        </button>
      </div>

      {showForm && (
        <div style={ms.formCard}>
          <div style={ms.formTitle}>Новый менеджер</div>
          <div style={ms.formGrid}>
            <div style={ms.field}>
              <div style={ms.label}>Имя *</div>
              <input style={ms.input} placeholder="Иван Иванов" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={ms.field}>
              <div style={ms.label}>Telegram ID *</div>
              <input style={ms.input} placeholder="123456789" value={form.telegram_id}
                onChange={e => setForm(f => ({ ...f, telegram_id: e.target.value }))} />
            </div>
            <div style={ms.field}>
              <div style={ms.label}>Телефон</div>
              <input style={ms.input} placeholder="+998 99 000-00-00" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          {error && <div style={ms.error}>{error}</div>}
          <div style={ms.formActions}>
            <button style={ms.cancelBtn} onClick={() => setShowForm(false)}>Отмена</button>
            <button style={{ ...ms.saveBtn, ...(saving ? { opacity: 0.6 } : {}) }} onClick={save} disabled={saving}>
              {saving ? 'Сохраняю...' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={ms.center}><div style={ms.spinner} /></div>
      ) : managers.length === 0 ? (
        <div style={ms.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="4" stroke={C} strokeWidth="1.5"/>
            <path d="M3 21C3 18 5.7 16 9 16" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="17" cy="10" r="3" stroke={C} strokeWidth="1.5"/>
            <path d="M14 21C14 19 15.3 17 17 17C18.7 17 20 19 20 21" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={ms.emptyText}>Менеджеров нет</div>
          <button style={ms.addBtn} onClick={() => setShowForm(true)}>Добавить первого</button>
        </div>
      ) : (
        <div style={ms.list}>
          {managers.map((m, i) => (
            <div key={m.id} style={ms.card}>
              <div style={{ ...ms.avatar, background: GRADIENTS[i % GRADIENTS.length] }}>
                {(m.name || 'M')[0].toUpperCase()}
              </div>
              <div style={ms.info}>
                <div style={ms.name}>{m.name}</div>
                <div style={ms.meta}>
                  {m.phone && <span style={ms.metaItem}>{m.phone}</span>}
                  <span style={ms.metaItem}>ID: {m.telegram_id}</span>
                </div>
                <span style={{
                  ...ms.badge,
                  background: m.is_active !== false ? '#EBFBEE' : '#FFF5F5',
                  color: m.is_active !== false ? '#2B8A3E' : '#E03131',
                }}>
                  {m.is_active !== false ? 'Активен' : 'Неактивен'}
                </span>
              </div>
              <button style={ms.removeBtn} onClick={() => remove(m.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function AdminCRM() {
  const [tab, setTab] = useState('clients')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState('all')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

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
    <AdminLayout title="CRM">
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Tab switcher */}
      <div style={s.tabRow}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 12,
            background: tab === t.key ? GRAD : '#fff',
            color: tab === t.key ? '#fff' : TEXT2,
            border: tab === t.key ? 'none' : '1.5px solid rgba(60,60,67,0.08)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Broadcast button */}
      <button style={s.broadcastBtn} onClick={() => setShowBroadcast(v => !v)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Рассылка
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showBroadcast ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Broadcast panel */}
      {showBroadcast && (
        <div style={s.broadcastPanel}>
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

      {/* Tab content */}
      <div style={{ marginTop: 16 }}>
        {tab === 'clients' && <ManagerClients Layout={FragmentLayout} title="Клиенты" />}
        {tab === 'couriers' && <ManagerCouriers Layout={FragmentLayout} title="Курьеры" />}
        {tab === 'managers' && <ManagersTab />}
      </div>
    </AdminLayout>
  )
}

const s = {
  tabRow: { display: 'flex', gap: 6, marginBottom: 10 },
  broadcastBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', borderRadius: 14,
    background: '#fff', border: '1.5px solid rgba(60,60,67,0.08)',
    fontSize: 14, fontWeight: 600, color: TEXT,
    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    WebkitTapHighlightColor: 'transparent',
  },
  broadcastPanel: {
    background: '#fff', borderRadius: 14, padding: 16, marginTop: 8,
    border: '1.5px solid rgba(60,60,67,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
  segmented: { display: 'flex', background: '#F2F2F7', borderRadius: 10, padding: 3, gap: 2 },
  segBtn: {
    flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
    background: 'none', color: TEXT2, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  segBtnActive: { background: '#fff', color: TEXT, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  textarea: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', resize: 'vertical', background: '#FAFAFA',
    color: TEXT, fontFamily: 'inherit',
  },
  successMsg: {
    display: 'flex', alignItems: 'center', gap: 6,
    color: '#2B8A3E', fontSize: 13, fontWeight: 600,
    background: '#EBFBEE', padding: '10px 14px', borderRadius: 10,
  },
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
}

const ms = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  countChip: { fontSize: 13, background: '#F2F2F7', color: TEXT2, padding: '5px 12px', borderRadius: 999, fontWeight: 600 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px',
    background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)', WebkitTapHighlightColor: 'transparent',
  },
  formCard: {
    background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
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
    background: '#fff', borderRadius: 16, padding: '14px 16px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', alignItems: 'center', gap: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: '50%',
    color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  name: { fontWeight: 700, fontSize: 15, color: TEXT },
  meta: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: TEXT2 },
  badge: { fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 600, alignSelf: 'flex-start' },
  removeBtn: {
    width: 34, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid rgba(224,49,49,0.3)', borderRadius: 10,
    background: '#FFF5F5', color: '#E03131', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
}
