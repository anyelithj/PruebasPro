import { Alert } from 'react-bootstrap'
import { shallowEqual } from 'react-redux'
import { useAppSelector } from '../../hooks/useRedux'

// Cada slice de Redux con su nombre legible. Si Firestore rechaza una lectura, el error queda en `slice.error`.
const SLICES = [
  ['process', 'procesos'],
  ['task', 'tareas'],
  ['user', 'usuarios'],
  ['workflow', 'workflows'],
  ['automation', 'automatizaciones'],
  ['notification', 'notificaciones'],
  ['file', 'archivos'],
] as const

/** Aviso visible cuando alguna colección no se puede leer (en vez de mostrar listas vacías sin explicación). */
export default function DataErrorBanner() {
  // `shallowEqual`: evita redibujar si el arreglo de errores no cambió.
  const errors = useAppSelector((s) => SLICES.map(([key]) => s[key].error), shallowEqual)
  const failed = SLICES.filter((_, i) => errors[i])
  if (failed.length === 0) return null
  return (
    <Alert variant="danger" role="alert">
      <Alert.Heading as="h2" className="h6">
        No se pueden leer algunos datos
      </Alert.Heading>
      <p className="mb-1">
        Fallaron: <strong>{failed.map(([, label]) => label).join(', ')}</strong>. Mensaje de Firebase:{' '}
        <em>{errors.find(Boolean)}</em>
      </p>
      <p className="mb-0">
        Por eso verías listas vacías. Revisa que la base de datos Firestore exista y que las reglas de{' '}
        <code>firestore.rules</code> estén publicadas (<code>pnpm db:deploy --project ID-DE-TU-PROYECTO</code>).
      </p>
    </Alert>
  )
}
