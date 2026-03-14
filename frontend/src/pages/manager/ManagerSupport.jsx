import { useState, useEffect, useRef } from 'react'
import ManagerLayout from '../../components/manager/ManagerLayout'
import { getSupportChats, getSupportMessages, sendSupportMessage, markChatRead } from '../../api'

const G = '#8DC63F'
const GD = '#6CA32F'
const TEXT = '#1C1C1E'
const TEXT2 = '#8E8E93'

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
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
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${G}, ${GD})`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

// ─── Chat sidebar item ────────────────────────────────────────────────────────
function ChatItem({ chat, active, onClick }) {
  return (
    <div style={{ ...s.chatItem, ...(active ? s.chatItemActive : {}) }} onClick={onClick}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={chat.user_name} size={44} />
        {chat.unread > 0 && <div style={s.unreadBadge}>{chat.unread}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.chatItemTop}>
          <span style={s.chatName}>{chat.user_name}</span>
          <span style={s.chatTime}>{formatRelTime(chat.last_time)}</span>
        </div>
        <div style={{ ...s.chatPreview, fontWeight: chat.unread > 0 ? 600 : 400 }}>
          {chat.last_message}
        </div>
        {chat.user_phone && (
          <div style={s.chatPhone}>{chat.user_phone}</div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManagerSupport() {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isMobile] = useState(window.innerWidth <= 768)
  const msgEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    getSupportChats()
      .then(c => { setChats(c); setLoading(false) })
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
    if (!text || !activeChatId) return
    setInput('')
    setSending(true)
    try {
      const msg = await sendSupportMessage(activeChatId, text)
      setMessages(prev => [...prev, msg])
      setChats(prev => prev.map(c =>
        c.id === activeChatId
          ? { ...c, last_message: text, last_time: new Date() }
          : c
      ))
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

  // Determine what to show on mobile
  const showChatPane = isMobile ? (showChat && activeChatId !== null) : true
  const showListPane = isMobile ? !showChat : true

  const chatPane = (
    <div style={{ ...s.chatPane, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      {activeChatId === null ? (
        <div style={s.noChatSelected}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, marginBottom: 12 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="#1C1C1E" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <div style={s.noChatTitle}>Выберите диалог</div>
          <div style={s.noChatDesc}>Нажмите на клиента слева, чтобы открыть чат</div>
        </div>
      ) : (
        <>
          {/* Chat header */}
          <div style={s.chatHeader}>
            {isMobile && (
              <button style={s.backBtn} onClick={closeChat}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke={TEXT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <Avatar name={activeChat?.user_name} size={38} />
            <div style={{ flex: 1 }}>
              <div style={s.chatHeaderName}>{activeChat?.user_name}</div>
              {activeChat?.user_phone && (
                <div style={s.chatHeaderPhone}>{activeChat.user_phone}</div>
              )}
            </div>
            {activeChat?.user_phone && (
              <a href={`tel:${activeChat.user_phone}`} style={s.callBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6.6 10.8C7.8 13.2 9.8 15.2 12.2 16.4L14 14.6C14.2 14.4 14.6 14.3 14.9 14.5C16 14.9 17.2 15.1 18.5 15.1C19 15.1 19.4 15.5 19.4 16V18.5C19.4 19 19 19.4 18.5 19.4C10.3 19.4 3.6 12.7 3.6 4.5C3.6 4 4 3.6 4.5 3.6H7C7.5 3.6 7.9 4 7.9 4.5C7.9 5.8 8.1 7 8.5 8.1C8.7 8.4 8.6 8.8 8.4 9L6.6 10.8Z" fill={G}/>
                </svg>
              </a>
            )}
          </div>

          {/* Messages */}
          <div style={s.messageList}>
            <div style={s.dateLabel}>Переписка</div>
            {messages.map(msg => (
              <div key={msg.id} style={{
                ...s.msgRow,
                justifyContent: msg.from === 'support' ? 'flex-end' : 'flex-start',
              }}>
                {msg.from !== 'support' && <Avatar name={activeChat?.user_name} size={28} />}
                <div style={{
                  ...s.bubble,
                  ...(msg.from === 'support' ? s.bubbleSupport : s.bubbleUser),
                }}>
                  <div style={{
                    fontSize: 14, lineHeight: 1.5,
                    color: msg.from === 'support' ? '#fff' : TEXT,
                    whiteSpace: 'pre-line',
                  }}>
                    {msg.text}
                  </div>
                  <div style={{
                    fontSize: 11, marginTop: 3,
                    color: msg.from === 'support' ? 'rgba(255,255,255,0.65)' : TEXT2,
                    textAlign: 'right',
                  }}>
                    {formatTime(msg.time)}
                  </div>
                </div>
                {msg.from === 'support' && (
                  <div style={s.managerAvatar}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" fill="rgba(255,255,255,0.9)"/>
                      <path d="M4 20c0-3 3.6-5 8-5s8 2 8 5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>

          {/* Quick replies */}
          <div style={s.quickWrap}>
            <div style={s.quickScroll}>
              {['Ваш заказ обрабатывается', 'Курьер уже в пути', 'Ожидайте звонка', 'Спасибо за обращение!'].map(q => (
                <button key={q} style={s.quickBtn} onClick={() => { setInput(q); inputRef.current?.focus() }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={s.inputBar}>
            <textarea
              ref={inputRef}
              style={s.textarea}
              placeholder="Написать клиенту..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button
              style={{ ...s.sendBtn, ...(input.trim() ? s.sendBtnActive : {}) }}
              onClick={handleSend}
              disabled={!input.trim() || sending}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <ManagerLayout title="Чат поддержки" noPadding>
      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 120px)', background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(60,60,67,0.12)' }}>

        {/* Chat list */}
        {showListPane && (
          <div style={{ ...s.chatList, width: isMobile ? '100%' : 300, borderRight: isMobile ? 'none' : '1px solid rgba(60,60,67,0.1)' }}>
            <div style={s.listHeader}>
              <div style={s.listTitle}>Диалоги</div>
              <div style={s.listBadge}>{chats.filter(c => c.unread > 0).length} новых</div>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Загрузка...</div>
            ) : chats.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Обращений пока нет</div>
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
        )}

        {/* Chat pane */}
        {showChatPane && chatPane}
      </div>
    </ManagerLayout>
  )
}

const s = {
  chatList: {
    display: 'flex', flexDirection: 'column',
    background: '#FAFAFA', flexShrink: 0, overflowY: 'auto',
  },
  listHeader: {
    padding: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid #e8f5e9', background: '#fff',
    position: 'sticky', top: 0, zIndex: 1,
  },
  listTitle: { fontWeight: 700, fontSize: 15, color: TEXT },
  listBadge: {
    fontSize: 11, fontWeight: 600, color: GD,
    background: 'rgba(141,198,63,0.12)', padding: '2px 8px', borderRadius: 8,
  },
  chatItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f7f0',
    transition: 'background 0.15s', background: '#FAFAFA',
    WebkitTapHighlightColor: 'transparent',
  },
  chatItemActive: { background: 'rgba(141,198,63,0.08)' },
  unreadBadge: {
    position: 'absolute', top: -2, right: -2,
    background: '#FF3B30', color: '#fff', borderRadius: 999,
    fontSize: 10, fontWeight: 800, minWidth: 18, height: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 3px', border: '1.5px solid #FAFAFA',
  },
  chatItemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  chatName: { fontWeight: 600, fontSize: 14, color: TEXT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chatTime: { fontSize: 11, color: TEXT2, flexShrink: 0 },
  chatPreview: { fontSize: 13, color: TEXT2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 },
  chatPhone: { fontSize: 11, color: '#aaa', marginTop: 1 },

  chatPane: {
    background: '#F5F5F7',
  },
  noChatSelected: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8,
  },
  noChatTitle: { fontSize: 16, fontWeight: 700, color: TEXT },
  noChatDesc: { fontSize: 13, color: TEXT2, textAlign: 'center' },

  chatHeader: {
    background: '#fff', padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    borderBottom: '1px solid #e8f5e9',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'rgba(118,118,128,0.1)', border: 'none', borderRadius: 8,
    width: 34, height: 34, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chatHeaderName: { fontWeight: 700, fontSize: 15, color: TEXT },
  chatHeaderPhone: { fontSize: 12, color: TEXT2 },
  callBtn: {
    width: 36, height: 36, borderRadius: 10,
    border: `1px solid ${G}`, background: 'rgba(141,198,63,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', flexShrink: 0,
  },

  messageList: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  dateLabel: {
    alignSelf: 'center', fontSize: 11, color: TEXT2,
    fontWeight: 600, background: 'rgba(0,0,0,0.06)',
    borderRadius: 999, padding: '3px 12px', marginBottom: 4,
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  bubble: {
    maxWidth: 'min(75%, 280px)', borderRadius: 16, padding: '10px 14px',
    display: 'flex', flexDirection: 'column', wordBreak: 'break-word',
  },
  bubbleUser: {
    background: '#fff', borderBottomLeftRadius: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  bubbleSupport: {
    background: `linear-gradient(135deg, ${G}, ${GD})`,
    borderBottomRightRadius: 4,
    boxShadow: `0 2px 8px rgba(141,198,63,0.3)`,
  },
  managerAvatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: `linear-gradient(135deg, ${G}, ${GD})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  quickWrap: {
    padding: '8px 16px', borderTop: '1px solid #e8f5e9', background: '#fff', flexShrink: 0,
  },
  quickScroll: {
    display: 'flex', gap: 6, overflowX: 'auto',
    scrollbarWidth: 'none', paddingBottom: 2,
  },
  quickBtn: {
    background: '#fff', border: '1.5px solid rgba(60,60,67,0.12)',
    borderRadius: 999, padding: '6px 12px', fontSize: 12,
    fontWeight: 600, color: GD, cursor: 'pointer', whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },

  inputBar: {
    display: 'flex', alignItems: 'flex-end', gap: 10,
    padding: '10px 16px 14px', background: '#fff',
    borderTop: '1px solid rgba(60,60,67,0.1)', flexShrink: 0,
  },
  textarea: {
    flex: 1, border: '1.5px solid rgba(60,60,67,0.12)',
    borderRadius: 20, padding: '10px 14px', fontSize: 14,
    background: '#F5F5F7', color: TEXT, outline: 'none',
    resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
    maxHeight: 100, overflowY: 'auto',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: '50%', border: 'none',
    background: '#E5E5EA', color: '#AEAEB2',
    cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.2s',
  },
  sendBtnActive: {
    background: `linear-gradient(135deg, ${G}, ${GD})`,
    color: '#fff', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(141,198,63,0.4)',
  },
}
