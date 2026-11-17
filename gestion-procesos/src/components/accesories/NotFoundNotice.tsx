import { Alert } from 'react-bootstrap'
import { Link } from 'react-router-dom'

/** Aviso común cuando un proceso, tarea, usuario o flujo no existe. */
export default function NotFoundNotice({
  what,
  to,
  label = 'Volver a la lista',
}: {
  what: string
  to: string
  label?: string
}) {
  return (
    <Alert variant="warning" role="alert">
      No encontramos {what}. <Link to={to}>{label}</Link>
    </Alert>
  )
}
