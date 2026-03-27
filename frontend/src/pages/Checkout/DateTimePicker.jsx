import s, { C } from './styles'

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function getNextDays(count) {
  const result = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    result.push({
      value: d.toISOString().split('T')[0],
      label: i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : DAYS[d.getDay()],
      day: d.getDate(),
      month: MONTHS[d.getMonth()],
      dayName: DAYS[d.getDay()],
    })
  }
  return result
}

const TIME_PERIODS = [
  { key: 'morning', label: 'До обеда', desc: '9:00 – 13:00' },
  { key: 'afternoon', label: 'После обеда', desc: '13:00 – 18:00' },
]

const dates = getNextDays(7)

export default function DateTimePicker({ selectedDate, selectedTime, onDateChange, onTimeChange }) {
  return (
    <div style={s.section}>
      <div style={s.sLabel}>Дата и время доставки</div>
      <div style={s.card}>
        <div style={s.dateScroll}>
          {dates.map(d => (
            <button
              key={d.value}
              style={selectedDate === d.value ? { ...s.dateChip, ...s.dateChipActive } : s.dateChip}
              onClick={() => onDateChange(d.value)}
            >
              <span style={s.dateLabel}>{d.label}</span>
              <span style={s.dateDay}>{d.day}</span>
              <span style={s.dateLabel}>{d.month}</span>
            </button>
          ))}
        </div>
        <div style={s.timeRow}>
          {TIME_PERIODS.map(t => (
            <button
              key={t.key}
              style={selectedTime === t.key ? { ...s.timeBtn, ...s.timeBtnActive } : s.timeBtn}
              onClick={() => onTimeChange(t.key)}
            >
              <div style={{ fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
