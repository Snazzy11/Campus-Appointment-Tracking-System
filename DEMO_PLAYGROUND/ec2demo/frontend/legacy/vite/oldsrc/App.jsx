
import { useEffect, useState } from 'react'
import './App.css'

const API = '/api'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Check Cognito authentication through FastAPI.
  useEffect(() => {
    let active = true

    fetch(`${API}/me`)
      .then(response => {
        if (response.status === 401) return null
        if (!response.ok) {
          throw new Error(
            `Authentication check failed: ${response.status}`
          )
        }
        return response.json()
      })
      .then(data => {
        if (active) setUser(data)
      })
      .catch(err => {
        if (active) {
          console.error('Authentication check failed:', err)
          setError(err.message)
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Load persisted history and receive live SSE messages.
  useEffect(() => {
    let active = true
    const stream = new EventSource(`${API}/stream`)

    const addMessage = message => {
      if (
        message.id == null ||
        typeof message.text !== 'string'
      ) return

      setMessages(previous =>
        previous.some(item => item.id === message.id)
          ? previous
          : [...previous, message]
      )
    }

    stream.onopen = () => {
      if (!active) return
      setConnected(true)
      setError('')
    }

    stream.onerror = () => {
      if (active) setConnected(false)
    }

    stream.onmessage = event => {
      try {
        addMessage(JSON.parse(event.data))
      } catch (err) {
        console.error('Invalid SSE message:', err)
      }
    }

    async function loadHistory() {
      try {
        const response = await fetch(`${API}/data`)

        if (!response.ok) {
          throw new Error(
            `Could not load message history: ${response.status}`
          )
        }

        const history = await response.json()

        if (!active) return

        setMessages(previous => {
          const byId = new Map()

          for (const message of history) {
            if (message.id != null) {
              byId.set(message.id, message)
            }
          }

          // Preserve any live messages received while
          // the history request was in progress.
          for (const message of previous) {
            if (message.id != null) {
              byId.set(message.id, message)
            }
          }

          return [...byId.values()].sort(
            (a, b) => a.id - b.id
          )
        })
      } catch (err) {
        if (active) {
          console.error('History load failed:', err)
          setError(err.message)
        }
      }
    }

    loadHistory()

    return () => {
      active = false
      stream.close()
    }
  }, [])

  async function send(event) {
    event.preventDefault()

    const messageText = text.trim()
    if (!messageText) return

    try {
      const response = await fetch(`${API}/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: messageText }),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }

      // SSE will add the new message to the display.
      setText('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="chat">
      {authLoading ? (
        <p>Checking authentication...</p>
      ) : user ? (
        <div>
          <p>Signed in as: {user.email}</p>
          <form action="/auth/logout" method="POST">
            <button type="submit">Logout</button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            window.location.assign('/auth/login')
          }
        >
          Login with AWS Cognito
        </button>
      )}

      <h1>Campus Messaging</h1>

      <p role="status">
        {connected
          ? '● Connected'
          : '○ Connecting / disconnected'}
      </p>

      <section className="messages" aria-label="Messages">
        {messages.length === 0 && <p>No messages yet.</p>}

        {messages.map(message => (
          <div key={message.id} className="message">
            <strong>{message.sender}</strong>: {message.text}
          </div>
        ))}
      </section>

      <form onSubmit={send}>
        <input
          aria-label="Message"
          value={text}
          maxLength={4000}
          onChange={event => setText(event.target.value)}
          placeholder="Type a message"
        />
        <button type="submit" disabled={!text.trim()}>
          Send
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
    </main>
  )
}
