import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../../firebase/firebaseConfig'
import { type AuthUser, type UserProfile, type UserSettings } from '../../models'
import { save } from '../../services/firestoreService'
import { ensureProfile } from '../../services/profile'
import { loginActions } from '../reducers/loginReducer'
import type { AppThunk } from '../store/store'

export const setuser = (user: AuthUser | null, profile: UserProfile | null = null) =>
  loginActions.setUser({ user, profile })

/** Adapter: convierte el usuario de Firebase en un objeto serializable para Redux. */
export const toAuthUser = (u: User): AuthUser => ({
  uid: u.uid,
  email: u.email,
  displayName: u.displayName,
  photoURL: u.photoURL,
})

export const friendlyAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  }
  return messages[code] ?? 'No pudimos completar la acción. Inténtalo de nuevo.'
}

/** Carga (o crea) el perfil de Firestore del usuario autenticado. Los usuarios nuevos nacen con rol "member". */
export const loadSession =
  (firebaseUser: User | null): AppThunk =>
  async (dispatch) => {
    if (!firebaseUser) {
      dispatch(setuser(null))
      return
    }
    const user = toAuthUser(firebaseUser)
    try {
      // Lee el perfil (o lo crea; el primer usuario queda como administrador). Ver services/profile.ts.
      const profile = await ensureProfile(user)
      dispatch(setuser(user, profile))
    } catch (error) {
      console.error(error)
      // El código de Firebase (p. ej. permission-denied) se muestra en pantalla para poder diagnosticar.
      const code = (error as { code?: string }).code ?? 'desconocido'
      dispatch(setuser(user, null))
      dispatch(loginActions.setError(`No se pudo cargar tu perfil (${code}).`))
    }
  }

/** Vuelve a intentar cargar el perfil de la sesión actual (botón «Reintentar»). */
export const reloadSession = (): AppThunk => async (dispatch) => {
  await dispatch(loadSession(auth.currentUser))
}

/** Los thunks de autenticación devuelven `null` si todo salió bien o un mensaje de error en español. */
export const startLogin =
  (email: string, password: string): AppThunk<Promise<string | null>> =>
  async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return null
    } catch (error) {
      return friendlyAuthError(error)
    }
  }

export const startGoogleLogin = (): AppThunk<Promise<string | null>> => async () => {
  try {
    await signInWithPopup(auth, googleProvider)
    return null
  } catch (error) {
    return friendlyAuthError(error)
  }
}

export const startPasswordReset =
  (email: string): AppThunk<Promise<string | null>> =>
  async () => {
    try {
      await sendPasswordResetEmail(auth, email)
      return null
    } catch (error) {
      return friendlyAuthError(error)
    }
  }

export const startLogout = (): AppThunk<Promise<void>> => async () => {
  await signOut(auth)
}

export const updateOwnProfile =
  (data: { displayName: string; position: string }): AppThunk<Promise<void>> =>
  async (dispatch) => {
    if (!auth.currentUser) return
    await updateProfile(auth.currentUser, { displayName: data.displayName })
    await save('users', auth.currentUser.uid, data)
    await dispatch(loadSession(auth.currentUser))
  }

export const saveSettings =
  (settings: UserSettings): AppThunk<Promise<void>> =>
  async (dispatch) => {
    if (!auth.currentUser) return
    await save('users', auth.currentUser.uid, { settings })
    await dispatch(loadSession(auth.currentUser))
  }
