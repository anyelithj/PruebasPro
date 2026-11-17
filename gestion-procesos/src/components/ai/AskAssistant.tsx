import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProcesses } from '../../hooks/useProcesses'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { useWorkflow } from '../../hooks/useWorkflow'
import { ask, SUGGESTED_QUESTIONS, type Answer } from '../../services/assistant'

/** Asistente conversacional local: responde con los datos reales de procesos y tareas. */
export default function AskAssistant() {
  const { processes } = useProcesses()
  const { tasks } = useTasks()
  const { users } = useUsers()
  const { workflows } = useWorkflow()
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState<{ q: string; a: Answer }[]>([])

  const send = (q: string) => {
    if (!q.trim()) return
    setThread((t) => [...t, { q, a: ask(q, { processes, tasks, users, workflows, uid: user?.uid ?? '' }) }])
    setQuestion('')
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(question)
  }

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Preguntas sugeridas">
        {SUGGESTED_QUESTIONS.map((q) => (
          <Button key={q} size="sm" variant="outline-primary" onClick={() => send(q)}>
            {q}
          </Button>
        ))}
      </div>
      <div className="assistant" role="log" aria-live="polite">
        {thread.length === 0 && (
          <p className="text-secondary">Pregúntame por lo vencido, tus tareas, lo urgente o un resumen.</p>
        )}
        {thread.map((m, i) => (
          <div key={i} className="mb-3">
            <p className="assistant__question mb-1">{m.q}</p>
            <p className="assistant__answer mb-1">{m.a.text}</p>
            {m.a.links.map((l) => (
              <Link key={l.to} to={l.to} className="me-3 small">
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <Form onSubmit={submit} className="d-flex gap-2">
        <Form.Label htmlFor="ask-q" className="visually-hidden">
          Tu pregunta
        </Form.Label>
        <Form.Control
          id="ask-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Escribe tu pregunta"
          autoComplete="off"
        />
        <Button type="submit" disabled={!question.trim()}>
          Preguntar
        </Button>
      </Form>
    </div>
  )
}
