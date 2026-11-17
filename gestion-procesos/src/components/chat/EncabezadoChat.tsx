import { Form } from 'react-bootstrap'
import { LANG_LABEL, type Lang } from '../../services/translation'

interface Props {
  name: string
  target: Lang
  onTargetChange: (lang: Lang) => void
}

export default function EncabezadoChat({ name, target, onTargetChange }: Props) {
  return (
    <header className="chat__header">
      <h2 className="h5 mb-0"># {name}</h2>
      <div className="chat__lang">
        <Form.Label htmlFor="idioma-destino" className="mb-0 small">
          Traducir a
        </Form.Label>
        <Form.Select
          id="idioma-destino"
          size="sm"
          value={target}
          onChange={(e) => onTargetChange(e.target.value as Lang)}
        >
          {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
            <option key={l} value={l}>
              {LANG_LABEL[l]}
            </option>
          ))}
        </Form.Select>
      </div>
    </header>
  )
}
