// useForm.ts — CUSTOM HOOK: estado de un formulario «controlado» (el valor de cada campo vive en React, no en el DOM).
// Usado por ProcessForm, TaskForm, UserForm y WorkflowForm.

// `type ChangeEvent`: tipo de TypeScript del evento «change» de React.
import { useCallback, useState, type ChangeEvent } from 'react'

/** Estado de formulario controlado, reutilizable para formularios sencillos. */
// `<T extends object>`: genérico: T es la forma de los valores del formulario (cada formulario pasa la suya).
// `initial: T`: valores iniciales (vacíos al crear, con datos al editar/ver).
export function useForm<T extends object>(initial: T) {
  // Estado con todos los valores del formulario.
  const [values, setValues] = useState<T>(initial)

  // Manejador genérico para <input>, <textarea> y <select>: usa el atributo `name` del campo para saber qué valor cambiar.
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    // Desestructuración de objeto: toma `name` y `value` del campo que cambió.
    const { name, value } = e.target
    // `(prev) => ({...})`: forma funcional de actualizar el estado a partir del anterior (evita valores obsoletos).
    // `[name]: value`: «clave calculada»: actualiza solo el campo cuyo nombre llegó.
    setValues((prev) => ({ ...prev, [name]: value }))
    // `[]`: sin dependencias → la función nunca cambia.
  }, [])

  // Asigna un campo por nombre cuando no viene de un evento (p. ej. un <select multiple> o un interruptor).
  // `<K extends keyof T>`: K debe ser el nombre de un campo existente; `T[K]` obliga a que el valor sea del tipo de ESE campo.
  const setField = useCallback(
    <K extends keyof T>(name: K, value: T[K]) => setValues((prev) => ({ ...prev, [name]: value })),
    [],
  )
  // Vuelve a los valores iniciales (por ejemplo, tras crear una tarea desde un proceso).
  const reset = useCallback(() => setValues(initial), [initial])

  return { values, handleChange, setField, setValues, reset }
}
