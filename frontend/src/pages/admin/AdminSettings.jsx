import { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getSettings, updateSettings } from '../../api'

function ScrollToTopBtn() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed', bottom: 96, right: 16, zIndex: 300,
        width: 44, height: 44, borderRadius: '50%',
        background: 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(80,140,20,0.35)',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Наверх"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

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
    bottle_bonus_enabled: true,
    cashback_percent: 5,
    bonus_program_enabled: true,
    bonus_program_type: 'percent',
    bottle_return_buttons_visible: true,
    bottle_return_mode: 'max',
    accepted_bottle_companies: [],
    require_bottle_brand_selection: false,
    delivery_enabled: true,
    delivery_price: 0,
    bonus_expiry_days: 60,
    cancellation_penalty_pct: 10,
    late_order_hour: 18,
    late_order_warning_enabled: true,
    delivery_eta_hours: 2,
    delivery_reminder_enabled: true,
    delivery_reminder_2_delay: 10,
    subscriptions_enabled: true,
    support_chat_enabled: true,
    support_contacts_text: '',
    permanent_customer_min_orders: 5,
    permanent_customer_period_days: 90,
    inactive_customer_days: 60,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [confirmSubsOff, setConfirmSubsOff] = useState(false)

  const handleToggleSubs = () => {
    if (form.subscriptions_enabled) {
      setConfirmSubsOff(true)
    } else {
      setForm(p => ({ ...p, subscriptions_enabled: true }))
    }
  }

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

        {/* Subscriptions module master switch */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="#6741D9" strokeWidth="1.8"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="#6741D9" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M8 14h4M8 17h8" stroke="#6741D9" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          }
          title="Подписки на воду"
          hint="Модуль регулярной доставки. При выключении: страница и кнопки скрыты, API закрыт, напоминания не уходят."
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Подписки включены</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                {form.subscriptions_enabled
                  ? 'Клиенты видят страницу подписок, бот показывает кнопку, админ/менеджер/склад работают с подписками'
                  : 'Подписки скрыты у всех ролей. Существующие подписки удалены при выключении'}
              </div>
            </div>
            <button
              onClick={handleToggleSubs}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.subscriptions_enabled ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.subscriptions_enabled ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {form.subscriptions_enabled
              ? <>Подписки <b>включены</b> — модуль работает у всех ролей.</>
              : <span style={{ color: TEXT2 }}>Подписки <b>выключены</b> — пункт меню скрыт, API возвращает 403/пустой список.</span>}
          </div>
        </Section>

        {/* Support chat master switch */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="#1971C2" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M8 10h8M8 14h5" stroke="#1971C2" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          }
          title="Чат поддержки"
          hint="Когда выключен — клиенты и сотрудники видят статичный текст с контактами вместо чата."
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Чат поддержки включён</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                {form.support_chat_enabled
                  ? 'Клиенты пишут в чат, операторы отвечают через бота/сайт'
                  : 'Чат скрыт у всех ролей. На /поддержка показывается контактный текст ниже'}
              </div>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, support_chat_enabled: !p.support_chat_enabled }))}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.support_chat_enabled ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.support_chat_enabled ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          <div style={s.field}>
            <div style={s.label}>Контактный текст (когда чат выключен)</div>
            <textarea
              style={{ ...s.input, minHeight: 100, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }}
              placeholder="📞 Телефон поддержки: +998 90 000-00-00&#10;📨 Telegram: @everwater_support&#10;🕐 Часы работы: 09:00–22:00"
              value={form.support_contacts_text}
              onChange={e => setForm(p => ({ ...p, support_contacts_text: e.target.value }))}
            />
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Эмодзи и переносы строк сохраняются. Используется в боте и на сайте у всех ролей.
          </div>
        </Section>

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

        {/* Accepted bottle companies */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 2h6v3l3 3v12a2 2 0 01-2 2H8a2 2 0 01-2-2V8l3-3V2z" stroke={C} strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 2v3h6V2" stroke={C} strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          }
          title="Приём чужих бутылок"
          hint="Настройка брендов и необходимости выбора марки клиентом"
        >
          {/* Toggle: require brand selection */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Включить указание бренда</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                {form.require_bottle_brand_selection
                  ? 'Клиент выбирает бренд из списка ниже'
                  : 'Клиент не выбирает бренд — принимаются все чужие бутылки'}
              </div>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, require_bottle_brand_selection: !p.require_bottle_brand_selection }))}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.require_bottle_brand_selection ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.require_bottle_brand_selection ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Brand list management */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Список брендов
            </div>
            {(form.accepted_bottle_companies || []).length === 0 ? (
              <div style={{ fontSize: 13, color: TEXT2, padding: '8px 0' }}>Бренды не добавлены</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(form.accepted_bottle_companies || []).map(co => (
                  <div key={co} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 10,
                    border: `1.5px solid ${C}`, background: '#F0FFF0',
                    fontSize: 13, fontWeight: 600, color: TEXT,
                  }}>
                    <span>{co}</span>
                    <button
                      onClick={() => setForm(p => ({ ...p, accepted_bottle_companies: (p.accepted_bottle_companies || []).filter(x => x !== co) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#c0392b', fontSize: 16, display: 'flex', alignItems: 'center' }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new brand */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                style={{ ...s.input, flex: 1 }}
                placeholder="Новый бренд..."
                value={newBrand}
                onChange={e => setNewBrand(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newBrand.trim()) {
                    const name = newBrand.trim()
                    setForm(p => {
                      const cur = p.accepted_bottle_companies || []
                      if (cur.includes(name)) return p
                      return { ...p, accepted_bottle_companies: [...cur, name] }
                    })
                    setNewBrand('')
                  }
                }}
              />
              <button
                onClick={() => {
                  const name = newBrand.trim()
                  if (!name) return
                  setForm(p => {
                    const cur = p.accepted_bottle_companies || []
                    if (cur.includes(name)) return p
                    return { ...p, accepted_bottle_companies: [...cur, name] }
                  })
                  setNewBrand('')
                }}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: C, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >Добавить</button>
            </div>
          </div>

          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {form.require_bottle_brand_selection
              ? (form.accepted_bottle_companies || []).length === 0
                ? 'Бренды не настроены — клиент не сможет выбрать'
                : <>Клиент выбирает из: <b>{(form.accepted_bottle_companies || []).join(', ')}</b></>
              : 'Клиент просто указывает количество — все чужие бутылки принимаются'}
          </div>
        </Section>


        {/* Delivery */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="6" width="15" height="11" rx="2" stroke={C} strokeWidth="1.8"/>
              <path d="M16 10h3l3 3v4h-6V10z" stroke={C} strokeWidth="1.8"/>
              <circle cx="6.5" cy="18.5" r="1.5" fill={C}/>
              <circle cx="18.5" cy="18.5" r="1.5" fill={C}/>
            </svg>
          }
          title="Доставка"
          hint="Стоимость доставки, добавляемая к каждому заказу"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Платная доставка</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                {form.delivery_enabled
                  ? 'К каждому заказу добавляется стоимость доставки'
                  : 'Доставка бесплатна, цена не отображается нигде'}
              </div>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, delivery_enabled: !p.delivery_enabled }))}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.delivery_enabled ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.delivery_enabled ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          {form.delivery_enabled && (
            <div style={s.field}>
              <div style={s.label}>Цена доставки (сум)</div>
              <input style={{ ...s.input, maxWidth: 200 }} type="number" min="0" {...f('delivery_price')} />
            </div>
          )}
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {!form.delivery_enabled
              ? <span style={{ color: TEXT2 }}>Платная доставка <b>выключена</b> — цена не добавляется и нигде не отображается</span>
              : Number(form.delivery_price) === 0
                ? 'Доставка бесплатная'
                : <>Доставка: <b>{Number(form.delivery_price).toLocaleString()} сум</b> к каждому заказу</>}
          </div>
        </Section>

        {/* Bonuses combined */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="#E67700" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          }
          title="Бонусы"
          hint="Кэшбек с заказов, бонус за возврат бутылок и срок действия"
        >
          {/* Cashback row */}
          <div style={s.bonusBlock}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Кэшбек с заказа</div>
                <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>Бонусные баллы клиенту за успешный заказ</div>
              </div>
              <button
                onClick={() => setForm(p => ({ ...p, bonus_program_enabled: !p.bonus_program_enabled }))}
                style={{ width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: form.bonus_program_enabled ? C : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.bonus_program_enabled ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
            {form.bonus_program_enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['fixed', 'Сум'], ['percent', '%']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setForm(p => ({ ...p, bonus_program_type: val }))}
                      style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${form.bonus_program_type === val ? C : BORDER}`, background: form.bonus_program_type === val ? '#F0FFF0' : '#fff', color: form.bonus_program_type === val ? C : TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <input style={{ ...s.input, maxWidth: 140 }} type="number" min="0" max={form.bonus_program_type === 'percent' ? 100 : undefined}
                  value={form.cashback_percent} onChange={e => setForm(p => ({ ...p, cashback_percent: e.target.value }))} />
                <span style={{ fontSize: 13, color: TEXT2 }}>{form.bonus_program_type === 'percent' ? '%' : 'сум'}</span>
              </div>
            )}
          </div>

          <div style={s.bonusDivider} />

          {/* Expiry row */}
          <div style={s.field}>
            <div style={s.label}>Срок действия бонусов (дней, 0 = не сгорают)</div>
            <input style={{ ...s.input, maxWidth: 180 }} type="number" min="0" {...f('bonus_expiry_days')} />
          </div>

          <div style={s.bonusDivider} />

          {/* Bottle bonus row */}
          <div style={s.bonusBlock}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Бонус за бутылку</div>
                <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>Начисляется за каждую возвращённую 19л бутылку</div>
              </div>
              <button
                onClick={() => setForm(p => ({ ...p, bottle_bonus_enabled: !p.bottle_bonus_enabled }))}
                style={{ width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: form.bottle_bonus_enabled ? C : '#ddd', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.bottle_bonus_enabled ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
            {form.bottle_bonus_enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['fixed', 'Сум'], ['percent', '%']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setForm(p => ({ ...p, bottle_discount_type: val }))}
                      style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${form.bottle_discount_type === val ? C : BORDER}`, background: form.bottle_discount_type === val ? '#F0FFF0' : '#fff', color: form.bottle_discount_type === val ? C : TEXT2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <input style={{ ...s.input, maxWidth: 140 }} type="number" min="0" max={form.bottle_discount_type === 'percent' ? 100 : undefined}
                  value={form.bottle_discount_value} onChange={e => setForm(p => ({ ...p, bottle_discount_value: e.target.value }))} />
                <span style={{ fontSize: 13, color: TEXT2 }}>{form.bottle_discount_type === 'percent' ? '%' : 'сум'}</span>
              </div>
            )}
          </div>

          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {form.bonus_program_enabled
              ? <>Кэшбек: <b>{form.cashback_percent}{form.bonus_program_type === 'percent' ? '%' : ' сум'}</b> с заказа. </>
              : <span style={{ color: TEXT2 }}>Кэшбек выключен. </span>}
            {form.bottle_bonus_enabled
              ? <>Бутылка: <b>{Number(form.bottle_discount_value).toLocaleString()}{form.bottle_discount_type === 'percent' ? '%' : ' сум'}</b>. </>
              : <span style={{ color: TEXT2 }}>Бонус за бутылку выключен. </span>}
            {Number(form.bonus_expiry_days) > 0
              ? <>Срок: <b>{form.bonus_expiry_days} дн.</b></>
              : <>Бонусы не сгорают.</>}
          </div>
        </Section>

        {/* Cancellation & late orders */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="#E03131" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          }
          title="Отмены и поздние заказы"
          hint="Штраф за отмену после назначения курьера и порог времени"
        >
          <div style={s.formGrid}>
            <div style={s.field}>
              <div style={s.label}>Штраф за отмену (%)</div>
              <input style={s.input} type="number" min="0" max="100" {...f('cancellation_penalty_pct')} />
            </div>
            <div style={s.field}>
              <div style={s.label}>Поздний заказ с (час, 0–23)</div>
              <input style={{ ...s.input, opacity: form.late_order_warning_enabled ? 1 : 0.4 }}
                type="number" min="0" max="23" {...f('late_order_hour')}
                disabled={!form.late_order_warning_enabled} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Предупреждение о позднем заказе</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                Показывать клиентам предупреждение при оформлении после {form.late_order_hour}:00
              </div>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, late_order_warning_enabled: !p.late_order_warning_enabled }))}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.late_order_warning_enabled ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.late_order_warning_enabled ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            При отмене после назначения курьера — штраф <b>{form.cancellation_penalty_pct}%</b>.{' '}
            {form.late_order_warning_enabled
              ? <>Предупреждение о позднем заказе после <b>{form.late_order_hour}:00</b>.</>
              : <span style={{ color: TEXT2 }}>Предупреждение о позднем заказе отключено.</span>}
          </div>
        </Section>

        {/* ETA & delivery reminders */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#1971C2" strokeWidth="1.8"/>
              <path d="M12 7v5l3 3" stroke="#1971C2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          title="ETA и напоминания курьеру"
          hint="Расчётное время доставки и автоуведомления при задержке"
        >
          <div style={s.formGrid}>
            <div style={s.field}>
              <div style={s.label}>Окно доставки (часов)</div>
              <input style={{ ...s.input, maxWidth: 180 }} type="number" min="1" max="24" {...f('delivery_eta_hours')} />
            </div>
            <div style={s.field}>
              <div style={s.label}>2-е напоминание (мин после 1-го)</div>
              <input
                style={{ ...s.input, maxWidth: 180, opacity: form.delivery_reminder_enabled ? 1 : 0.4 }}
                type="number" min="1" max="120"
                {...f('delivery_reminder_2_delay')}
                disabled={!form.delivery_reminder_enabled}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Уведомления при просрочке ETA</div>
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                {form.delivery_reminder_enabled
                  ? `Курьер получит напоминание когда ETA пройдёт, и повторное через ${form.delivery_reminder_2_delay} мин`
                  : 'Уведомления отключены — курьер не будет оповещён о задержке'}
              </div>
            </div>
            <button
              onClick={() => setForm(p => ({ ...p, delivery_reminder_enabled: !p.delivery_reminder_enabled }))}
              style={{
                width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: form.delivery_reminder_enabled ? C : '#ddd',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: form.delivery_reminder_enabled ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            ETA: <b>{form.delivery_eta_hours} ч</b> после назначения.{' '}
            {form.delivery_reminder_enabled
              ? <>Напоминания включены: 1-е при просрочке, 2-е через <b>{form.delivery_reminder_2_delay} мин</b>.</>
              : <span style={{ color: TEXT2 }}>Напоминания отключены.</span>}
          </div>
        </Section>

        {/* Customer classification */}
        <Section
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="7" r="4" stroke="#8DC63F" strokeWidth="1.8"/>
              <path d="M2 21c0-3.3 3.1-6 7-6" stroke="#8DC63F" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M17 13l2 2 4-4" stroke="#8DC63F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          title="Классификация клиентов"
          hint="Пороги для тегов «Постоянный» и «Неактивный» в CRM"
        >
          <div style={s.formGrid}>
            <div style={s.field}>
              <div style={s.label}>Постоянный — мин. заказов</div>
              <input style={{ ...s.input, maxWidth: 180 }} type="number" min="1" {...f('permanent_customer_min_orders')} />
            </div>
            <div style={s.field}>
              <div style={s.label}>Постоянный — период (дней, 0 = за всё время)</div>
              <input style={{ ...s.input, maxWidth: 180 }} type="number" min="0" {...f('permanent_customer_period_days')} />
            </div>
            <div style={s.field}>
              <div style={s.label}>Неактивный — дней без заказа</div>
              <input style={{ ...s.input, maxWidth: 180 }} type="number" min="1" {...f('inactive_customer_days')} />
            </div>
          </div>
          <div style={s.preview}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={C} strokeWidth="1.5"/>
              <path d="M12 8v4M12 16h.01" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <b>Постоянный</b>:{' '}
            {Number(form.permanent_customer_period_days) > 0
              ? <>{form.permanent_customer_min_orders}+ доставленных заказов за последние <b>{form.permanent_customer_period_days} дн.</b></>
              : <>{form.permanent_customer_min_orders}+ доставленных заказов за всё время.</>}
            {' '}<b>Неактивный</b>: нет заказов более <b>{form.inactive_customer_days} дн.</b>
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

      <ScrollToTopBtn />

      {confirmSubsOff && (
        <div
          style={s.modalOverlay}
          onClick={e => e.target === e.currentTarget && setConfirmSubsOff(false)}
        >
          <div style={s.modalSheet}>
            <div style={s.modalIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 22h20L12 2z" stroke="#E03131" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M12 10v5M12 18h.01" stroke="#E03131" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={s.modalTitle}>Выключить модуль подписок?</div>
            <div style={s.modalBody}>
              <b>Все существующие подписки</b> (активные, на паузе, ожидающие подтверждения)
              будут <b>удалены</b> при сохранении настроек.
              <div style={{ marginTop: 8, color: '#E03131', fontWeight: 600 }}>
                Это действие необратимо.
              </div>
            </div>
            <div style={s.modalActions}>
              <button style={s.modalCancel} onClick={() => setConfirmSubsOff(false)}>
                Отмена
              </button>
              <button
                style={s.modalConfirm}
                onClick={() => {
                  setForm(p => ({ ...p, subscriptions_enabled: false }))
                  setConfirmSubsOff(false)
                }}
              >
                Выключить и удалить
              </button>
            </div>
          </div>
        </div>
      )}
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

  bonusBlock: { display: 'flex', flexDirection: 'column', gap: 12 },
  bonusDivider: { height: 1, background: BORDER, margin: '2px 0' },

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

  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modalSheet: {
    background: '#fff', borderRadius: 20, maxWidth: 420, width: '100%',
    padding: '24px 22px 20px', display: 'flex', flexDirection: 'column',
    gap: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  modalIcon: {
    width: 56, height: 56, borderRadius: '50%', background: '#FFF5F5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18, fontWeight: 800, color: TEXT, textAlign: 'center',
  },
  modalBody: {
    fontSize: 14, color: TEXT2, lineHeight: 1.5, textAlign: 'center',
    padding: '0 4px',
  },
  modalActions: {
    display: 'flex', gap: 8, marginTop: 8,
  },
  modalCancel: {
    flex: 1, padding: '12px 16px', borderRadius: 12,
    border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  modalConfirm: {
    flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none',
    background: '#E03131', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(224,49,49,0.3)',
    WebkitTapHighlightColor: 'transparent',
  },
}
