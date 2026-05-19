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

const TABS = [
  { key: 'clients', label: 'Клиенты' },
  { key: 'couriers', label: 'Курьеры' },
  { key: 'managers', label: 'Менеджеры' },
]

// Broadcast target groups with descriptions
const BROADCAST_GROUPS = [
  {
    title: 'Клиенты',
    items: [
      { key: 'clients',              label: 'Все клиенты',   color: '#1971C2', bg: '#E8F4FD' },
      { key: 'clients:permanent',    label: 'Постоянные',    color: '#2B8A3E', bg: '#EBFBEE' },
      { key: 'clients:inactive',     label: 'Неактивные',    color: '#868E96', bg: '#F1F3F5' },
      { key: 'clients:bonus',        label: 'С бонусами',    color: '#E67700', bg: '#FFF3D9' },
      { key: 'clients:bottle_debt',  label: 'Должники',      color: '#C92A2A', bg: '#FFF5F5' },
    ],
  },
  {
    title: 'Персонал',
    items: [
      { key: 'couriers',   label: 'Курьеры',    color: '#6741D9', bg: '#F3F0FF' },
      { key: 'managers',   label: 'Менеджеры',  color: '#862E9C', bg: '#F8F0FC' },
      { key: 'all',        label: 'Все',         color: TEXT,      bg: '#F2F2F7' },
    ],
  },
]

// Tag info data used in info modal
const TAG_INFO = [
  {
    group: 'Клиенты',
    tags: [
      { label: 'Постоянный',   color: '#2B8A3E', bg: '#EBFBEE', desc: 'Совершил 5 и более заказов за последние 90 дней. Ядро базы — лояльные покупатели.' },
      { label: 'Неактивный',   color: '#868E96', bg: '#F1F3F5', desc: 'Нет заказов больше 60 дней. Требуют реактивации — скидка, бонусы или напоминание.' },
      { label: 'Новый',        color: '#1971C2', bg: '#E8F4FD', desc: '1–2 заказа. Самый важный момент для удержания — предложите подписку или бонус.' },
      { label: 'Есть бонусы',  color: '#E67700', bg: '#FFF3D9', desc: 'Накопленные бонусные баллы на счёте. Напомните потратить, пока не сгорели.' },
      { label: 'Долг бут.',    color: '#C92A2A', bg: '#FFF5F5', desc: 'Не вернул 19л бутылки. Напомните о возврате — это прямые потери бизнеса.' },
    ],
  },
  {
    group: 'Курьеры',
    tags: [
      { label: 'Топ-курьер',   color: '#E67700', bg: '#FFF3D9', desc: 'Рейтинг 4.5+ и 50+ доставок. Лучшие — первыми получают сложные или крупные заказы.' },
      { label: 'Новичок',      color: '#1971C2', bg: '#E8F4FD', desc: 'Менее 50 доставок. Нуждаются в поддержке, инструкциях и мотивации на старте.' },
      { label: 'Ветеран',      color: '#6741D9', bg: '#F3F0FF', desc: '500+ доставок. Опытные и надёжные — хороши для наставничества новичков.' },
      { label: 'Долг бут.',    color: '#C92A2A', bg: '#FFF5F5', desc: 'Не сданные 19л бутылки на складе. Напомните сдать при следующем заезде.' },
    ],
  },
  {
    group: 'Персонал (рассылка)',
    tags: [
      { label: 'Курьеры',   color: '#6741D9', bg: '#F3F0FF', desc: 'Все активные курьеры. Используйте для оперативных уведомлений о маршрутах, складе, изменениях.' },
      { label: 'Менеджеры', color: '#862E9C', bg: '#F8F0FC', desc: 'Все активные менеджеры. Для внутренних анонсов, обновлений регламентов.' },
      { label: 'Все',       color: TEXT,      bg: '#F2F2F7', desc: 'Клиенты + курьеры + менеджеры. Для общих новостей компании (акции, изменения работы).' },
    ],
  },
]

const FragmentLayout = ({ children }) => <>{children}</>

function TagInfoModal({ onClose }) {
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.infoSheet}>
        <div style={s.infoHandle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Теги и сегменты</div>
          <button onClick={onClose} style={s.closeBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke={TEXT2} strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {TAG_INFO.map(group => (
            <div key={group.group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>{group.group}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.tags.map(tag => (
                  <div key={tag.label} style={{ background: '#FAFAFA', borderRadius: 14, padding: '12px 14px', border: `1px solid ${BORDER}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: tag.bg, color: tag.color, flexShrink: 0, marginTop: 1 }}>{tag.label}</span>
                    <span style={{ fontSize: 13, color: TEXT2, lineHeight: 1.5 }}>{tag.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
  const [showTagInfo, setShowTagInfo] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState('clients')
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

  const selectedGroup = BROADCAST_GROUPS.flatMap(g => g.items).find(i => i.key === broadcastTarget)

  return (
    <AdminLayout title="CRM">
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {showTagInfo && <TagInfoModal onClose={() => setShowTagInfo(false)} />}

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

      {/* Broadcast button row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={s.broadcastBtn} onClick={() => setShowBroadcast(v => !v)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Рассылка
          {selectedGroup && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: selectedGroup.bg, color: selectedGroup.color, marginLeft: 4 }}>
              {selectedGroup.label}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showBroadcast ? 'rotate(180deg)' : 'none' }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button style={s.infoBtn} onClick={() => setShowTagInfo(true)} title="Инфо по тегам">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Broadcast panel */}
      {showBroadcast && (
        <div style={s.broadcastPanel}>
          {/* Target selector */}
          <div style={s.field}>
            <div style={s.label}>Получатели</div>
            {BROADCAST_GROUPS.map(group => (
              <div key={group.title} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, marginBottom: 6, paddingLeft: 2 }}>{group.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => setBroadcastTarget(item.key)}
                      style={{
                        padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 700,
                        background: broadcastTarget === item.key ? item.bg : '#F2F2F7',
                        color: broadcastTarget === item.key ? item.color : TEXT2,
                        outline: broadcastTarget === item.key ? `2px solid ${item.color}40` : 'none',
                        transition: 'all 0.15s',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
            <button style={{ ...s.saveBtn, ...(sending || !broadcastText.trim() ? { opacity: 0.5 } : {}) }}
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

  tabRow: { display: 'flex', gap: 6, marginBottom: 10 },
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
