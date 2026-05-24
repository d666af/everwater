import { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import ManagerClients from '../manager/ManagerClients'
import ManagerCouriers from '../manager/ManagerCouriers'
import { getAdminManagers, createManager, deleteManager, broadcastMessage, getAgents, createAgent, deleteAgent, linkAgentTelegram, getWarehouseStaff, addWarehouseStaff, removeWarehouseStaff, getAgentOrders, getAdmins, addAdminUser, removeAdminUser, checkIsMainAdmin } from '../../api'
import { formatPhone } from '../../utils/phone'
import AgentReportModal from '../../components/AgentReportModal'

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

const TABS = [
  { key: 'clients', label: 'Клиенты' },
  { key: 'couriers', label: 'Курьеры' },
  { key: 'managers', label: 'Менеджеры' },
  { key: 'agents', label: 'Агенты' },
  { key: 'warehouse', label: 'Завсклада' },
  { key: 'admins', label: 'Администраторы', mainOnly: true },
]

const AUDIENCES = [
  {
    key: 'clients', label: 'Клиентам',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    key: 'couriers', label: 'Курьерам',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="1" y="3" width="15" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><path d="M16 8h3l3 3v5h-6V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    key: 'managers', label: 'Менеджерам',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M2 20c0-3 3.1-5.5 7-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="17" cy="13" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M14 20c0-2.2 1.3-4 3-4s3 1.8 3 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    key: 'agents', label: 'Агентам',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M2 20c0-3 3.1-5.5 7-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M17 10l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    key: 'warehouse', label: 'Завскладам',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.8"/><path d="M12 12v4M10 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    key: 'all', label: 'Всем сотр.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="17" cy="7" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M2 20c0-2.8 3.1-5 7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M22 20c0-2.8-3.1-5-7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 20c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
]

const AUDIENCE_TAGS = {
  clients: [
    { key: 'clients',               label: 'Все' },
    { key: 'clients:registered',    label: 'Зарегистрированные' },
    { key: 'clients:not_registered',label: 'Не зарегистрированные' },
    { key: 'clients:permanent',     label: 'Постоянные' },
    { key: 'clients:inactive',      label: 'Неактивные' },
    { key: 'clients:bonus',         label: 'С бонусами' },
    { key: 'clients:bottle_debt',   label: 'Должники' },
    { key: 'clients:new',           label: 'Новые' },
  ],
  couriers: [
    { key: 'couriers', label: 'Все курьеры' },
  ],
  managers: [
    { key: 'managers', label: 'Все менеджеры' },
  ],
  agents: [
    { key: 'agents', label: 'Все агенты' },
  ],
  warehouse: [
    { key: 'warehouse', label: 'Все завсклада' },
  ],
  all: [
    { key: 'all', label: 'Весь персонал' },
  ],
}

const TAG_INFO = []

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
                  {m.phone && <span style={ms.metaItem}>{formatPhone(m.phone)}</span>}
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

function WarehouseTab() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', telegram_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getWarehouseStaff().then(setStaff).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    if (!form.name.trim() || !form.telegram_id.trim()) { setError('Имя и Telegram ID обязательны'); return }
    setSaving(true); setError('')
    try {
      await addWarehouseStaff({ name: form.name.trim(), telegram_id: Number(form.telegram_id.trim()) })
      setShowForm(false); setForm({ name: '', telegram_id: '' }); load()
    } catch { setError('Ошибка при добавлении') } finally { setSaving(false) }
  }

  const remove = async (telegramId, name) => {
    if (!window.confirm(`Удалить завсклада ${name}?`)) return
    try { await removeWarehouseStaff(telegramId); load() } catch { alert('Ошибка') }
  }

  return (
    <>
      <div style={ms.topBar}>
        <span style={ms.countChip}>{staff.length} сотр.</span>
        <button style={ms.addBtn} onClick={() => { setShowForm(true); setError('') }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Добавить
        </button>
      </div>

      {showForm && (
        <div style={ms.formCard}>
          <div style={ms.formTitle}>Новый завсклада</div>
          <div style={ms.formGrid}>
            <div style={ms.field}>
              <div style={ms.label}>Имя *</div>
              <input style={ms.input} placeholder="Иван Иванов" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={ms.field}>
              <div style={ms.label}>Telegram ID *</div>
              <input style={ms.input} placeholder="123456789" value={form.telegram_id}
                onChange={e => setForm(f => ({ ...f, telegram_id: e.target.value }))} inputMode="numeric" />
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
      ) : staff.length === 0 ? (
        <div style={ms.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="7" width="20" height="14" rx="2" stroke={C} strokeWidth="1.5"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke={C} strokeWidth="1.5"/>
            <path d="M12 12v4M10 14h4" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={ms.emptyText}>Завсклада нет</div>
          <button style={ms.addBtn} onClick={() => setShowForm(true)}>Добавить первого</button>
        </div>
      ) : (
        <div style={ms.list}>
          {staff.map((s, i) => (
            <div key={s.telegram_id} style={ms.card}>
              <div style={{ ...ms.avatar, background: GRADIENTS[i % GRADIENTS.length] }}>
                {(s.name || 'W')[0].toUpperCase()}
              </div>
              <div style={ms.info}>
                <div style={ms.name}>{s.name}</div>
                <div style={ms.meta}>
                  <span style={ms.metaItem}>ID: {s.telegram_id}</span>
                </div>
                <span style={{ ...ms.badge, background: '#EBFBEE', color: '#2B8A3E' }}>Активен</span>
              </div>
              <button style={ms.removeBtn} onClick={() => remove(s.telegram_id, s.name)}>
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

function AgentCard({ agent: a, onDelete, onRefresh }) {
  const [showReport, setShowReport] = useState(false)
  const [orderCount, setOrderCount] = useState(null)
  const [tgInput, setTgInput] = useState('')
  const [tgSaving, setTgSaving] = useState(false)
  const [tgError, setTgError] = useState('')

  useEffect(() => {
    getAgentOrders(a.id).then(r => setOrderCount((r || []).length)).catch(() => {})
  }, [a.id])

  const handleLinkTelegram = async () => {
    const id = parseInt(tgInput.trim(), 10)
    if (!id || isNaN(id)) { setTgError('Введите корректный Telegram ID'); return }
    setTgSaving(true); setTgError('')
    try {
      await linkAgentTelegram(a.id, id)
      onRefresh()
    } catch (err) {
      setTgError(err?.response?.data?.detail || 'Ошибка при привязке')
    } finally { setTgSaving(false) }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1px solid ${BORDER}`, opacity: a.is_active ? 1 : 0.6 }}>
      {showReport && <AgentReportModal agentId={a.id} agentName={a.name} onClose={() => setShowReport(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: a.is_active ? `linear-gradient(135deg, ${C}, ${CD})` : '#E0E0E5', color: '#fff', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(a.name || 'А')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>{a.name}</div>
          {a.phone && <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>{formatPhone(a.phone)}</div>}
          <div style={{ marginTop: 4 }}>
            {a.telegram_id ? (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#EBFBEE', color: '#2B8A3E', fontWeight: 600 }}>Telegram привязан</span>
            ) : (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#FFF3BF', color: '#E67700', fontWeight: 600 }}>Telegram не привязан</span>
            )}
          </div>
          {!a.telegram_id && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Telegram ID"
                  value={tgInput}
                  onChange={e => { setTgInput(e.target.value); setTgError('') }}
                  style={{ flex: 1, fontSize: 13, padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${tgError ? '#FA5252' : BORDER}`, outline: 'none', fontFamily: 'inherit' }}
                  onKeyDown={e => e.key === 'Enter' && handleLinkTelegram()}
                />
                <button
                  onClick={handleLinkTelegram}
                  disabled={tgSaving || !tgInput.trim()}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: C, color: '#fff', fontSize: 12, fontWeight: 700, cursor: tgSaving || !tgInput.trim() ? 'default' : 'pointer', opacity: tgSaving || !tgInput.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {tgSaving ? '...' : 'Привязать'}
                </button>
              </div>
              {tgError && <div style={{ fontSize: 11, color: '#FA5252' }}>{tgError}</div>}
            </div>
          )}
        </div>
        <button
          style={{ height: 34, padding: '0 12px', borderRadius: 10, flexShrink: 0, border: `1.5px solid ${C}`, background: '#F0FFF4', color: CD, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
          onClick={() => setShowReport(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M18 20V10M12 20V4M6 20v-6" stroke={CD} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Отчёт
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: '#F0FFF4', border: '1px solid rgba(141,198,63,0.18)', flex: 1 }}>
          <span style={{ fontSize: 16 }}>📦</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: CD, lineHeight: 1 }}>{orderCount ?? '—'}</div>
            <div style={{ fontSize: 10, color: TEXT2, fontWeight: 600 }}>Заказов</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button style={ms.removeBtn} onClick={() => onDelete(a)} title="Удалить агента">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function AgentsTab() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getAgents().then(setAgents).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError('Имя и телефон обязательны'); return }
    setSaving(true); setError('')
    try {
      await createAgent({ name: form.name.trim(), phone: form.phone.trim() })
      setShowForm(false); setForm({ name: '', phone: '' }); load()
    } catch { setError('Ошибка при добавлении') } finally { setSaving(false) }
  }

  const handleDelete = async (agent) => {
    if (!window.confirm(`Удалить агента ${agent.name}? Это действие нельзя отменить.`)) return
    try { await deleteAgent(agent.id); load() } catch { alert('Ошибка при удалении') }
  }

  const activeAgents = agents.filter(a => a.is_active)
  const inactiveAgents = agents.filter(a => !a.is_active)

  return (
    <>
      <div style={ms.topBar}>
        <span style={ms.countChip}>{agents.length} агентов</span>
        <button style={ms.addBtn} onClick={() => { setShowForm(true); setError('') }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Добавить
        </button>
      </div>

      {showForm && (
        <div style={ms.formCard}>
          <div style={ms.formTitle}>Новый агент</div>
          <div style={ms.formGrid}>
            <div style={ms.field}>
              <div style={ms.label}>Имя *</div>
              <input style={ms.input} placeholder="Имя агента" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={ms.field}>
              <div style={ms.label}>Телефон *</div>
              <input style={ms.input} placeholder="+998 99 000-00-00" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} inputMode="tel" />
            </div>
          </div>
          {error && <div style={ms.error}>{error}</div>}
          <div style={{ fontSize: 12, color: TEXT2, background: '#F8F9FA', borderRadius: 8, padding: '8px 12px' }}>
            После добавления агент сможет привязать свой Telegram, запустив бота и поделившись номером телефона.
          </div>
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
      ) : agents.length === 0 ? (
        <div style={ms.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="4" stroke={C} strokeWidth="1.5"/>
            <path d="M3 21C3 18 5.7 16 9 16" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="17" cy="10" r="3" stroke={C} strokeWidth="1.5"/>
            <path d="M14 21C14 19 15.3 17 17 17C18.7 17 20 19 20 21" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={ms.emptyText}>Агентов нет</div>
          <button style={ms.addBtn} onClick={() => setShowForm(true)}>Добавить первого</button>
        </div>
      ) : (
        <>
          {activeAgents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {activeAgents.map(a => <AgentCard key={a.id} agent={a} onDelete={handleDelete} onRefresh={load} />)}
            </div>
          )}
          {inactiveAgents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Деактивированные · {inactiveAgents.length}</div>
              {inactiveAgents.map(a => <AgentCard key={a.id} agent={a} onDelete={handleDelete} onRefresh={load} />)}
            </div>
          )}
        </>
      )}
    </>
  )
}

function AdminsTab() {
  const [data, setData] = useState({ main: [], secondary: [], main_ids: [] })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ telegram_id: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getAdmins().then(setData).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const save = async () => {
    if (!form.telegram_id.trim() || !form.name.trim()) { setError('ID и имя обязательны'); return }
    setSaving(true); setError('')
    try {
      await addAdminUser({ telegram_id: Number(form.telegram_id), name: form.name.trim() })
      setShowForm(false); setForm({ telegram_id: '', name: '' }); load()
    } catch (e) { setError(e?.response?.data?.detail || 'Ошибка') } finally { setSaving(false) }
  }

  const remove = async (admin) => {
    if (!window.confirm(`Удалить администратора ${admin.name}?`)) return
    try { await removeAdminUser(admin.id); load() } catch { alert('Ошибка') }
  }

  const allAdmins = [...data.main, ...data.secondary]

  return (
    <>
      <div style={ms.topBar}>
        <span style={ms.countChip}>{allAdmins.length} администраторов</span>
        <button style={ms.addBtn} onClick={() => { setShowForm(true); setError('') }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Добавить
        </button>
      </div>
      {showForm && (
        <div style={ms.formCard}>
          <div style={ms.formTitle}>Новый администратор</div>
          <div style={ms.formGrid}>
            <div style={ms.field}>
              <div style={ms.label}>Telegram ID *</div>
              <input style={ms.input} placeholder="123456789" value={form.telegram_id}
                onChange={e => setForm(f => ({ ...f, telegram_id: e.target.value }))} inputMode="numeric" />
            </div>
            <div style={ms.field}>
              <div style={ms.label}>Имя *</div>
              <input style={ms.input} placeholder="Имя" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
      {loading ? <div style={ms.center}><div style={ms.spinner} /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allAdmins.map((a, idx) => (
            <div key={a.telegram_id || idx} style={{ ...ms.card, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: a.is_main ? 'linear-gradient(135deg,#3B5BDB,#2C4BC7)' : GRAD, color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(a.name || 'A')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{a.name}</div>
                <div style={{ fontSize: 12, color: TEXT2 }}>ID: {a.telegram_id}</div>
                {a.is_main && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#EDF2FF', color: '#3B5BDB', fontWeight: 600 }}>Главный</span>}
              </div>
              {!a.is_main && (
                <button style={ms.removeBtn} onClick={() => remove(a)} title="Удалить">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function AdminCRM() {
  const [tab, setTab] = useState('clients')
  const [isMainAdmin, setIsMainAdmin] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)

  useEffect(() => {
    checkIsMainAdmin().then(r => setIsMainAdmin(r?.is_main || false)).catch(() => {})
  }, [])
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastAudience, setBroadcastAudience] = useState(null)
  const [broadcastTarget, setBroadcastTarget] = useState('clients')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const sendBroadcast = async () => {
    if (!broadcastText.trim() || !broadcastAudience) return
    setSending(true)
    try {
      await broadcastMessage(broadcastText, broadcastTarget)
      setSent(true); setBroadcastText('')
      setTimeout(() => { setSent(false); setShowBroadcast(false); setBroadcastAudience(null) }, 2000)
    } catch { alert('Ошибка при отправке') } finally { setSending(false) }
  }

  const selectAudience = (key) => {
    setBroadcastAudience(key)
    setBroadcastTarget(AUDIENCE_TAGS[key][0].key)
  }

  return (
    <AdminLayout title="CRM">
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {/* Tab switcher */}
      <div style={s.tabRow}>
        {TABS.filter(t => !t.mainOnly || isMainAdmin).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flexShrink: 0, padding: '10px 14px', borderRadius: 12,
            background: tab === t.key ? GRAD : '#fff',
            color: tab === t.key ? '#fff' : TEXT2,
            border: tab === t.key ? 'none' : '1.5px solid rgba(60,60,67,0.08)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Broadcast button */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={{ ...s.broadcastBtn, ...(showBroadcast ? { background: `${C}18`, borderColor: `${C}55`, color: CD } : {}) }}
          onClick={() => { setShowBroadcast(v => !v); if (showBroadcast) setBroadcastAudience(null) }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Рассылка
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showBroadcast ? 'rotate(180deg)' : 'none' }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Broadcast panel */}
      {showBroadcast && (
        <div style={s.broadcastPanel}>
          {/* Step 1: Audience */}
          <div style={s.field}>
            <div style={s.label}>Кому</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {AUDIENCES.map(aud => (
                <button
                  key={aud.key}
                  onClick={() => selectAudience(aud.key)}
                  style={{
                    padding: '14px 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: broadcastAudience === aud.key ? GRAD : '#F2F2F7',
                    color: broadcastAudience === aud.key ? '#fff' : TEXT2,
                    fontWeight: 700, fontSize: 13,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                    transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {aud.icon}
                  {aud.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Tag carousel */}
          {broadcastAudience && AUDIENCE_TAGS[broadcastAudience].length > 1 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {AUDIENCE_TAGS[broadcastAudience].map(tag => (
                <button
                  key={tag.key}
                  onClick={() => setBroadcastTarget(tag.key)}
                  style={{
                    padding: '7px 16px', borderRadius: 999, border: 'none', flexShrink: 0,
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: broadcastTarget === tag.key ? `${C}22` : '#F2F2F7',
                    color: broadcastTarget === tag.key ? CD : TEXT2,
                    outline: broadcastTarget === tag.key ? `2px solid ${C}66` : 'none',
                    transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Message */}
          {broadcastAudience && (
            <>
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
                <button style={s.cancelBtn} onClick={() => { setShowBroadcast(false); setBroadcastAudience(null) }}>Отмена</button>
                <button style={{ ...s.saveBtn, ...(sending || !broadcastText.trim() ? { opacity: 0.5 } : {}) }}
                  onClick={sendBroadcast} disabled={sending || !broadcastText.trim()}>
                  {sending ? 'Отправляю...' : 'Отправить'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab content */}
      <div style={{ marginTop: 16 }}>
        {tab === 'clients' && <ManagerClients Layout={FragmentLayout} title="Клиенты" />}
        {tab === 'couriers' && <ManagerCouriers Layout={FragmentLayout} title="Курьеры" />}
        {tab === 'managers' && <ManagersTab />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'warehouse' && <WarehouseTab />}
        {tab === 'admins' && <AdminsTab />}
      </div>
    </AdminLayout>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' },
  infoSheet: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    width: '100%', maxHeight: '88vh',
    padding: '10px 20px 40px',
    display: 'flex', flexDirection: 'column',
    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  infoHandle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 14px', display: 'block' },
  closeBtn: {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#F2F2F7', border: 'none', borderRadius: 10, cursor: 'pointer', color: TEXT2,
  },

  tabRow: { display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', paddingBottom: 2 },
  broadcastBtn: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', borderRadius: 14,
    background: '#fff', border: '1.5px solid rgba(60,60,67,0.08)',
    fontSize: 14, fontWeight: 600, color: TEXT,
    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    WebkitTapHighlightColor: 'transparent',
  },
  infoBtn: {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff', border: '1.5px solid rgba(60,60,67,0.08)',
    borderRadius: 14, cursor: 'pointer', color: TEXT2, flexShrink: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    WebkitTapHighlightColor: 'transparent',
  },
  broadcastPanel: {
    background: '#fff', borderRadius: 14, padding: 16, marginTop: 8,
    border: '1.5px solid rgba(60,60,67,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
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
