// ═══════════════════════════════════════════════════════════════════════════════════════
// FormShell.tsx — «cascarón» común de TODOS los formularios (procesos, tareas, usuarios, workflows).
// Es la pieza que hace posible reutilizar el MISMO formulario para CREAR, EDITAR y VER EL DETALLE:
//   create → campos vacíos + botón «Crear»
//   edit   → datos existentes + botón «Guardar cambios»
//   view   → los mismos campos, bloqueados y sin botón (pantalla de detalle)
// Patrones: COMPOSITION (recibe los campos como `children`), CONTAINER/PRESENTATIONAL (este componente solo presenta;
// el estado y la lógica viven en cada formulario y en useFormSubmit).
// ═══════════════════════════════════════════════════════════════════════════════════════

// Tipos de TypeScript: evento de formulario y «cualquier cosa dibujable por React».
import type { FormEvent, ReactNode } from 'react'
// Componentes de Bootstrap para React (estilos accesibles ya hechos).
import { Alert, Button, Form } from 'react-bootstrap'

/** create: formulario vacío · edit: datos existentes editables · view: los mismos campos, solo lectura. */
// Tipo unión de textos literales: solo estos tres valores son válidos.
export type FormMode = 'create' | 'edit' | 'view'

// Texto por defecto del botón según el modo. `Record<FormMode, string>`: obliga a definir los tres modos.
const DEFAULT_SUBMIT: Record<FormMode, string> = { create: 'Crear', edit: 'Guardar cambios', view: '' }

// Propiedades (props) que recibe el componente. `?` = opcional.
interface Props {
  mode: FormMode
  /** Nombre accesible del formulario. */
  label: string
  error?: string | null
  saving?: boolean
  submitLabel?: string
  className?: string
  // `() => unknown`: función sin parámetros que devuelve cualquier cosa (puede ser asíncrona).
  onSubmit?: () => unknown
  // Los campos del formulario se pasan «dentro» de las etiquetas: <FormShell>...campos...</FormShell>.
  children: ReactNode
}

/**
 * Envoltorio común de los formularios de procesos, tareas, usuarios y workflows.
 * En modo «view» bloquea los campos con un <fieldset disabled> y oculta el botón, de modo que
 * crear, editar y ver el detalle usan exactamente los mismos campos.
 */
// Desestructura las props; `saving = false` y `className = ''` son valores por defecto.
export default function FormShell({
  mode,
  label,
  error,
  saving = false,
  submitLabel,
  className = '',
  onSubmit,
  children,
}: Props) {
  // ¿Solo lectura? `===` compara valor y tipo.
  const readOnly = mode === 'view'
  // Manejador del envío del formulario.
  const submit = (e: FormEvent) => {
    // Evita que el navegador recargue la página (comportamiento por defecto de un <form>).
    e.preventDefault()
    // `onSubmit?.()`: llama a la función solo si existe. En modo vista no se envía nada.
    if (!readOnly) onSubmit?.()
  }
  return (
    <Form
      onSubmit={submit}
      // `noValidate`: desactiva la validación del navegador; la validación la hacemos nosotros con mensajes en español.
      noValidate
      // `aria-label`: nombre del formulario para lectores de pantalla (accesibilidad).
      aria-label={label}
      // Plantilla de texto: arma las clases BEM `entity-form entity-form--view` y quita espacios sobrantes con `.trim()`.
      className={`entity-form entity-form--${mode} ${className}`.trim()}
    >
      {/* `&&`: renderizado condicional: solo dibuja la alerta si hay un error. */}
      {error && (
        // `role="alert"`: se anuncia automáticamente a quien usa lector de pantalla.
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {/* `<fieldset disabled>` bloquea TODOS los campos de adentro de una sola vez: así «ver detalle» no necesita otro formulario. */}
      <fieldset disabled={readOnly} className="entity-form__fields">
        {children}
      </fieldset>
      {/* En modo vista no hay botón. */}
      {!readOnly && (
        // `disabled={saving}`: evita doble clic mientras se guarda.
        <Button type="submit" className="mt-3" disabled={saving}>
          {/* `??`: si no se pasó `submitLabel`, usa el texto por defecto del modo. */}
          {saving ? 'Guardando…' : (submitLabel ?? DEFAULT_SUBMIT[mode])}
        </Button>
      )}
    </Form>
  )
}
