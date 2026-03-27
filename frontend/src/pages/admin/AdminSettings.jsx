import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getSettings, updateSettings } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.12)'

function Section({ icon, title, hint, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHead}>
        <div style={s.sectionIcon}>{icon}</div>
        <div>
          <div style={s.sectionTitle}>{title}</div>
          {hint && <div style={s.sectionHint}>{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function AdminSettings() {
  const [form, setForm] = useState({
    payment_card: '',
    payment_holder: '',
    bottle_discount_type: 'fixed',
    bottle_discount_value: 50,
    cashback_percent: 5,
    bottle_return_buttons_visible: true,
    bottle_return_mode: 'max',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings()
      .then(s => setForm(f => ({ ...f, ...s })))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Ошибка при сохранении') } finally { setSaving(false) }
  }

  const f = (name) => ({
    value: form[name],
    onChange: e => setForm(p => ({ ...p, [name]: e.target.value })),
  })

  if (loading) return (
    <AdminLayout title="Настройки">
      <div style={s.center}><div style={s.spinner} /></div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Настройки">
      <div style={s.page}>

        {/* Payment */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke={C} strokeWidth="1.8"/>
              <path d="M2 10h20" stroke={C} strokeWidth="1.5"/>
              <path d="M6 15h4" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
          title="Платёжные реквизиты"
          hint="Отображаются клиенту при оформлении заказа"
        >
          <div style={s.formGrid}>
            <div style={s.field}>
              <div style={s.label}>Номер карты</div>
              <input style={s.input} placeholder="0000 0000 0000 0000" {...f('payment_card')} />
            </div>
            <div style={s.field}>
              <div style={s.label}>Получатель</div>
              <input style={s.input} placeholder="Иванов Иван Иванович" {...f('payment_holder')} />
            </div>
          </div>
        </Section>

        {/* Bottle return discount */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M3 3v5h5" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          }
          title="Скидка за возврат бутылок"
          hint="Применяется к заказу при сдаче пустых бутылок"
        >
          <div style={s.radioGroup}>
            <label style={{ ...s.radioOption, ...(form.bottle_discount_type === 'fixed' ? s.radioOptionActive : {}) }}>
              <input type="radio" value="fixed" checked={form.bottle_discount_type === 'fixed'}
                onChange={e => setForm(p => ({ ...p, bottle_discount_type: e.target.value }))}
                style={{ display: 'none' }} />
              <div style={s.radioDot(form.bottle_discount_type === 'fixed')} />
              Фиксированная (сум/бутылка)
            </label>
            <label style={{ ...s.radioOption, ...(form.bottle_discount_type === 'percent' ? s.radioOptionActive : {}) }}>
              <input type="radio" value="percent" checked={form.bottle_discount_type === 'percent'}
                onChange={e => setForm(p => ({ ...p, bottle_discount_type: e.target.value }))}
                style={{ display: 'none' }} />
              <div style={s.radioDot(form.bottle_discount_type === 'percent')} />
              Процентная (% от суммы)
            </label>
          </div>
          <div style={s.field}>
            <div style={s.label}>
              {form.bottle_discount_type === 'fixed' ? 'Скидка (сум/бутылка)' : 'Скидка (%)'}
            </div>
            <input style={{ ...s.input, maxWidth: 180 }} type="number" min="0" {...f('bottle_discount_value')} />
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Пример: при возврате 3 бутылок — скидка{' '}
            <b>
              {form.bottle_discount_type === 'fixed'
                ? `${3 * Number(form.bottle_discount_value)} сум`
                : `${form.bottle_discount_value}% от суммы заказа`}
            </b>
          </div>
        </Section>

        {/* Bottle return settings */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M3 3v5h5" stroke="#12B886" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          }
          title="Возврат бутылок"
          hint="Настройки отображения и лимита возврата для клиентов"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Кнопки +/−</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>Клиент может менять кол-во возвращаемых бутылок</div>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, bottle_return_buttons_visible: !p.bottle_return_buttons_visible }))}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.bottle_return_buttons_visible ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.bottle_return_buttons_visible ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <div style={s.radioGroup}>
            <label style={{ ...s.radioOption, ...(form.bottle_return_mode === 'max' ? s.radioOptionActive : {}) }}>
              <input type="radio" value="max" checked={form.bottle_return_mode === 'max'}
                onChange={e => setForm(p => ({ ...p, bottle_return_mode: e.target.value }))}
                style={{ display: 'none' }} />
              <div style={s.radioDot(form.bottle_return_mode === 'max')} />
              Максимальный (все долги)
            </label>
            <label style={{ ...s.radioOption, ...(form.bottle_return_mode === 'equal' ? s.radioOptionActive : {}) }}>
              <input type="radio" value="equal" checked={form.bottle_return_mode === 'equal'}
                onChange={e => setForm(p => ({ ...p, bottle_return_mode: e.target.value }))}
                style={{ display: 'none' }} />
              <div style={s.radioDot(form.bottle_return_mode === 'equal')} />
              Равномерный (= кол-ву заказа)
            </label>
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {form.bottle_return_mode === 'max'
              ? 'Клиент может вернуть до максимума (все должные бутылки)'
              : 'Клиент может вернуть только столько, сколько заказал в текущем заказе'}
          </div>
        </Section>

        {/* Cashback */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="#E67700" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          }
          title="Бонусная программа"
          hint="Клиент получает бонусные баллы после успешной доставки"
        >
          <div style={s.field}>
            <div style={s.label}>Кэшбэк с заказа (%)</div>
            <input style={{ ...s.input, maxWidth: 180 }} type="number" min="0" max="100" {...f('cashback_percent')} />
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Пример: заказ на 100 000 сум — клиент получит <b>{form.cashback_percent * 1000} сум</b> бонусами
          </div>
        </Section>

        {error && <div style={s.errorMsg}>{error}</div>}
        {saved && (
          <div style={s.successMsg}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="#2B8A3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Настройки сохранены
          </div>
        )}

        <button style={{ ...s.saveBtn, ...(saving ? { opacity: 0.6 } : {}) }} onClick={save} disabled={saving}>
          {saving ? 'Сохраняю...' : 'Сохранить настройки'}
        </button>
      </div>
    </AdminLayout>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 },
  center: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(141,198,63,0.2)', borderTop: `3px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },

  section: {
    background: '#fff', borderRadius: 16, padding: '18px 20px',
    border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  sectionHead: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  sectionIcon: {
    width: 40, height: 40, borderRadius: 12,
    background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: { fontWeight: 800, fontSize: 16, color: TEXT, lineHeight: 1.3 },
  sectionHint: { fontSize: 12, color: TEXT2, marginTop: 2 },

  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px',
    fontSize: 15, outline: 'none', background: '#FAFAFA', color: TEXT, width: '100%',
    boxSizing: 'border-box',
  },

  radioGroup: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  radioOption: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
    border: `1.5px solid ${BORDER}`, borderRadius: 10, cursor: 'pointer',
    fontSize: 13, color: TEXT2, fontWeight: 500, flex: 1, minWidth: 180,
    transition: 'all 0.15s',
  },
  radioOptionActive: { borderColor: C, background: '#F0FFF0', color: TEXT, fontWeight: 600 },
  radioDot: (active) => ({
    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${active ? C : BORDER}`,
    background: active ? C : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  }),

  preview: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, color: TEXT2, background: '#F0FFF0',
    borderRadius: 10, padding: '10px 14px',
  },

  errorMsg: { color: '#E03131', fontSize: 13, fontWeight: 500 },
  successMsg: {
    display: 'flex', alignItems: 'center', gap: 6,
    color: '#2B8A3E', fontSize: 13, fontWeight: 600,
    background: '#EBFBEE', padding: '10px 14px', borderRadius: 10,
  },

  saveBtn: {
    padding: '14px 32px', background: `linear-gradient(135deg, ${C}, ${CD})`, color: '#fff',
    border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.35)', alignSelf: 'flex-start',
    WebkitTapHighlightColor: 'transparent',
  },
}
