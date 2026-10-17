import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const API = '/api'

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.detail || `Request failed (${response.status})`)
  }
  return data
}

function mergeMessages(previous, incoming) {
  const byId = new Map(previous.map(message => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

function otherParticipant(conversation, email) {
  return conversation.members?.find(member => member.email !== email)
    || conversation.members?.[0]
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [error, setError] = useState('')
  const [publicMessages, setPublicMessages] = useState([])
  const [publicConnected, setPublicConnected] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null) // null means public chat
  const [privateMessages, setPrivateMessages] = useState([])
  const [privateConnected, setPrivateConnected] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [text, setText] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  const activeIdRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const loadConversations = useCallback(async () => {
    const result = await jsonRequest(`${API}/conversations`)
    setConversations(result)
    return result
  }, [])

  const loadPrivateHistory = useCallback(async (id) => {
    const history = await jsonRequest(`${API}/conversations/${id}/messages`)
    if (activeIdRef.current === id) {
      setPrivateMessages(previous => mergeMessages(history, previous))
    }
  }, [])

  useEffect(() => {
    let active = true
    jsonRequest(`${API}/me`)
      .then(data => { if (active) setUser(data) })
      .catch(err => {
        if (!active) return
        if (err.message.includes('401') || err.message === 'Not authenticated') {
          setUser(null)
        } else {
          setError(`Authentication: ${err.message}`)
        }
      })
      .finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const refreshPublic = async () => {
      try {
        const history = await jsonRequest(`${API}/data`)
        if (active) setPublicMessages(previous => mergeMessages(history, previous))
      } catch (err) {
        if (active) setError(`Public chat: ${err.message}`)
      }
    }
    const stream = new EventSource(`${API}/stream`)
    stream.onopen = () => {
      if (!active) return
      setPublicConnected(true)
      refreshPublic() // recover messages missed while disconnected
    }
    stream.onerror = () => { if (active) setPublicConnected(false) }
    stream.onmessage = event => {
      try {
        const message = JSON.parse(event.data)
        if (active && message.id != null) {
          setPublicMessages(previous => mergeMessages(previous, [message]))
        }
      } catch (err) { console.error('Invalid public SSE event', err) }
    }
    refreshPublic()
    return () => { active = false; stream.close() }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    loadConversations().catch(err => {
      if (active) setError(`Conversations: ${err.message}`)
    })
    const stream = new EventSource(`${API}/private/stream`)
    stream.onopen = () => {
      if (!active) return
      setPrivateConnected(true)
      loadConversations().catch(console.error)
      const id = activeIdRef.current
      if (id !== null) loadPrivateHistory(id).catch(console.error)
    }
    stream.onerror = () => { if (active) setPrivateConnected(false) }
    stream.addEventListener('private_message', event => {
      try {
        const message = JSON.parse(event.data)
        if (!active) return
        if (message.conversation_id === activeIdRef.current) {
          setPrivateMessages(previous => mergeMessages(previous, [message]))
        }
        loadConversations().catch(console.error)
      } catch (err) { console.error('Invalid private SSE event', err) }
    })
    return () => { active = false; stream.close() }
  }, [user?.sub, loadConversations, loadPrivateHistory])

  useEffect(() => {
    if (activeId === null || !user) return
    let active = true
    setLoadingMessages(true)
    setPrivateMessages([])
    loadPrivateHistory(activeId)
      .catch(err => { if (active) setError(`Private chat: ${err.message}`) })
      .finally(() => { if (active) setLoadingMessages(false) })
    return () => { active = false }
  }, [activeId, user?.sub, loadPrivateHistory])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [publicMessages, privateMessages, activeId])

  async function startConversation(event) {
    event.preventDefault()
    const id = Number(recipientId)
    if (!Number.isSafeInteger(id) || id < 1) {
      setError('Enter a valid numeric recipient user ID.')
      return
    }
    setCreating(true)
    setError('')
    try {
      const conversation = await jsonRequest(`${API}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: id }),
      })
      await loadConversations()
      setActiveId(conversation.id)
      setText('')
      setRecipientId('')
    } catch (err) { setError(err.message) }
    finally { setCreating(false) }
  }

  async function send(event) {
    event.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    if (activeId !== null && !user) {
      setError('Please sign in to send a private message.')
      return
    }
    const targetId = activeId
    setSending(true)
    setError('')
    try {
      const saved = await jsonRequest(
        targetId === null ? `${API}/data` : `${API}/conversations/${targetId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value }),
        },
      )
      if (targetId === null) {
        setPublicMessages(previous => mergeMessages(previous, [saved]))
      } else if (activeIdRef.current === targetId) {
        setPrivateMessages(previous => mergeMessages(previous, [saved]))
      }
      setText(previous => previous === value ? '' : previous)
    } catch (err) { setError(err.message) }
    finally { setSending(false) }
  }

  const selected = conversations.find(conversation => conversation.id === activeId)
  const peer = selected && otherParticipant(selected, user?.email)
  const displayedMessages = activeId === null ? publicMessages : privateMessages
  const isConnected = activeId === null ? publicConnected : privateConnected

  return (
    <div className="campus-app">
      <header className="campus-header">
        <div>
          <div className="brand-eyebrow">CAMPUS COMMUNICATION</div>
          <h1>Campus Messaging</h1>
        </div>
        <div className="account">
          {authLoading ? <span>Checking authentication…</span> : user ? (
            <>
              <span className="account-email" title={user.email}>{user.email}</span>
              <form action="/auth/logout" method="POST"><button type="submit" className="secondary-button">Logout</button></form>
            </>
          ) : (
            <button type="button" onClick={() => window.location.assign('/auth/login')}>Login with Cognito</button>
          )}
        </div>
      </header>

      <div className="campus-layout">
        <aside className="sidebar" aria-label="Conversations">
          <h2>Chats</h2>
          <button className={`chat-choice ${activeId === null ? 'selected' : ''}`} onClick={() => { setActiveId(null); setText(''); setError('') }}>
            <span className="avatar">#</span><span><strong>Public chat</strong><small>Everyone on campus</small></span>
          </button>
          <div className="section-heading"><span>Direct messages</span><span>{conversations.length}</span></div>
          {!user && <p className="sidebar-note">Sign in to view or start direct messages.</p>}
          {user && conversations.length === 0 && <p className="sidebar-note">No direct messages yet.</p>}
          {user && conversations.map(conversation => {
            const participant = otherParticipant(conversation, user.email)
            return (
              <button key={conversation.id} className={`chat-choice ${activeId === conversation.id ? 'selected' : ''}`}
                onClick={() => { setActiveId(conversation.id); setText(''); setError('') }}>
                <span className="avatar">{(participant?.email || '?').charAt(0).toUpperCase()}</span>
                <span className="choice-copy"><strong>{participant?.email || `Conversation ${conversation.id}`}</strong><small>Direct message</small></span>
              </button>
            )
          })}
          {user && <form className="new-conversation" onSubmit={startConversation}>
            <label htmlFor="recipient-id">Start a direct message</label>
            <input id="recipient-id" type="number" min="1" step="1" placeholder="Recipient user ID" value={recipientId}
              onChange={event => setRecipientId(event.target.value)} required />
            <button type="submit" disabled={creating}>{creating ? 'Opening…' : 'New conversation'}</button>
            <small>For now, use the recipient's database user ID.</small>
          </form>}
        </aside>

        <main className="chat-panel">
          <div className="chat-topbar">
            <div><h2>{activeId === null ? 'Public chat' : (peer?.email || `Conversation ${activeId}`)}</h2>
              <p>{activeId === null ? 'Messages visible to everyone' : 'Private conversation'}</p></div>
            <span className={`connection ${isConnected ? 'online' : ''}`} role="status">
              <span className="status-dot" />{isConnected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
          <div className="chat-messages" role="log" aria-label="Message history">
            {loadingMessages && activeId !== null && <p className="empty-state">Loading messages…</p>}
            {!loadingMessages && displayedMessages.length === 0 && <p className="empty-state">No messages yet. Say hello!</p>}
            {displayedMessages.map(message => {
              const mine = Boolean(user && message.sender === user.email)
              return (
                <div key={message.id} className={`message-row ${mine ? 'mine' : ''}`}>
                  <div className="message-bubble">
                    <div className="message-meta"><strong>{mine ? 'You' : message.sender}</strong>
                      <time>{message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</time></div>
                    <div className="message-text">{message.text}</div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          {error && <div className="error-banner" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
          <form className="composer" onSubmit={send}>
            <input aria-label="Message" value={text} maxLength={activeId === null ? 4000 : 5000}
              onChange={event => setText(event.target.value)} placeholder={activeId !== null && !user ? 'Sign in to send messages' : 'Write a message…'}
              disabled={sending || (activeId !== null && !user)} />
            <button type="submit" disabled={sending || !text.trim() || (activeId !== null && !user)}>{sending ? 'Sending…' : 'Send'}</button>
          </form>
        </main>
      </div>
    </div>
  )
}
