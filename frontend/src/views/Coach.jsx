import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { buildCoachContext } from '../lib/coach.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const STARTERS = [
  '¿Qué entrenamiento me toca hoy y qué debería priorizar?',
  'Analiza mis últimas semanas y dime dónde estoy estancado.',
  '¿Estoy haciendo suficiente volumen por grupo muscular?',
  'Revisa mi progresión y dime qué cambiarías.'
]

export default function Coach() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const context = useMemo(() => buildCoachContext(S), [S])

  const send = async preset => {
    const q = String(preset ?? text).trim()
    if (!q || busy || !user) return
    const prior = messages.slice(-8)
    const next = [...messages, { role: 'user', text: q }]
    setMessages(next)
    setText('')
    setBusy(true)
    try {
      const res = await api('/api/coach', {
        method: 'POST',
        body: JSON.stringify({ message: q, context, history: prior })
      })
      setMessages(m => [...m, { role: 'assistant', text: res.text, model: res.model }])
    } catch (e) {
      setMessages(m => [...m, { role: 'error', text: e.message || 'AI Coach error' }])
    } finally {
      setBusy(false)
    }
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>AI Coach</h1>
        <div className="sub">Tu historial de openGym como contexto</div>
      </div>
      <span style={{ width: 40 }} />
    </div>

    {!user ? <div className="card">
      <div className="row" style={{ gap: 10, marginBottom: 8 }}><Icon name="shield" /><b>Necesitas iniciar sesión</b></div>
      <div className="muted small">El entrenador usa el backend privado para que la clave de OpenAI nunca quede dentro del navegador o del iPhone.</div>
    </div> : <>
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div><div className="big" style={{ fontSize: 20 }}>Pregunta sobre tu entrenamiento</div>
            <div className="muted small">Recibe automáticamente tus rutinas, peso y los últimos 12 entrenamientos.</div></div>
        </div>
        {!messages.length && <div className="chips" style={{ marginTop: 12 }}>
          {STARTERS.map(q => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
        </div>}
      </div>

      {messages.map((m, i) => <div key={i} className="card" style={{
        marginLeft: m.role === 'user' ? 28 : 0,
        marginRight: m.role === 'assistant' ? 18 : 0,
        borderColor: m.role === 'error' ? 'var(--red)' : m.role === 'assistant' ? 'var(--acc)' : undefined
      }}>
        <div className="small" style={{ fontWeight: 600, marginBottom: 6, color: m.role === 'error' ? 'var(--red)' : 'var(--label-2)' }}>
          {m.role === 'assistant' ? 'AI Coach' : m.role === 'error' ? 'Error' : 'Tú'}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.text}</div>
        {m.model && <div className="dim small" style={{ marginTop: 8 }}>{m.model}</div>}
      </div>)}

      {busy && <div className="card"><div className="row" style={{ gap: 8 }}><Icon name="sparkles" /><span className="muted">Analizando tu historial…</span></div></div>}

      <div className="card" style={{ position: 'sticky', bottom: 86, zIndex: 2 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder="Ej.: ¿Subo peso en banca o mantengo una semana más?"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid var(--sep)', borderRadius: 12, padding: 12, background: 'var(--surface-2)', color: 'var(--label)', font: 'inherit', outline: 'none' }} />
        <div style={{ height: 8 }} />
        <Button variant="primary" icon="sparkles" disabled={!text.trim() || busy} onClick={() => send()}>Preguntar al coach</Button>
      </div>
    </>}
  </div>
}
