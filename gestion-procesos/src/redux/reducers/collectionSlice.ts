// ═══════════════════════════════════════════════════════════════════════════════════════
// collectionSlice.ts — FÁBRICA de «slices» de Redux Toolkit.
// Patrón: FACTORY METHOD (una función que fabrica objetos parecidos). Procesos, tareas, usuarios, flujos…
// tienen exactamente el mismo comportamiento de estado, así que se escribe UNA vez (principio DRY).
// Arquitectura: capa de ESTADO. Flujo: Firestore → useDataSync → setItems → store → hooks → componentes (Flux).
// ═══════════════════════════════════════════════════════════════════════════════════════

// `createSlice`: función de Redux Toolkit que genera, a la vez, el REDUCER y las ACCIONES de una parte del estado.
// `type PayloadAction`: tipo de TypeScript para una acción que lleva datos (`payload`).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { CollectionState } from '../types/types'

/** Factory Method: crea el slice de una colección (mismo comportamiento para procesos, tareas, usuarios…). */
// `function`: declara una función. `<T extends { id: string }>`: genérico con RESTRICCIÓN: T puede ser cualquier tipo
// SIEMPRE que tenga un campo `id` de texto. `name`: prefijo único de las acciones (p. ej. «process/setItems»).
export function createCollectionSlice<T extends { id: string }>(name: string) {
  // Estado inicial: sin elementos, «cargando» y sin error. `: CollectionState<T>` obliga a respetar la forma definida.
  const initialState: CollectionState<T> = { items: [], loading: true, error: null }
  // `return`: devuelve el slice ya creado.
  return createSlice({
    // Nombre del slice (aparece en Redux DevTools).
    name,
    // Estado con el que arranca.
    initialState,
    // `reducers`: funciones PURAS (paradigma FUNCIONAL): reciben el estado y una acción y devuelven el nuevo estado,
    // sin modificar nada externo. Redux Toolkit además permite «mutar» con Immer, pero aquí devolvemos objetos nuevos (inmutabilidad).
    reducers: {
      // `_state`: el guion bajo indica «parámetro que no uso». Reemplaza la lista por la que llegó de Firestore.
      // `action.payload`: los datos que viajan en la acción.
      setItems: (_state, action: PayloadAction<T[]>) => ({ items: action.payload, loading: false, error: null }),
      // `...state` (spread): copia todos los campos del estado y luego sobrescribe `loading` y `error`.
      setError: (state, action: PayloadAction<string>) => ({ ...state, loading: false, error: action.payload }),
      // Vuelve al estado inicial (al cerrar sesión).
      reset: () => initialState,
    },
  })
}
