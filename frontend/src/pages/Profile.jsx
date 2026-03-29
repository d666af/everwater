import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserByTelegram, getSettings } from '../api'
import { useAuthStore } from '../store/auth'
import { useUserStore } from '../store/user'

const tg = window.Telegram?.WebApp
const C = '#8DC63F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const TOPUP_AMOUNTS = [5000, 10000, 20000, 50000]

const SUB_PLANS = [
  { key: 'weekly', label: 'Еженедельная', desc: 'Доставка каждую неделю', days: 7 },
  { key: 'monthly', label: 'Ежемесячная', desc: 'Доставка раз в месяц', days: 30 },
]
const SUB_WATERS = [
  { name: 'Вода 20л', volume: 20, price: 25000, blockSize: 1 },
  { name: 'Вода 10л', volume: 10, price: 14000, blockSize: 1 },
  { name: 'Вода 5л', volume: 5, price: 8000, blockSize: 1 },
  { name: 'Вода 1.5л', volume: 1.5, price: 4500, blockSize: 6 },
  { name: 'Вода 1л', volume: 1, price: 3500, blockSize: 12 },
  { name: 'Вода 0.5л', volume: 0.5, price: 2000, blockSize: 12 },
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

// ─── Active Subscription Detail ──────────────────────────────────────────────
function SubscriptionDetail({ sub, onClose, onExtend, onCancel }) {
  const [confirming, setConfirming] = useState(false)
  const endDate = new Date(sub.created)
  endDate.setDate(endDate.getDate() + (sub.plan === 'weekly' ? 7 : 30))
  const daysLeft = Math.max(0, Math.ceil((endDate - Date.now()) / 86400000))
  const isExpiring = daysLeft <= 3

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Подписка</div>

        <div style={{ background: isExpiring ? '#FFF5F5' : '#f8f8fa', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
              {sub.plan === 'weekly' ? 'Еженедельная' : 'Ежемесячная'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: sub.status === 'active' ? '#EBFBEE' : '#FFF5F5',
              color: sub.status === 'active' ? '#2B8A3E' : '#E03131' }}>
              {sub.status === 'active' ? 'Активна' : 'Истекла'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#3c3c43' }}>{sub.water} × {sub.qty}</div>
          <div style={{ fontSize: 13, color: '#3c3c43' }}>{sub.address}</div>
          {sub.day && <div style={{ fontSize: 13, color: '#3c3c43' }}>День: {sub.day}, {sub.time === 'morning' ? '9:00–13:00' : '13:00–18:00'}</div>}
          <div style={{ height: 1, background: '#e5e5ea' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#8e8e93' }}>Сумма</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: C }}>{(sub.total || 0).toLocaleString()} сум</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#8e8e93' }}>Действует до</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: isExpiring ? '#E03131' : '#1a1a1a' }}>
              {endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              {isExpiring && ` (${daysLeft} дн.)`}
            </span>
          </div>
        </div>

        {isExpiring && (
          <div style={{ background: '#FFF8E6', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="#E67700" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#E67700" strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 13, color: '#E67700', fontWeight: 600 }}>Подписка скоро истекает!</span>
          </div>
        )}

        <button style={s.primaryBtn} onClick={() => onExtend(sub)}>
          Продлить подписку
        </button>
        {!confirming ? (
          <button style={{ ...s.ghostBtn, color: '#ef4444' }} onClick={() => setConfirming(true)}>
            Прекратить подписку
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...s.ghostBtn, flex: 1 }} onClick={() => setConfirming(false)}>Отмена</button>
            <button style={{ flex: 1, padding: '12px', borderRadius: 14, border: 'none', background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { onCancel(sub.id); onClose() }}>
              Прекратить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Subscription Modal ──────────────────────────────────────────────────────
function SubscriptionModal({ onClose, settings, userStore }) {
  const [step, setStep] = useState('plan') // plan | details | payment | done
  const [plan, setPlan] = useState('weekly')
  const [water, setWater] = useState({ name: 'Вода 20л', volume: 20, price: 25000, qty: 1, blockSize: 1 })
  const [carbonated, setCarbonated] = useState(false)
  const [useBlock, setUseBlock] = useState(false)
  const [addr, setAddr] = useState('')
  const [landmark, setLandmark] = useState('')
  const [phone, setPhone] = useState('')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [payMethod, setPayMethod] = useState('balance')
  const [loading, setLoading] = useState(false)

  const displayName = carbonated ? water.name.replace('Вода', 'Газ. вода') : water.name
  const actualQty = useBlock && water.blockSize > 1 ? water.qty * water.blockSize : water.qty
  const total = water.price * actualQty
  const canPayBalance = userStore.balance >= total

  const submit = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    if (payMethod === 'balance') userStore.deductBalance(total)
    userStore.addSubscription({
      plan, water: displayName, qty: actualQty, total,
      address: addr, landmark, phone, payMethod, day, time,
      carbonated,
    })
    setLoading(false)
    setStep('done')
  }

  if (step === 'done') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: GRAD,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Подписка оформлена!</div>
          <div style={{ fontSize: 14, color: '#8e8e93', marginTop: 6 }}>
            {plan === 'weekly' ? 'Еженедельная' : 'Ежемесячная'} доставка — {displayName} x{actualQty}
          </div>
        </div>
        <button style={s.primaryBtn} onClick={onClose}>Готово</button>
      </div>
    </div>
  )

  if (step === 'payment') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Оплата подписки</div>
        <div style={{ background: '#f8f8fa', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#3c3c43' }}>
            <span>{displayName} x{actualQty}</span>
            <span style={{ fontWeight: 700 }}>{total.toLocaleString()} сум</span>
          </div>
          <div style={{ fontSize: 12, color: '#8e8e93' }}>
            {plan === 'weekly' ? 'Еженедельная' : 'Ежемесячная'} · {day}, {time === 'morning' ? '9:00–13:00' : '13:00–18:00'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            style={payMethod === 'balance' ? { ...ss.payOpt, ...ss.payOptActive } : ss.payOpt}
            onClick={() => canPayBalance && setPayMethod('balance')}
          >
            <div style={ss.payDot(payMethod === 'balance')} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Баланс</div>
              <div style={{ fontSize: 12, color: canPayBalance ? '#8e8e93' : '#ef4444' }}>
                {canPayBalance ? `${userStore.balance.toLocaleString()} сум` : 'Недостаточно средств'}
              </div>
            </div>
          </button>
          <button
            style={payMethod === 'card' ? { ...ss.payOpt, ...ss.payOptActive } : ss.payOpt}
            onClick={() => setPayMethod('card')}
          >
            <div style={ss.payDot(payMethod === 'card')} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Карта</div>
              <div style={{ fontSize: 12, color: '#8e8e93' }}>Перевод на карту</div>
            </div>
          </button>
        </div>
        <button style={s.primaryBtn} onClick={submit} disabled={loading}>
          {loading ? <span style={s.spinner} /> : `Оплатить ${total.toLocaleString()} сум`}
        </button>
        <button style={s.ghostBtn} onClick={() => setStep('details')}>Назад</button>
      </div>
    </div>
  )

  if (step === 'details') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Данные доставки</div>

        {/* Day of week */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          День недели
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WEEKDAYS.map(d => (
            <button key={d}
              style={day === d ? { ...ss.dayChip, ...ss.dayChipActive } : ss.dayChip}
              onClick={() => setDay(d)}>
              {d}
            </button>
          ))}
        </div>

        {/* Time */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Время
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={time === 'morning' ? { ...ss.timeBtn, ...ss.timeBtnActive } : ss.timeBtn}
            onClick={() => setTime('morning')}>
            <div style={{ fontWeight: 700 }}>До обеда</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>9:00 – 13:00</div>
          </button>
          <button style={time === 'afternoon' ? { ...ss.timeBtn, ...ss.timeBtnActive } : ss.timeBtn}
            onClick={() => setTime('afternoon')}>
            <div style={{ fontWeight: 700 }}>После обеда</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>13:00 – 18:00</div>
          </button>
        </div>

        {/* Address fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={ss.inp} placeholder="Адрес доставки" value={addr} onChange={e => setAddr(e.target.value)} />
          <input style={ss.inp} placeholder="Ориентир" value={landmark} onChange={e => setLandmark(e.target.value)} />
          <input style={ss.inp} placeholder="Телефон" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        <button style={{ ...s.primaryBtn, ...(!addr || !phone || !day || !time ? { opacity: 0.5 } : {}) }}
          onClick={() => setStep('payment')} disabled={!addr || !phone || !day || !time}>
          К оплате
        </button>
        <button style={s.ghostBtn} onClick={() => setStep('plan')}>Назад</button>
      </div>
    </div>
  )

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Оформление подписки</div>

        {/* Plan selection */}
        <div style={ss.secLabel}>Тип подписки</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {SUB_PLANS.map(p => (
            <button key={p.key}
              style={plan === p.key ? { ...ss.planChip, ...ss.planChipActive } : ss.planChip}
              onClick={() => setPlan(p.key)}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: plan === p.key ? 'rgba(255,255,255,0.7)' : '#8e8e93' }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Water selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={ss.secLabel}>Вода</div>
          <button
            style={{ ...ss.carbToggle, ...(carbonated ? ss.carbToggleActive : {}) }}
            onClick={() => setCarbonated(!carbonated)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="2" fill="currentColor" opacity="0.5"/>
              <circle cx="8" cy="11" r="1.5" fill="currentColor" opacity="0.5"/>
              <circle cx="15" cy="13" r="1.5" fill="currentColor" opacity="0.5"/>
              <circle cx="11" cy="17" r="1" fill="currentColor" opacity="0.5"/>
            </svg>
            Газированная
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SUB_WATERS.map(w => (
            <button key={w.name}
              style={water.name === w.name ? { ...ss.waterOpt, ...ss.waterOptActive } : ss.waterOpt}
              onClick={() => { setWater({ ...w, qty: water.qty }); if (w.blockSize <= 1) setUseBlock(false) }}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {carbonated ? w.name.replace('Вода', 'Газ. вода') : w.name}
                </div>
                <div style={{ fontSize: 12, color: '#8e8e93' }}>{w.price.toLocaleString()} сум</div>
              </div>
              {water.name === w.name && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke={C} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Block toggle for small bottles */}
        {water.blockSize > 1 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={!useBlock ? { ...ss.blockBtn, ...ss.blockBtnActive } : ss.blockBtn}
              onClick={() => setUseBlock(false)}>
              Штучно
            </button>
            <button
              style={useBlock ? { ...ss.blockBtn, ...ss.blockBtnActive } : ss.blockBtn}
              onClick={() => setUseBlock(true)}>
              Блоками ({water.blockSize} шт)
            </button>
          </div>
        )}

        {/* Quantity */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            {useBlock && water.blockSize > 1 ? 'Блоков' : 'Количество'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={ss.qtyBtn} onClick={() => setWater(w => ({ ...w, qty: Math.max(1, w.qty - 1) }))}>−</button>
            <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{water.qty}</span>
            <button style={ss.qtyBtn} onClick={() => setWater(w => ({ ...w, qty: w.qty + 1 }))}>+</button>
          </div>
        </div>
        {useBlock && water.blockSize > 1 && (
          <div style={{ fontSize: 12, color: '#8e8e93', marginTop: -6 }}>
            = {actualQty} шт ({water.qty} × {water.blockSize})
          </div>
        )}

        <div style={{ background: '#f8f8fa', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, color: '#8e8e93' }}>Итого</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: C }}>{total.toLocaleString()} сум</span>
        </div>

        <button style={s.primaryBtn} onClick={() => setStep('details')}>
          Далее
        </button>
        <button style={s.ghostBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

const ss = {
  secLabel: { fontSize: 12, fontWeight: 700, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.4 },
  planChip: {
    flex: 1, padding: '12px 10px', borderRadius: 14,
    border: '1.5px solid #e5e5ea', background: '#fff',
    cursor: 'pointer', textAlign: 'center',
  },
  planChipActive: {
    border: `1.5px solid ${C}`, background: GRAD, color: '#fff',
  },
  carbToggle: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 10,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 12, fontWeight: 600, color: '#8e8e93', cursor: 'pointer',
  },
  carbToggleActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },
  waterOpt: {
    display: 'flex', alignItems: 'center', padding: '12px 14px',
    borderRadius: 14, border: '1.5px solid #e5e5ea', background: '#fff',
    cursor: 'pointer',
  },
  waterOptActive: { border: `1.5px solid ${C}`, background: `${C}08` },
  blockBtn: {
    flex: 1, padding: '10px', borderRadius: 12,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 600, color: '#8e8e93', cursor: 'pointer',
    textAlign: 'center',
  },
  blockBtnActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },
  qtyBtn: {
    width: 34, height: 34, borderRadius: 10,
    border: `1.5px solid ${C}`, background: '#fff',
    fontSize: 18, fontWeight: 700, color: C,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dayChip: {
    padding: '10px 14px', borderRadius: 12,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
    minWidth: 42, textAlign: 'center',
  },
  dayChipActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },
  timeBtn: {
    flex: 1, padding: '12px 8px', borderRadius: 14,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#3c3c43',
    textAlign: 'center',
  },
  timeBtnActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },
  inp: {
    border: '1.5px solid #e5e5ea', borderRadius: 14, padding: '14px 16px',
    fontSize: 15, outline: 'none', background: '#fafafa', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  payOpt: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    borderRadius: 14, border: '1.5px solid #e5e5ea', background: '#fff',
    cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  payOptActive: { border: `1.5px solid ${C}`, background: `${C}08` },
  payDot: (active) => ({
    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${active ? C : '#ddd'}`,
    background: active ? C : 'transparent',
  }),
}

function TopupModal({ onClose, settings }) {
  const [amount, setAmount] = useState(1000)
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [step, setStep] = useState('select')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const finalAmount = useCustom ? (Number(custom) || 0) : amount

  const copyCard = () => {
    navigator.clipboard?.writeText(settings?.payment_card || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (step === 'pending') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={s.pendingIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
              <path d="M12 7v5l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Запрос отправлен</div>
          <div style={{ fontSize: 14, color: '#8e8e93', marginTop: 6, lineHeight: 1.5 }}>
            Заявка на <strong>{finalAmount.toLocaleString()} сум</strong> отправлена.
            Менеджер проверит и зачислит средства.
          </div>
        </div>
        <button style={s.primaryBtn} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  )

  if (step === 'payment') return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Оплата пополнения</div>
        <div style={s.payCard}>
          <div style={s.payLabel}>Переведите на карту</div>
          <div style={s.payNum}>{settings?.payment_card || '0000 0000 0000 0000'}</div>
          <div style={s.payHolder}>{settings?.payment_holder || '—'}</div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Сумма</div>
          <div style={s.payAmt}>{finalAmount.toLocaleString()} <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>сум</span></div>
          <button style={{ ...s.copyBtn, ...(copied ? s.copyDone : {}) }} onClick={copyCard}>
            {copied ? 'Скопировано' : 'Скопировать номер карты'}
          </button>
        </div>
        <div style={s.helpSteps}>
          <div style={s.helpStep}><span style={s.helpNum}>1</span> Переведите сумму на карту</div>
          <div style={s.helpStep}><span style={s.helpNum}>2</span> Нажмите «Я оплатил»</div>
          <div style={s.helpStep}><span style={s.helpNum}>3</span> Менеджер подтвердит зачисление</div>
        </div>
        <button style={s.primaryBtn} onClick={async () => {
          setLoading(true); await new Promise(r => setTimeout(r, 1000)); setLoading(false); setStep('pending')
        }} disabled={loading}>
          {loading ? <span style={s.spinner} /> : 'Я оплатил'}
        </button>
        <button style={s.ghostBtn} onClick={() => setStep('select')}>Назад</button>
      </div>
    </div>
  )

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={s.sheetTitle}>Пополнение баланса</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TOPUP_AMOUNTS.map(a => (
            <button key={a}
              style={!useCustom && amount === a ? { ...s.amtChip, ...s.amtChipActive } : s.amtChip}
              onClick={() => { setAmount(a); setUseCustom(false) }}
            >
              {a.toLocaleString()} сум
            </button>
          ))}
        </div>
        <div style={s.customWrap}>
          <div style={s.customLabel}>Своя сумма</div>
          <div style={{ ...s.customRow, ...(useCustom ? s.customRowActive : {}) }}>
            <input type="number" inputMode="numeric" placeholder="0"
              value={custom}
              onFocus={() => setUseCustom(true)}
              onChange={e => { setCustom(e.target.value); setUseCustom(true) }}
              style={s.customInput}
            />
            <span style={{ fontSize: 18, fontWeight: 600, color: '#8e8e93' }}>сум</span>
          </div>
        </div>
        <button style={{ ...s.primaryBtn, ...((!finalAmount || finalAmount < 100) ? { opacity: 0.5 } : {}) }}
          onClick={() => setStep('payment')} disabled={!finalAmount || finalAmount < 100}>
          К оплате · {finalAmount > 0 ? `${finalAmount.toLocaleString()} сум` : '—'}
        </button>
        <button style={s.ghostBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

export default function Profile() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLogout, setShowLogout] = useState(false)
  const [showTopup, setShowTopup] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [subDetail, setSubDetail] = useState(null)
  const [lang, setLang] = useState('ru')
  const [settings, setSettings] = useState({ payment_card: '', payment_holder: '' })
  const { logout, user: authUser } = useAuthStore()
  const userStore = useUserStore()
  const navigate = useNavigate()

  useEffect(() => {
    const tgUser = tg?.initDataUnsafe?.user
    if (tgUser?.id) {
      getUserByTelegram(tgUser.id)
        .then(u => { setUser(u); if (!userStore.initialized) userStore.init(u) })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else if (authUser) {
      setUser(authUser)
      if (!userStore.initialized) userStore.init(authUser)
      setLoading(false)
    } else {
      setLoading(false)
    }
    getSettings().then(setSettings).catch(console.error)
  }, [authUser]) // eslint-disable-line

  const doLogout = () => { logout(); navigate('/login') }

  const balance = userStore.initialized ? userStore.balance : (user?.balance || 0)
  const bonusPoints = userStore.initialized ? userStore.bonus_points : (user?.bonus_points || 0)
  const orderCount = userStore.initialized ? userStore.order_count : (user?.order_count || 0)

  if (loading) return (
    <div style={s.center}><div style={s.spinner} /></div>
  )

  if (!user) return (
    <div style={s.center}>
      <p style={{ color: '#8e8e93', fontSize: 14 }}>Откройте через Telegram</p>
      <button style={s.ghostBtn} onClick={doLogout}>Выйти</button>
    </div>
  )

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={s.page}>
      {showTopup && <TopupModal onClose={() => setShowTopup(false)} settings={settings} />}
      {showSub && <SubscriptionModal onClose={() => setShowSub(false)} settings={settings} userStore={userStore} />}
      {subDetail && (
        <SubscriptionDetail
          sub={subDetail}
          onClose={() => setSubDetail(null)}
          onExtend={() => { setSubDetail(null); setShowSub(true) }}
          onCancel={(id) => {
            const list = userStore.subscriptions.filter(s => s.id !== id)
            localStorage.setItem('everwater_subscriptions', JSON.stringify(list))
            useUserStore.setState({ subscriptions: list })
          }}
        />
      )}

      {/* Order count badge — top right */}
      <div style={s.orderBadge}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke={C} strokeWidth="1.8"/>
          <path d="M8 8h8M8 12h5" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <span style={s.orderBadgeNum}>{orderCount}</span>
        <span style={s.orderBadgeLabel}>заказов</span>
      </div>

      {/* Avatar + name */}
      <div style={s.profileHeader}>
        <div style={s.avatar}>{initials}</div>
        <div style={s.profileName}>{user.name}</div>
        <div style={s.profilePhone}>{user.phone}</div>
      </div>

      {/* Balance card */}
      <div style={s.balanceCard}>
        <div style={s.balanceTop}>
          <div style={s.balanceIconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="3" stroke="#fff" strokeWidth="1.8"/>
              <path d="M2 10h20" stroke="#fff" strokeWidth="1.8"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.balanceLabel}>Баланс</div>
            <div style={s.balanceAmount}>{balance.toLocaleString()} <span style={s.balanceCurrency}>сум</span></div>
          </div>
          <button style={s.topupBtn} onClick={() => setShowTopup(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Пополнить
          </button>
        </div>
      </div>

      {/* Bonus card */}
      {bonusPoints > 0 && (
        <div style={s.bonusCard}>
          <div style={s.bonusIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#F59E0B"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.bonusTitle}>{bonusPoints.toLocaleString()} бонусов</div>
            <div style={s.bonusDesc}>Используйте при оформлении заказа</div>
          </div>
        </div>
      )}

      {/* Subscription card */}
      {userStore.subscriptions.length > 0 ? (
        <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {userStore.subscriptions.map(sub => {
            const endDate = new Date(sub.created)
            endDate.setDate(endDate.getDate() + (sub.plan === 'weekly' ? 7 : 30))
            const daysLeft = Math.max(0, Math.ceil((endDate - Date.now()) / 86400000))
            const isExpiring = daysLeft <= 3
            return (
              <div key={sub.id} style={s.subCard} onClick={() => setSubDetail(sub)}>
                <div style={{ ...s.subIcon, background: isExpiring ? 'linear-gradient(135deg, #FF6B6B, #E03131)' : 'linear-gradient(135deg, #4FC3F7, #2196F3)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M3 3v5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.subTitle}>{sub.water} × {sub.qty}</div>
                  <div style={s.subDesc}>
                    {sub.plan === 'weekly' ? 'Еженедельная' : 'Ежемесячная'}
                    {isExpiring ? ` · ${daysLeft} дн. осталось` : ` · до ${endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`}
                  </div>
                </div>
                {isExpiring && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E03131', flexShrink: 0 }} />}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            )
          })}
          <button style={s.addSubBtn} onClick={() => setShowSub(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Новая подписка
          </button>
        </div>
      ) : (
        <div style={s.subCard} onClick={() => setShowSub(true)}>
          <div style={s.subIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 3v5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.subTitle}>Подписка на воду</div>
            <div style={s.subDesc}>Регулярная доставка со скидкой</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )}

      {/* Menu */}
      <div style={s.menuCard}>
        <button style={s.menuItem} onClick={() => navigate('/support')}>
          <div style={{ ...s.menuIcon, background: `${C}12` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke={C} strokeWidth="1.7" strokeLinejoin="round"/>
              <path d="M8 9h8M8 13h5" stroke={C} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={s.menuLabel}>Поддержка</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div style={s.menuDivider} />
        <div style={s.menuItem}>
          <div style={{ ...s.menuIcon, background: `${C}12` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.7"/>
              <path d="M2 12h20" stroke={C} strokeWidth="1.7"/>
              <ellipse cx="12" cy="12" rx="4" ry="9" stroke={C} strokeWidth="1.7"/>
            </svg>
          </div>
          <span style={s.menuLabel}>Язык</span>
          <div style={s.langSwitch}>
            <button
              style={lang === 'ru' ? { ...s.langBtn, ...s.langBtnActive } : s.langBtn}
              onClick={() => setLang('ru')}
            >RU</button>
            <button
              style={lang === 'uz' ? { ...s.langBtn, ...s.langBtnActive } : s.langBtn}
              onClick={() => setLang('uz')}
            >UZ</button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={s.infoCard}>
        <div style={s.infoRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 22s8-4.5 8-11V5l-8-3-8 3v6c0 6.5 8 11 8 11z" fill={C}/>
          </svg>
          <span style={s.infoText}>Проверенное качество воды</span>
        </div>
        <div style={s.infoRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={C} strokeWidth="1.8"/>
            <path d="M12 7v5l3 3" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={s.infoText}>Доставка от 1 часа</span>
        </div>
        <div style={s.infoRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={C} strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="7" r="4" stroke={C} strokeWidth="1.8"/>
          </svg>
          <span style={s.infoText}>Персональные бонусы</span>
        </div>
      </div>

      {/* Logout */}
      {!tg?.initDataUnsafe?.user && (
        <>
          {!showLogout ? (
            <button style={s.logoutBtn} onClick={() => setShowLogout(true)}>Выйти из аккаунта</button>
          ) : (
            <div style={s.logoutCard}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>Выйти?</div>
              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
                <button style={s.cancelBtn} onClick={() => setShowLogout(false)}>Отмена</button>
                <button style={s.confirmLogout} onClick={doLogout}>Выйти</button>
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 100 }} />
    </div>
  )
}

const s = {
  page: {
    background: '#e4e4e8', minHeight: '100dvh',
    display: 'flex', flexDirection: 'column', gap: 10,
    paddingTop: 4, position: 'relative',
  },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 14, height: '70vh', padding: '0 32px',
    background: '#e4e4e8',
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `2.5px solid ${C}30`, borderTop: `2.5px solid ${C}`,
    animation: 'spin 0.8s linear infinite',
  },

  /* Order badge top-right */
  orderBadge: {
    position: 'absolute', top: 6, right: 16,
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff', borderRadius: 12, padding: '6px 12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  orderBadgeNum: { fontSize: 15, fontWeight: 800, color: '#1a1a1a' },
  orderBadgeLabel: { fontSize: 12, color: '#8e8e93', fontWeight: 500 },

  /* Profile header */
  profileHeader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '20px 20px 8px', gap: 4,
  },
  avatar: {
    width: 72, height: 72, borderRadius: '50%',
    background: GRAD,
    color: '#fff', fontSize: 26, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    boxShadow: '0 4px 16px rgba(100,160,30,0.35)',
  },
  profileName: { fontSize: 20, fontWeight: 700, color: '#1a1a1a' },
  profilePhone: { fontSize: 14, color: '#8e8e93' },

  /* Balance */
  balanceCard: {
    background: GRAD, margin: '0 16px',
    borderRadius: 18, padding: '16px 16px',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  balanceTop: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  balanceIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
  balanceAmount: { fontSize: 22, fontWeight: 800, color: '#fff' },
  balanceCurrency: { fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.6)' },
  topupBtn: {
    background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },

  /* Bonus */
  bonusCard: {
    background: '#fff', margin: '0 16px',
    borderRadius: 18, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  bonusIcon: {
    width: 42, height: 42, borderRadius: 14,
    background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bonusTitle: { fontSize: 15, fontWeight: 700, color: '#92400E' },
  bonusDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },

  /* Subscription */
  subCard: {
    background: '#fff', margin: '0 16px',
    borderRadius: 18, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    cursor: 'pointer',
  },
  subIcon: {
    width: 42, height: 42, borderRadius: 14,
    background: 'linear-gradient(135deg, #4FC3F7, #2196F3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  subTitle: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  subDesc: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  addSubBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: '#fff', border: `2px solid ${C}`, borderRadius: 14,
    padding: '12px 16px', fontSize: 14, fontWeight: 700, color: C,
    cursor: 'pointer',
  },

  /* Menu */
  menuCard: {
    background: '#fff', margin: '0 16px', borderRadius: 18,
    overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  menuItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left',
  },
  menuIcon: {
    width: 38, height: 38, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: 600, color: '#1a1a1a' },
  menuDivider: { height: 1, background: '#f0f0f2', margin: '0 16px' },

  /* Language switcher */
  langSwitch: {
    display: 'flex', gap: 4, background: '#f0f0f2', borderRadius: 10, padding: 3,
  },
  langBtn: {
    padding: '6px 14px', borderRadius: 8, border: 'none',
    background: 'none', fontSize: 13, fontWeight: 700,
    color: '#8e8e93', cursor: 'pointer',
  },
  langBtnActive: {
    background: '#fff', color: C,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },

  /* Info */
  infoCard: {
    background: '#fff', margin: '0 16px', borderRadius: 18,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  infoRow: { display: 'flex', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 13, color: '#3c3c43', fontWeight: 500 },

  /* Logout */
  logoutBtn: {
    margin: '0 16px', background: '#fff', border: 'none',
    borderRadius: 18, padding: '14px', fontSize: 15, fontWeight: 600,
    color: '#ef4444', cursor: 'pointer', textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  logoutCard: {
    background: '#fff', margin: '0 16px', borderRadius: 18,
    padding: 16, textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cancelBtn: {
    flex: 1, padding: '12px', borderRadius: 12,
    border: 'none', background: '#f0f0f2',
    fontSize: 14, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
  },
  confirmLogout: {
    flex: 1, padding: '12px', borderRadius: 12,
    border: 'none', background: '#ef4444',
    fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)', zIndex: 9000,
    display: 'flex', alignItems: 'flex-end',
  },
  sheet: {
    background: '#fff', borderRadius: '18px 18px 0 0', width: '100%',
    padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 12,
    animation: 'slideUp 0.25s ease', maxHeight: '88vh', overflowY: 'auto',
  },
  handle: { width: 36, height: 4, borderRadius: 2, background: '#ddd', alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', textAlign: 'center' },
  pendingIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#FFA726',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
  },
  primaryBtn: {
    width: '100%', height: 50, borderRadius: 14, border: 'none',
    background: GRAD, color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  ghostBtn: {
    width: '100%', padding: '12px', borderRadius: 14,
    border: 'none', background: '#f0f0f2',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#8e8e93',
    textAlign: 'center',
  },
  amtChip: {
    padding: '14px 8px', borderRadius: 14, border: '1.5px solid #e5e5ea',
    background: '#fff', fontSize: 15, fontWeight: 700, color: '#1a1a1a',
    cursor: 'pointer', textAlign: 'center',
  },
  amtChipActive: { border: `1.5px solid ${C}`, background: `${C}08`, color: C },
  customWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  customLabel: { fontSize: 12, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.4 },
  customRow: {
    display: 'flex', alignItems: 'center', border: '1.5px solid #e5e5ea',
    borderRadius: 14, background: '#fff', padding: '0 14px', transition: 'all 0.2s',
  },
  customRowActive: { border: `1.5px solid ${C}`, background: '#fff' },
  customInput: {
    flex: 1, border: 'none', background: 'none', outline: 'none',
    fontSize: 20, fontWeight: 700, color: '#1a1a1a', padding: '12px 0', fontFamily: 'inherit',
  },

  // Payment card in modal
  payCard: {
    background: '#1a1a1a', borderRadius: 18, padding: '16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  payNum: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3, fontFamily: 'monospace' },
  payHolder: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 },
  payAmt: { fontSize: 28, fontWeight: 800, color: C },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  copyDone: { background: `${C}25`, borderColor: `${C}50`, color: C },

  // Help steps in payment modal
  helpSteps: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: '#f8f8fa', borderRadius: 14, padding: 14,
  },
  helpStep: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  helpNum: {
    width: 26, height: 26, borderRadius: '50%', background: GRAD, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
}
