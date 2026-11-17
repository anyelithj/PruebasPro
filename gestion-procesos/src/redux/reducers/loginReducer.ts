// Slice de SESIÓN: guarda quién está autenticado y su perfil (rol, permisos, configuración).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthUser, UserProfile } from '../../models'

// `interface`: forma del estado de sesión.
export interface LoginState {
  /** true hasta que Firebase responde por primera vez. */
  // Mientras es true, las rutas privadas muestran un Spinner en vez de redirigir al login por error.
  checking: boolean
  // Usuario de Firebase Authentication (o null si no hay sesión).
  user: AuthUser | null
  // Perfil guardado en Firestore (rol, activo, configuración…).
  profile: UserProfile | null
  // Mensaje de error de carga de perfil.
  error: string | null
}

// Estado inicial: se asume «verificando» hasta que Firebase conteste.
const initialState: LoginState = { checking: true, user: null, profile: null, error: null }

// Crea reducer + acciones de este trozo del estado.
export const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    // `_s`: estado anterior (no se usa). Se arma el nuevo estado: ya no está «verificando» y se limpian los errores.
    setUser: (_s, a: PayloadAction<{ user: AuthUser | null; profile: UserProfile | null }>) => ({
      checking: false,
      // `...a.payload`: copia `user` y `profile` que vienen en la acción.
      ...a.payload,
      error: null,
    }),
    // Conserva el estado y registra el error (también deja de «verificar»).
    setError: (s, a: PayloadAction<string>) => ({ ...s, checking: false, error: a.payload }),
  },
})

// Acciones listas para usar: `dispatch(loginActions.setUser({...}))`.
export const loginActions = loginSlice.actions
// Reducer para registrar en el store.
export const loginReducer = loginSlice.reducer
