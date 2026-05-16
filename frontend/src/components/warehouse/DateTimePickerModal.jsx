import { useState } from 'react'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = `linear-gradient(135deg, ${C}, ${CD})`
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BORDER = 'rgba(60,60,67,0.08)'

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export const toISODate = (d) => d.toISOString().slice(0, 10)
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const dayMs = 86400000

/**
 * Date-range picker modal.
 * Props:
 *  - initialDate:   Date | null   — range start (or single day)
 *  - initialDateTo: Date | null   — range end (if set, opens in range mode)
 *  - onApply(startDate, endDate)
 *  - onClose()
 */
// Parse a YYYY-MM-DD string (or Date) into a local-midnight Date, avoiding timezone shift
function parseLocalDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  const [y, m, d] = String(v).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function DateTimePickerModal({ initialDate, initialDateTo, onApply, onClose }) {
  const today = new Date()
  const initStart = parseLocalDate(initialDate) || new Date(today)
  const [rangeMode, setRangeMode] = useState(!!initialDateTo)
  const [start, setStart] = useState(initStart)
  const [end, setEnd] = useState(parseLocalDate(initialDateTo))
  const [viewMonth, setViewMonth] = useState(new Date(initStart.getFullYear(), initStart.getMonth(), 1))

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const goPrev = () => setViewMonth(new Date(year, month - 1, 1))
  const goNext = () => setViewMonth(new Date(year, month + 1, 1))

  const handleDayClick = (d) => {
    if (!rangeMode) {
      setStart(d); setEnd(null)
      return
    }
    if (!end) {
      // Second click — set end or swap if earlier than start
      if (sameDay(d, start)) { setEnd(null); return }
      if (d < start) { setEnd(start); setStart(d) }
      else { setEnd(d) }
    } else {
      // Reset with new start
      setStart(d); setEnd(null)
    }
  }

  const toggleRange = () => {
    setRangeMode(v => !v)
    setEnd(null)
  }

  const apply = () => {
    // Always pass dates as local YYYY-MM-DD strings to avoid timezone shift
    const localISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const s = localISO(start)
    const e = rangeMode && end ? localISO(end) : null
    onApply(s, e)
    onClose()
  }

  const rangeStart = rangeMode ? start : null
  const rangeEnd = rangeMode ? end : null

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        <div style={s.handle} />
        <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, textAlign: 'center' }}>Выбрать дату</div>

        {/* Month header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 4px' }}>
          <button onClick={goPrev} style={s.navBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{MN[month]} {year}</div>
          <button onClick={goNext} style={s.navBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div style={s.grid}>
          {WD.map(d => <div key={d} style={{ ...s.cell, ...s.dayLabel }}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} style={s.cell} />
            const isStart = sameDay(d, rangeStart) || (!rangeMode && sameDay(d, start))
            const isEnd = sameDay(d, rangeEnd)
            const inRange = rangeStart && rangeEnd && d > rangeStart && d < rangeEnd
            const isToday = sameDay(d, today)
            const active = isStart || isEnd

            return (
              <button key={i} onClick={() => handleDayClick(d)} style={{
                ...s.cell, ...s.dayBtn,
                background: active ? GRAD : inRange ? `${C}22` : 'none',
                color: active ? '#fff' : inRange ? CD : isToday ? CD : TEXT,
                fontWeight: active ? 800 : inRange ? 600 : isToday ? 700 : 500,
                boxShadow: active ? '0 4px 12px rgba(141,198,63,0.4)' : 'none',
                borderRadius: isStart && rangeEnd ? '10px 0 0 10px' : isEnd ? '0 10px 10px 0' : inRange ? 0 : 10,
              }}>{d.getDate()}</button>
            )
          })}
        </div>

        {/* Range mode hint */}
        {rangeMode && !end && (
          <div style={{ fontSize: 12, color: TEXT2, textAlign: 'center', marginTop: -4 }}>
            {!start ? 'Выберите начало диапазона' : 'Теперь выберите конец диапазона'}
          </div>
        )}

        {/* Диапазон дней toggle */}
        <button onClick={toggleRange} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BORDER}`, background: '#fff',
          cursor: 'pointer', width: '100%', color: TEXT, fontSize: 14, fontWeight: 600,
        }}>
          <span>Диапазон дней</span>
          <div style={{ width: 36, height: 22, borderRadius: 11, background: rangeMode ? GRAD : '#e0e0e5', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{
              position: 'absolute', top: 2, left: rangeMode ? 16 : 2,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
        </button>

        <button style={s.primaryBtn} onClick={apply}>Применить</button>
        <button style={s.cancelBtn} onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 9500, display: 'flex', alignItems: 'flex-end' },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', padding: '10px 18px 34px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)' },
  handle: { width: 40, height: 4, borderRadius: 99, background: '#E0E0E5', margin: '0 auto 4px', display: 'block' },
  navBtn: { width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 },
  cell: { height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 },
  dayLabel: { color: TEXT2, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' },
  dayBtn: { background: 'none', border: 'none', color: TEXT, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'background 0.15s' },
  primaryBtn: { padding: 14, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(141,198,63,0.35)' },
  cancelBtn: { padding: 12, borderRadius: 14, border: `1.5px solid ${BORDER}`, background: 'none', color: TEXT2, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
