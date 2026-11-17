import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import { useAppSelector } from '../../hooks/useRedux'
import type { Channel, ChatMessage } from '../../models'
import type { Lang } from '../../services/translation'
import EncabezadoChat from './EncabezadoChat'
import Mensaje from './Mensaje'

interface Props {
  channel: Channel
  messages: ChatMessage[]
  uid: string
  canWrite: boolean
  onSend: (text: string) => Promise<void>
}

export default function ChatScreen({ channel, messages, uid, canWrite, onSend }: Props) {
  const [text, setText] = useState('')
  const preferred = useAppSelector((s) => s.login.profile?.settings.chatLang) ?? 'es' // configurado en «Mi perfil»
  const [target, setTarget] = useState<Lang>(preferred)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = text
    setText('')
    await onSend(value)
  }

  return (
    <section className="chat__screen" aria-label={`Conversación del canal ${channel.name}`}>
      <EncabezadoChat name={channel.name} target={target} onTargetChange={setTarget} />
      <div className="chat__messages" role="log" aria-live="polite">
        {messages.length === 0 && <p className="text-secondary">Aún no hay mensajes. Escribe el primero.</p>}
        <ul className="list-unstyled mb-0">
          {messages.map((m) => (
            <Mensaje key={m.id} message={m} own={m.uid === uid} target={target} />
          ))}
        </ul>
        <div ref={endRef} />
      </div>
      {canWrite ? (
        <Form onSubmit={submit} className="chat__form">
          <Form.Label htmlFor="chat-texto" className="visually-hidden">
            Mensaje
          </Form.Label>
          <Form.Control
            id="chat-texto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un mensaje"
            autoComplete="off"
          />
          <Button type="submit" disabled={!text.trim()}>
            Enviar
          </Button>
        </Form>
      ) : (
        <p className="small text-secondary p-3 mb-0">Tu rol permite leer, pero no escribir en el chat.</p>
      )}
    </section>
  )
}
