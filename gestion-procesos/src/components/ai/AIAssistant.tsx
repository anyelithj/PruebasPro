import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Form, Tab, Tabs } from 'react-bootstrap'
import { FiCpu } from 'react-icons/fi'
import { useAI } from '../../hooks/useAI'
import { useAuth } from '../../hooks/useAuth'
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux'
import { PRIORITY_LABEL, PRIORITY_VARIANT, type Process } from '../../models'
import { applyAnalysis, classifyPending } from '../../redux/actions/actionProcess'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import { showError } from '../helpers/confirm'
import AskAssistant from './AskAssistant'

interface Props {
  /** Texto a analizar. Con `text` el componente va embebido; sin él es la página completa. */
  text?: string
  /** Si se indica, permite aplicar el resultado al proceso. */
  process?: Process
}

function Analyzer({ text, process }: Props) {
  const standalone = text === undefined
  const [input, setInput] = useState(text ?? '')
  const { result, analyze, reset } = useAI()
  const { can } = useAuth()
  const dispatch = useAppDispatch()
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    if (text !== undefined) {
      setInput(text)
      reset()
      setApplied(false)
    }
  }, [text, reset])

  return (
    <>
      {standalone && (
        <>
          <Form.Label htmlFor="ia-texto">Texto a analizar</Form.Label>
          <Form.Control
            id="ia-texto"
            as="textarea"
            rows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pega una solicitud, un correo o la descripción de un proceso."
          />
        </>
      )}
      <Button
        className={standalone ? 'mt-3' : ''}
        variant="outline-primary"
        onClick={() => {
          analyze(input)
          setApplied(false)
        }}
        disabled={!input.trim()}
      >
        <FiCpu aria-hidden="true" /> Clasificar y resumir
      </Button>
      <div aria-live="polite">
        {result && (
          <Alert variant="light" className="mt-3 border">
            <p className="mb-2">
              <strong>Categoría:</strong> <Badge bg="primary">{result.category}</Badge>{' '}
              <strong className="ms-2">Prioridad:</strong>{' '}
              <Badge bg={PRIORITY_VARIANT[result.priority]} text={result.priority === 'high' ? 'dark' : undefined}>
                {PRIORITY_LABEL[result.priority]}
              </Badge>
            </p>
            <p className="mb-2">
              <strong>Resumen:</strong> {result.summary}
            </p>
            <p className="mb-1">
              <strong>Próximos pasos sugeridos:</strong>
            </p>
            <ul className="mb-2">
              {result.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {process && can('process:edit') && (
              <Button
                size="sm"
                disabled={applied}
                onClick={() =>
                  dispatch(applyAnalysis(process, result))
                    .then(() => setApplied(true))
                    .catch(showError)
                }
              >
                {applied ? 'Aplicado al proceso' : 'Aplicar categoría, prioridad y resumen al proceso'}
              </Button>
            )}
          </Alert>
        )}
      </div>
    </>
  )
}

function ClassifyPending() {
  const dispatch = useAppDispatch()
  const pending = useAppSelector(
    (s) => s.process.items.filter((p) => !p.category || (!p.aiSummary && p.description.trim())).length,
  )
  const [done, setDone] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <p>
        Hay <strong>{pending}</strong> proceso(s) o solicitud(es) sin categoría o sin resumen.
      </p>
      <Button
        disabled={busy || pending === 0}
        onClick={async () => {
          setBusy(true)
          try {
            setDone(await dispatch(classifyPending()))
          } catch (e) {
            showError(e)
          }
          setBusy(false)
        }}
      >
        {busy ? 'Clasificando…' : 'Clasificar y resumir pendientes'}
      </Button>
      <div aria-live="polite">
        {done !== null && (
          <Alert variant="success" className="mt-3">
            Se actualizaron {done} proceso(s).
          </Alert>
        )}
      </div>
    </div>
  )
}

export default function AIAssistant({ text, process }: Props) {
  if (text !== undefined) return <Analyzer text={text} process={process} />
  return (
    <>
      <Seo title="Asistente IA" noIndex />
      <PageHeader title="Asistente IA" subtitle="Funciona en tu navegador, sin costo ni claves." />
      <Tabs defaultActiveKey="preguntar" id="ia-tabs" className="mb-3" mountOnEnter>
        <Tab eventKey="preguntar" title="Preguntar">
          <AskAssistant />
        </Tab>
        <Tab eventKey="analizar" title="Analizar texto">
          <Analyzer />
        </Tab>
        <Tab eventKey="pendientes" title="Clasificar pendientes">
          <ClassifyPending />
        </Tab>
      </Tabs>
    </>
  )
}
