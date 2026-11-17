// ═══════════════════════════════════════════════════════════════════════════════════════
// useFormSubmit.ts — CUSTOM HOOK (patrón «Hooks» de React): lógica reutilizable de «guardar con manejo de errores».
// Lo usan los cuatro formularios (procesos, tareas, usuarios, workflows) → no se repite el try/catch (DRY).
// ═══════════════════════════════════════════════════════════════════════════════════════

// `useState`: guarda un valor que, al cambiar, vuelve a dibujar el componente. `useCallback`: memoriza una función para que
// no se cree una nueva en cada dibujado (rendimiento y estabilidad en dependencias de efectos).
import { useCallback, useState } from 'react'

/** Estado de envío compartido por todos los formularios: guardando, error y ejecución segura de la acción. */
// Un hook es una función cuyo nombre empieza con `use`. Parámetro con valor por defecto: el mensaje si el error no trae texto.
export function useFormSubmit(fallbackMessage = 'No se pudo guardar. Revisa tu conexión o tus permisos.') {
  // `const [valor, setValor] = useState(inicial)`: desestructuración de un arreglo. `<string | null>` fija el tipo del estado.
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // `run` recibe la acción a ejecutar (puede ser síncrona o asíncrona) y devuelve true si salió bien.
  const run = useCallback(
    // `async`: la función devuelve una Promesa. `Promise<boolean>`: se resolverá con true/false.
    async (action: () => Promise<unknown> | unknown): Promise<boolean> => {
      // Marca «guardando» (deshabilita el botón) y limpia el error anterior.
      setSaving(true)
      setError(null)
      // `try { ... } catch { ... } finally { ... }`: manejo de errores en tres tiempos.
      try {
        // `await`: espera a que termine la acción (por ejemplo, guardar en Firestore).
        await action()
        // Si no lanzó error, éxito.
        return true
      } catch (err) {
        // `instanceof`: ¿es un objeto Error? Si sí y trae mensaje lo muestra; si no, usa el mensaje por defecto.
        setError(err instanceof Error && err.message ? err.message : fallbackMessage)
        return false
      } finally {
        // `finally` se ejecuta SIEMPRE (con o sin error): deja de «guardar».
        setSaving(false)
      }
    },
    // Dependencias de useCallback: se recrea solo si cambia el mensaje por defecto.
    [fallbackMessage],
  )

  // Devuelve un objeto: quien use el hook elige lo que necesita (`const { saving, run } = useFormSubmit()`).
  return { saving, error, setError, run }
}
