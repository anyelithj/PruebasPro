// Tipos compartidos por la capa de ESTADO (Redux). Solo contiene TypeScript: se borra al compilar (no existe en el navegador).

// `import type`: importa SOLO tipos (no código), así el archivo final no depende del módulo importado.
import type { UserProfile } from '../../models'

/** Estado común de las colecciones sincronizadas en tiempo real desde Firestore. */
// `export interface`: describe la FORMA de un objeto. TypeScript la usa para detectar errores mientras escribes.
export interface CollectionState<T> {
  // `<T>`: «genérico»: un tipo que se decide al usarlo (procesos, tareas, usuarios…) → reutilización sin copiar código (DRY).
  // `T[]`: arreglo de elementos de tipo T.
  items: T[]
  // `boolean`: verdadero/falso. Es true mientras llega la primera respuesta de Firestore (sirve para mostrar el Spinner).
  loading: boolean
  // `string | null`: tipo unión: texto con el mensaje de error, o null si no hay error.
  error: string | null
}

/** Usuario tal como se guarda en la colección `users` (el id del documento es el uid). */
// `export type`: crea un alias de tipo. `&` (intersección): combina UserProfile con `{ id: string }`.
export type UserRecord = UserProfile & { id: string }
