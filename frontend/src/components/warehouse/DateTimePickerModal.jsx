import { useState } from 'react'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

const toISODate = (d) => d.toISOString().slice(0, 10)
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/**
 * Styled date + time-range picker modal.
 * Props:
 *  - initialDate: Date | null
 *  - initialFrom: 'HH:MM' | ''
 *  - initialTo:   'HH:MM' | ''
 *  - onApply(date, from, to)
 *  - onClose()
 */
export default function DateTimePickerModal({ initialDate, initialFrom, initialTo, onApply, onClose }) {
  const today = new Date()
  const [picked, setPicked] = useState(initialDate ? new Date(initialDate) : new Date(today))
  const [viewMonth, setViewMonth] = useState(new Date((initialDate || today).getFullYear(), (initialDate || today).getMonth(), 1))
  const [from, setFrom] = useState(initialFrom || '')
  const [to, setTo] = useState(initialTo || '')
  const [useTimeRange, setUseTimeRange] = useState(!!(initialFrom || initialTo))

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7 // Monday = 0

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const goPrev = () => setViewMonth(new Date(year, month - 1, 1))
  const goNext = () => setViewMonth(new Date(year, month + 1, 1))

  const apply = () => {
    onApply(picked, useTimeRange ? from : '', useTimeRange ? to : '')
    onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Выбрать дату</div>

        {/* Month header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 4px' }}>
          <button onClick={goPrev} style={s.navBtn} aria-label="Предыдущий месяц">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{MN[month]} {year}</div>
          <button onClick={goNext} style={s.navBtn} aria-label="Следующий месяц">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Weekday labels */}
        <div style={s.grid}>
          {WD.map(d => <div key={d} style={{ ...s.cell, ...s.dayLabel }}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={s.cell} />
            const isPicked = sameDay(d, picked)
            const isToday = sameDay(d, today)
            return (
              <button key={i} onClick={() => setPicked(d)} style={{
                ...s.cell, ...s.dayBtn,
                ...(isPicked ? { background: GRAD, color: '#fff', fontWeight: 800, boxShadow: '0 4px 12px rgba(141,198,63,0.4)' } : {}),
                ...(!isPicked && isToday ? { background: `${C}15`, color: CD, fontWeight: 700 } : {}),
              }}>{d.getDate()}</button>
            )
          })}
        </div>

        {/* Time range toggle */}
        <button onClick={() => setUseTimeRange(v => !v)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff',
          cursor: 'pointer', width: '100%', color: TEXT, fontSize: 14, fontWeight: 600,
        }}>
          <span>Диапазон времени</span>
          <div style={{ width: 36, height: 22, borderRadius: 11, background: useTimeRange ? GRAD : '#e0e0e5', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{
              position: 'absolute', top: 2, left: useTimeRange ? 16 : 2,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </button>

        {useTimeRange && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TimeField label="с" value={from} onChange={setFrom} />
            <TimeField label="по" value={to} onChange={setTo} />
          </div>
        )}

        <button style={s.primaryBtn} onClick={apply}>Применить</button>
        <button style={s.cancelBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function TimeField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`,
          background: '#FAFAFA', color: TEXT, fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9500, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '10px 18px 34px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  navBtn: { width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  cell: { height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 },
  dayLabel: { color: TEXT2, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' },
  dayBtn: { background: 'none', border: 'none', color: TEXT, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'background 0.15s' },
  primaryBtn: { padding: 14, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
  cancelBtn: { padding: 12, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}

export { toISODate }
