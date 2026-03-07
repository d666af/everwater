import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getSettings, updateSettings } from '../../api'

export default function AdminSettings() {
  const [form, setForm] = useState({
    payment_card: '',
    payment_holder: '',
    bottle_discount_type: 'fixed',
    bottle_discount_value: 50,
    cashback_percent: 5,
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

  if (loading) return <AdminLayout title="Настройки"><div style={styles.center}>Загрузка...</div></AdminLayout>

  return (
    <AdminLayout title="Настройки">
      <div style={styles.page}>
        {/* Payment */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>💳 Платёжные реквизиты</h3>
          <p style={styles.hint}>Эти данные показываются клиенту при оформлении заказа</p>
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Номер карты</label>
              <input style={styles.input} placeholder="0000 0000 0000 0000" {...f('payment_card')} />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Получатель</label>
              <input style={styles.input} placeholder="Иванов Иван Иванович" {...f('payment_holder')} />
            </div>
          </div>
        </div>

        {/* Bottle return discount */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>♻️ Скидка за возврат бутылок</h3>
          <p style={styles.hint}>Скидка применяется к заказу когда клиент возвращает пустые бутылки</p>
          <div style={styles.radioGroup}>
            <label style={styles.radio}>
              <input type="radio" value="fixed" checked={form.bottle_discount_type === 'fixed'}
                onChange={e => setForm(p => ({ ...p, bottle_discount_type: e.target.value }))} />
              <span>Фиксированная (сум за бутылку)</span>
            </label>
            <label style={styles.radio}>
              <input type="radio" value="percent" checked={form.bottle_discount_type === 'percent'}
                onChange={e => setForm(p => ({ ...p, bottle_discount_type: e.target.value }))} />
              <span>Процентная (% от суммы заказа)</span>
            </label>
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              {form.bottle_discount_type === 'fixed' ? 'Сумма скидки (сум/бутылка)' : 'Процент скидки (%)'}
            </label>
            <input style={{ ...styles.input, maxWidth: 200 }} type="number" min="0" {...f('bottle_discount_value')} />
          </div>
          <div style={styles.preview}>
            Пример: при возврате 3 бутылок — скидка{' '}
            <b>
              {form.bottle_discount_type === 'fixed'
                ? `${3 * Number(form.bottle_discount_value)} сум`
                : `${form.bottle_discount_value}% от суммы заказа`}
            </b>
          </div>
        </div>

        {/* Cashback / Bonuses */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🎁 Бонусная программа</h3>
          <p style={styles.hint}>Клиент получает бонусы после успешной доставки</p>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Кэшбэк с заказа (%)</label>
            <input style={{ ...styles.input, maxWidth: 200 }} type="number" min="0" max="100" {...f('cashback_percent')} />
          </div>
          <div style={styles.preview}>
            Пример: заказ на 1000 сум — клиент получит <b>{form.cashback_percent} сум</b> бонусами
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {saved && <div style={styles.success}>✅ Настройки сохранены</div>}

        <button style={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? 'Сохраняем...' : 'Сохранить настройки'}
        </button>
      </div>
    </AdminLayout>
  )
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  section: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14,
  },
  sectionTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: '#1a237e' },
  hint: { margin: 0, fontSize: 13, color: '#888' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#555' },
  input: {
    border: '1px solid #ddd', borderRadius: 8, padding: '9px 12px',
    fontSize: 14, outline: 'none', background: '#fafafa', width: '100%',
  },
  radioGroup: { display: 'flex', gap: 20, flexWrap: 'wrap' },
  radio: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  preview: {
    fontSize: 14, color: '#555', background: '#e8eaf6',
    borderRadius: 8, padding: '10px 14px',
  },
  error: { color: '#c62828', fontSize: 14, fontWeight: 500 },
  success: { color: '#2e7d32', fontSize: 14, fontWeight: 500 },
  saveBtn: {
    padding: '13px 32px', background: '#1a237e', color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    alignSelf: 'flex-start',
  },
}
