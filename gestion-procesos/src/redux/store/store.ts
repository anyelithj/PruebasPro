// ═══════════════════════════════════════════════════════════════════════════════════════
// store.ts — el STORE: único almacén del estado global (patrón Flux: flujo de datos unidireccional).
//   Componente → dispatch(acción) → reducer → nuevo estado en el store → los componentes suscritos se redibujan.
// ═══════════════════════════════════════════════════════════════════════════════════════

// `configureStore`: crea el store con buenas prácticas (thunk y DevTools incluidos). `ThunkAction`: tipo de las acciones asíncronas.
// `UnknownAction`: tipo base de una acción de Redux.
import { configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit'
// Cada reducer administra una «rebanada» (slice) del estado.
import { automationReducer } from '../reducers/automationReducers'
import { fileReducer } from '../reducers/fileReducers'
import { loginReducer } from '../reducers/loginReducer'
import { notificationReducer } from '../reducers/notificationReducers'
import { processReducer } from '../reducers/processReducers'
import { registerReducer } from '../reducers/registerReducer'
import { taskReducer } from '../reducers/taskReducers'
import { userReducer } from '../reducers/userReducers'
import { workflowReducer } from '../reducers/workflowReducers'

// `export const store`: el store único de la aplicación.
export const store = configureStore({
  // `reducer`: objeto que une los slices. La clave (login, process…) es el nombre con el que se lee: `state.process`.
  reducer: {
    login: loginReducer, // sesión y perfil
    register: registerReducer, // estado del formulario de registro
    process: processReducer, // procesos y solicitudes
    task: taskReducer, // tareas
    user: userReducer, // usuarios
    workflow: workflowReducer, // flujos de trabajo personalizados
    automation: automationReducer, // reglas de automatización
    notification: notificationReducer, // notificaciones
    file: fileReducer, // metadatos de archivos adjuntos
  },
})

// `ReturnType<typeof ...>`: TypeScript deduce el tipo del estado completo a partir del propio store (no se escribe a mano).
export type RootState = ReturnType<typeof store.getState>
// Tipo de `dispatch` (incluye soporte para thunks).
export type AppDispatch = typeof store.dispatch
// Tipo de una acción asíncrona (thunk): `R` es lo que devuelve (por defecto nada); `= void` es un valor por defecto del genérico.
export type AppThunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>
