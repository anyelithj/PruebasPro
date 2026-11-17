import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from '../../hooks/useTranslation'
import type { ChatMessage } from '../../models'
import type { Lang } from '../../services/translation'
import { formatTime } from '../helpers/ConvertirId'

interface Props {
  message: ChatMessage
  own: boolean
  target: Lang
}

export default function Mensaje({ message, own, target }: Props) {
  const { translate, loading, error } = useTranslation()
  const [translated, setTranslated] = useState<string | null>(null)

  return (
    <li className={`message${own ? ' message--own' : ''}`}>
      <div className="message__meta">
        <strong>{message.displayName}</strong> <time>{formatTime(message.createdAt)}</time>
      </div>
      <p className="message__text">{message.text}</p>
      {translated && (
        <p className="message__translation" lang={target}>
          {translated}
        </p>
      )}
      {error && (
        <p className="small text-danger mb-0" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="link"
        size="sm"
        className="p-0"
        disabled={loading}
        onClick={async () => setTranslated(translated ? null : await translate(message.text, target))}
      >
        {loading ? 'Traduciendo… (la primera vez descarga el modelo)' : translated ? 'Ocultar traducción' : 'Traducir'}
      </Button>
    </li>
  )
}
