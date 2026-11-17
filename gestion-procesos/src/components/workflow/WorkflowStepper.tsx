import { Button } from 'react-bootstrap'
import type { Workflow } from '../../models'
import { nextStates } from '../../services/workflow'

interface Props {
  workflow: Workflow
  current: string
  canEdit: boolean
  onMove: (status: string) => void
}

export default function WorkflowStepper({ workflow, current, canEdit, onMove }: Props) {
  const index = workflow.states.indexOf(current)
  const allowed = nextStates(workflow, current)
  return (
    <>
      <ol className="stepper" aria-label="Estados del flujo">
        {workflow.states.map((s, i) => (
          <li
            key={s}
            className={`stepper__step${i < index ? ' is-done' : i === index ? ' is-current' : ''}`}
            aria-current={i === index ? 'step' : undefined}
          >
            {s}
          </li>
        ))}
      </ol>
      {canEdit && allowed.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-3">
          {allowed.map((s) => (
            <Button
              key={s}
              variant={workflow.states.indexOf(s) > index ? 'primary' : 'outline-secondary'}
              size="sm"
              onClick={() => onMove(s)}
            >
              {workflow.states.indexOf(s) > index ? `Avanzar a ${s}` : `Volver a ${s}`}
            </Button>
          ))}
        </div>
      )}
    </>
  )
}
