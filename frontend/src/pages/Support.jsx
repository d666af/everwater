import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const C = '#8DC63F'
const CD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.12)'

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

function Avatar() {
  return (
    <div style={s.supportAvatar}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.9)"/>
        <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

export default function Support() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'support',
      text: `Привет${user?.name ? ', ' + user.name.split(' ')[0] : ''}! 👋\n\nЯ — служба поддержки Everwater. Как могу помочь?`,
      time: new Date(Date.now() - 60000),
    }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollBottom()
  }, [messages, typing])

  const scrollBottom = () => {
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  const send = (text) => {
    const msg = text.trim() || input.trim()
    if (!msg) return
    setInput('')

    const userMsg = { id: Date.now(), from: 'user', text: msg, time: new Date() }
    setMessages(prev => [...prev, userMsg])

    // Simulate typing
    setTyping(true)
    const delay = 1000 + Math.random() * 1500
    setTimeout(() => {
      setTyping(false)
      const reply = AUTO_RESPONSES[msg] || DEFAULT_RESPONSE
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        from: 'support',
        text: reply,
        time: new Date(),
      }])
    }, delay)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={s.page}>
      {/* Chat header */}
      <div style={s.chatHeader}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={s.headerAvatar}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.95)"/>
            <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="rgba(255,255,255,0.95)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <div style={s.onlineDot} />
        </div>
        <div style={s.headerInfo}>
          <div style={s.headerName}>Служба поддержки</div>
          <div style={s.headerStatus}>
            <span style={s.onlinePulse} />
            Онлайн
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={s.messageList} ref={listRef}>
        <div style={s.dateLabel}>Сегодня</div>

        {messages.map(msg => (
          <div key={msg.id} style={{
            ...s.msgRow,
            justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
          }}>
            {msg.from === 'support' && <Avatar />}
            <div style={{
              ...s.bubble,
              ...(msg.from === 'user' ? s.bubbleUser : s.bubbleSupport),
            }}>
              <div style={{ ...s.bubbleText, color: msg.from === 'user' ? '#fff' : TEXT }}>{msg.text}</div>
              <div style={{
                ...s.bubbleTime,
                color: msg.from === 'user' ? 'rgba(255,255,255,0.65)' : TEXT2,
                textAlign: msg.from === 'user' ? 'right' : 'left',
              }}>
                {formatTime(msg.time)}
                {msg.from === 'user' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 3 }}>
                    <path d="M5 12l4 4L19 7" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ ...s.msgRow, justifyContent: 'flex-start' }}>
            <Avatar />
            <div style={{ ...s.bubble, ...s.bubbleSupport, padding: '12px 16px' }}>
              <div style={s.typingDots}>
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
          <div style={s.quickScroll}>
            {QUICK_REPLIES.map(q => (
              <button key={q} style={s.quickBtn} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={s.inputBar}>
        <textarea
          ref={inputRef}
          style={s.textarea}
          placeholder="Напишите сообщение..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <button
          style={{
            ...s.sendBtn,
            ...(input.trim() ? s.sendBtnActive : {}),
          }}
          onClick={() => send()}
          disabled={!input.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: BG,
    overflow: 'hidden',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px 8px 8px',
    background: '#FFFFFF',
    borderBottom: `1px solid ${BORDER}`,
    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
    minHeight: 60,
    flexShrink: 0,
  },
  backBtn: {
    background: 'rgba(118,118,128,0.1)',
    border: 'none',
    borderRadius: 50,
    width: 36,
    height: 36,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${C} 0%, ${CD} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    boxShadow: `0 3px 12px rgba(141,198,63,0.35)`,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: '50%',
    background: '#34C759',
    border: '2px solid #FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: 700,
    color: TEXT,
    letterSpacing: -0.2,
    lineHeight: 1.2,
  },
  headerStatus: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  onlinePulse: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#34C759',
    display: 'inline-block',
    animation: 'pulse 2s infinite',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  dateLabel: {
    alignSelf: 'center',
    fontSize: 11,
    color: TEXT2,
    fontWeight: 600,
    background: 'rgba(0,0,0,0.06)',
    borderRadius: 999,
    padding: '3px 12px',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  msgRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  supportAvatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${C} 0%, ${CD} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  bubbleSupport: {
    background: '#FFFFFF',
    borderBottomLeftRadius: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  bubbleUser: {
    background: `linear-gradient(135deg, ${C} 0%, ${CD} 100%)`,
    borderBottomRightRadius: 4,
    boxShadow: `0 2px 10px rgba(141,198,63,0.35)`,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 1.5,
    color: TEXT,
    whiteSpace: 'pre-line',
  },
  bubbleTime: {
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  typingDots: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#C7C7CC',
    display: 'inline-block',
    animation: 'typingBounce 1.2s infinite',
  },
  quickWrap: {
    padding: '8px 16px',
    flexShrink: 0,
  },
  quickScroll: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: 2,
  },
  quickBtn: {
    background: '#FFFFFF',
    border: `1.5px solid ${BORDER}`,
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: CD,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.15s',
  },
  inputBar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 10,
    padding: '10px 16px 16px',
    background: '#FFFFFF',
    borderTop: `1px solid ${BORDER}`,
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    border: `1.5px solid ${BORDER}`,
    borderRadius: 22,
    padding: '11px 16px',
    fontSize: 15,
    background: '#F5F5F7',
    color: TEXT,
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    maxHeight: 120,
    overflowY: 'auto',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    background: '#E5E5EA',
    color: '#AEAEB2',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  sendBtnActive: {
    background: `linear-gradient(135deg, ${C} 0%, ${CD} 100%)`,
    color: '#fff',
    cursor: 'pointer',
    boxShadow: `0 4px 16px rgba(141,198,63,0.4)`,
  },
}
