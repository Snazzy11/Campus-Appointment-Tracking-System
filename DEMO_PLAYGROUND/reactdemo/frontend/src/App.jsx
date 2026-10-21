import { useEffect, useState } from 'react'
import './App.css'
const API = '/api'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stream = new EventSource(`${API}/stream`)
    stream.onopen = () => { setConnected(true); setError('') }
    stream.onerror = () => setConnected(false)
    stream.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.id == null || typeof message.text !== 'string') return
        setMessages(previous => previous.some(item => item.id === message.id)
          ? previous : [...previous, message])
      } catch (err) {
        console.error('Invalid SSE message:', err)
      }
    }
    return () => stream.close()
  }, [])

  async function send(event) {
    event.preventDefault()
    if (!text.trim()) return
    try {
      const response = await fetch(`${API}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      setText('')
      setError('')
    } catch (err) { setError(err.message) }
  }

  return (
    <main className="chat">
      <h1>Campus Messaging</h1>
      <p role="status">{connected ? '● Connected' : '○ Connecting / disconnected'}</p>
      <section className="messages" aria-label="Messages">
        {messages.length === 0 && <p>No messages yet.</p>}
        {messages.map(message => <div key={message.id} className="message">
          <strong>{message.sender}</strong>: {message.text}
        </div>)}
      </section>
      <form onSubmit={send}>
        <input aria-label="Message" value={text} maxLength={4000}
          onChange={event => setText(event.target.value)} placeholder="Type a message" />
        <button type="submit" disabled={!text.trim()}>Send</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
