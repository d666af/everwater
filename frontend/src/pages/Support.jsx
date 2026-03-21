import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const QUICK_REPLIES = [
  'Где мой заказ?',
  'Хочу отменить заказ',
  'Как пополнить баланс?',
  'Не работает приложение',
]

const AUTO_RESPONSES = {
  'Где мой заказ?': 'Проверьте раздел «Заказы» — там отображается статус и этапы доставки в реальном времени. Если заказ задерживается, напишите номер заказа и мы уточним у курьера.',
  'Хочу отменить заказ': 'Для отмены заказа сообщите нам его номер. Отмена возможна до момента передачи курьеру. Мы обработаем запрос в ближайшие 5–10 минут.',
  'Как пополнить баланс?': 'Перейдите в Профиль → Баланс → нажмите «+ Пополнить». Выберите или введите сумму и подтвердите. Мы проверим перевод вручную и зачислим средства.',
  'Не работает приложение': 'Попробуйте перезапустить Telegram и снова открыть бот. Если проблема остаётся — опишите её подробнее, и наш технический специалист поможет.',
}

const DEFAULT_RESPONSE = 'Спасибо за обращение! Мы получили ваше сообщение и ответим в ближайшее время. Среднее время ответа — 5–10 минут.'

function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export default function Support() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    {
      id: 1, from: 'support',
      text: `Привет${user?.name ? ', ' + user.name.split(' ')[0] : ''}!\n\nЯ — служба поддержки Everwater. Как могу помочь?`,
      time: new Date(Date.now() - 60000),
    }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }, [messages, typing])

  const send = (text) => {
    const msg = text?.trim() || input.trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text: msg, time: new Date() }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(prev => [...prev, {
        id: Date.now() + 1, from: 'support',
        text: AUTO_RESPONSES[msg] || DEFAULT_RESPONSE,
        time: new Date(),
      }])
    }, 1000 + Math.random() * 1500)
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={s.headerAvatar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.9)"/>
            <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Поддержка</div>
          <div style={{ fontSize: 12, color: '#8DC63F', fontWeight: 600 }}>Онлайн</div>
        </div>
      </div>

      {/* Messages */}
      <div style={s.messageList} ref={listRef}>
        {messages.map(msg => (
          <div key={msg.id} style={{ ...s.msgRow, justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={msg.from === 'user' ? { ...s.bubble, ...s.bubbleUser } : { ...s.bubble, ...s.bubbleSupport }}>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{msg.text}</div>
              <div style={{ fontSize: 11, color: msg.from === 'user' ? 'rgba(255,255,255,0.55)' : '#bbb', textAlign: 'right', marginTop: 4 }}>
                {formatTime(msg.time)}
              </div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ ...s.msgRow, justifyContent: 'flex-start' }}>
            <div style={{ ...s.bubble, ...s.bubbleSupport, padding: '12px 16px' }}>
              <div style={s.dots}>
                <span style={{ ...s.dot, animationDelay: '0ms' }} />
                <span style={{ ...s.dot, animationDelay: '150ms' }} />
                <span style={{ ...s.dot, animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick replies */}
      {messages.length <= 2 && (
        <div style={s.quickWrap}>
          {QUICK_REPLIES.map(q => (
            <button key={q} style={s.quickBtn} onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={s.inputBar}>
        <input
          style={s.inputField}
          placeholder="Напишите сообщение..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
        />
        <button style={{ ...s.sendBtn, ...(input.trim() ? s.sendBtnActive : {}) }}
          onClick={() => send()} disabled={!input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fafafa', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', background: '#fff',
    borderBottom: '1px solid #f0f0f0', minHeight: 56, flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none', width: 36, height: 36,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: '50%', background: '#8DC63F',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  messageList: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 6 },
  bubble: { maxWidth: '78%', borderRadius: 16, padding: '10px 14px' },
  bubbleSupport: { background: '#fff', borderBottomLeftRadius: 4, border: '1px solid #f0f0f0', color: '#111' },
  bubbleUser: { background: '#8DC63F', borderBottomRightRadius: 4, color: '#fff' },
  dots: { display: 'flex', gap: 4 },
  dot: {
    width: 7, height: 7, borderRadius: '50%', background: '#ccc',
    animation: 'typingBounce 1.2s infinite',
  },
  quickWrap: {
    display: 'flex', gap: 8, padding: '8px 16px',
    overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
  },
  quickBtn: {
    background: '#fff', border: '1px solid #eee', borderRadius: 20,
    padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#8DC63F',
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
  inputBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px 14px', background: '#fff',
    borderTop: '1px solid #f0f0f0', flexShrink: 0,
  },
  inputField: {
    flex: 1, border: '1.5px solid #eee', borderRadius: 20,
    padding: '10px 16px', fontSize: 15, background: '#f7f7f8',
    color: '#111', outline: 'none', fontFamily: 'inherit',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: '50%', border: 'none',
    background: '#eee', color: '#bbb', cursor: 'not-allowed',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnActive: { background: '#8DC63F', color: '#fff', cursor: 'pointer' },
}
