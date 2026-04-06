import { useState, useEffect, useRef } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getSupportChats, getSupportMessages, sendSupportMessage, markChatRead } from '../../api'

const C = '#8DC63F'
const CD = '#6CA32F'
const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'
const BG = '#F2F2F7'
const BORDER = 'rgba(60,60,67,0.08)'

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatRelTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function Avatar({ name, size = 40 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: GRAD,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: size * 0.38,
      flexShrink: 0,
      letterSpacing: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function ChatItem({ chat, active, onClick }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: `1px solid ${BORDER}`,
        transition: 'background 0.15s',
        background: active ? 'rgba(141,198,63,0.1)' : '#fff',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={onClick}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={chat.user_name} size={44} />
        {chat.unread > 0 && (
          <div style={{
            position: 'absolute',
            top: -2,
            right: -2,
            background: '#FF3B30',
            color: '#fff',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            minWidth: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid #fff',
          }}>
            {chat.unread}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontWeight: 600,
            fontSize: 14,
            color: TEXT,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {chat.user_name}
          </span>
          <span style={{ fontSize: 11, color: TEXT2, flexShrink: 0 }}>
            {formatRelTime(chat.last_time)}
          </span>
        </div>
        <div style={{
          fontSize: 13,
          color: TEXT2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 2,
          fontWeight: chat.unread > 0 ? 600 : 400,
        }}>
          {chat.last_message}
        </div>
        {chat.user_phone && (
          <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2 }}>
            {chat.user_phone}
          </div>
        )}
      </div>
    </div>
  )
}

function DateSeparator({ label }) {
  return (
    <div style={{
      alignSelf: 'center',
      fontSize: 11,
      color: TEXT2,
      fontWeight: 600,
      background: 'rgba(0,0,0,0.05)',
      borderRadius: 999,
      padding: '3px 14px',
      margin: '8px 0',
    }}>
      {label}
    </div>
  )
}

const QUICK_REPLIES = [
  'Ваш заказ обрабатывается',
  'Курьер уже в пути',
  'Ожидайте звонка',
  'Спасибо за обращение!',
]

export default function ManagerSupport() {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const msgEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    getSupportChats()
      .then(data => {
        const sorted = [...data].sort((a, b) => new Date(b.last_time) - new Date(a.last_time))
        setChats(sorted)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeChatId === null) return
    getSupportMessages(activeChatId).then(setMessages).catch(console.error)
    markChatRead(activeChatId).catch(() => {})
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, unread: 0 } : c))
  }, [activeChatId])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeChat = chats.find(c => c.id === activeChatId)
  const unreadTotal = chats.filter(c => c.unread > 0).length

  const openChat = (id) => {
    setActiveChatId(id)
    if (isMobile) setShowChat(true)
  }

  const closeChat = () => {
    if (isMobile) setShowChat(false)
    setActiveChatId(null)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !activeChatId || sending) return
    setInput('')
    setSending(true)
    try {
      const msg = await sendSupportMessage(activeChatId, text)
      setMessages(prev => [...prev, msg])
      setChats(prev =>
        prev.map(c =>
          c.id === activeChatId
            ? { ...c, last_message: text, last_time: new Date().toISOString() }
            : c
        ).sort((a, b) => new Date(b.last_time) - new Date(a.last_time))
      )
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
    inputRef.current?.focus()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
  }

  const groupMessagesByDate = (msgs) => {
    const groups = []
    let currentDate = null
    for (const msg of msgs) {
      const d = new Date(msg.time)
      const dateStr = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      if (dateStr !== currentDate) {
        currentDate = dateStr
        groups.push({ type: 'date', label: dateStr, key: 'date-' + dateStr })
      }
      groups.push({ type: 'message', data: msg, key: msg.id })
    }
    return groups
  }

  const showListPane = isMobile ? !showChat : true
  const showChatPane = isMobile ? showChat && activeChatId !== null : true

  const renderChatList = () => (
    <div style={{
      width: isMobile ? '100%' : 320,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      borderRight: isMobile ? 'none' : `1px solid ${BORDER}`,
      overflowY: 'auto',
    }}>
      <div style={{
        padding: '16px 16px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${BORDER}`,
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: TEXT }}>Диалоги</div>
        {unreadTotal > 0 && (
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: CD,
            background: 'rgba(141,198,63,0.12)',
            padding: '3px 10px',
            borderRadius: 10,
          }}>
            {unreadTotal} новых
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: TEXT2, fontSize: 14 }}>Загрузка...</div>
      ) : chats.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: TEXT2, fontSize: 14 }}>Обращений пока нет</div>
      ) : (
        chats.map(chat => (
          <ChatItem
            key={chat.id}
            chat={chat}
            active={activeChatId === chat.id}
            onClick={() => openChat(chat.id)}
          />
        ))
      )}
    </div>
  )

  const renderNoChatSelected = () => (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 8,
      background: BG,
    }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2, marginBottom: 8 }}>
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke={TEXT}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Выберите диалог</div>
      <div style={{ fontSize: 13, color: TEXT2, textAlign: 'center', maxWidth: 220, lineHeight: 1.4 }}>
        Нажмите на клиента слева, чтобы открыть чат
      </div>
    </div>
  )

  const renderChatView = () => {
    const grouped = groupMessagesByDate(messages)

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
        background: BG,
      }}>
        {/* Header */}
        <div style={{
          background: '#fff',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${BORDER}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          flexShrink: 0,
        }}>
          {isMobile && (
            <button
              style={{
                background: 'rgba(118,118,128,0.1)',
                border: 'none',
                borderRadius: 10,
                width: 36,
                height: 36,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
              onClick={closeChat}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <Avatar name={activeChat?.user_name} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{activeChat?.user_name}</div>
            {activeChat?.user_phone && (
              <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{activeChat.user_phone}</div>
            )}
          </div>
          {activeChat?.user_phone && (
            <a
              href={`tel:${activeChat.user_phone}`}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: `1.5px solid ${C}`,
                background: 'rgba(141,198,63,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z"
                  fill={C}
                />
              </svg>
            </a>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {grouped.map(item => {
            if (item.type === 'date') {
              return <DateSeparator key={item.key} label={item.label} />
            }
            const msg = item.data
            const isSupport = msg.from === 'support'
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 8,
                  justifyContent: isSupport ? 'flex-end' : 'flex-start',
                }}
              >
                {!isSupport && <Avatar name={activeChat?.user_name} size={28} />}
                <div style={{
                  maxWidth: 'min(75%, 300px)',
                  borderRadius: 18,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  wordBreak: 'break-word',
                  ...(isSupport
                    ? {
                        background: GRAD,
                        borderBottomRightRadius: 4,
                        boxShadow: '0 2px 8px rgba(141,198,63,0.3)',
                      }
                    : {
                        background: '#fff',
                        borderBottomLeftRadius: 4,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      }
                  ),
                }}>
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: isSupport ? '#fff' : TEXT,
                    whiteSpace: 'pre-line',
                  }}>
                    {msg.text}
                  </div>
                  <div style={{
                    fontSize: 11,
                    marginTop: 3,
                    color: isSupport ? 'rgba(255,255,255,0.65)' : TEXT2,
                    textAlign: 'right',
                  }}>
                    {formatTime(msg.time)}
                  </div>
                </div>
                {isSupport && (
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: GRAD,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.9)" />
                      <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
          <div ref={msgEndRef} />
        </div>

        {/* Quick replies */}
        <div style={{
          padding: '8px 16px',
          borderTop: `1px solid ${BORDER}`,
          background: '#fff',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            paddingBottom: 2,
            msOverflowStyle: 'none',
          }}>
            {QUICK_REPLIES.map(q => (
              <button
                key={q}
                style={{
                  background: '#fff',
                  border: `1.5px solid ${BORDER}`,
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: CD,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.15s',
                  fontFamily: 'inherit',
                }}
                onClick={() => {
                  setInput(q)
                  inputRef.current?.focus()
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          padding: '10px 16px 14px',
          background: '#fff',
          borderTop: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            style={{
              flex: 1,
              border: `1.5px solid ${BORDER}`,
              borderRadius: 20,
              padding: '10px 14px',
              fontSize: 14,
              background: BG,
              color: TEXT,
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              maxHeight: 100,
              overflowY: 'auto',
              WebkitTapHighlightColor: 'transparent',
            }}
            placeholder="Написать клиенту..."
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKey}
            rows={1}
          />
          <button
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: 'none',
              background: input.trim() ? GRAD : '#E5E5EA',
              color: input.trim() ? '#fff' : '#AEAEB2',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.2s',
              boxShadow: input.trim() ? '0 4px 14px rgba(141,198,63,0.4)' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <ManagerLayout title="Чат поддержки" noPadding>
      <div style={{
        display: 'flex',
        gap: 0,
        height: 'calc(100vh - 70px)',
        background: '#fff',
        borderRadius: isMobile ? 0 : 18,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {showListPane && renderChatList()}
        {showChatPane && (activeChatId !== null ? renderChatView() : renderNoChatSelected())}
      </div>
    </ManagerLayout>
  )
}
