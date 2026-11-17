import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { firebaseConfig } from '../firebase/firebaseConfig'

/**
 * Crea una cuenta de Firebase Authentication sin cerrar la sesión del administrador:
 * usa una app secundaria temporal. Devuelve el uid de la cuenta nueva.
 */
export async function createAuthAccount(email: string, password: string): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
  try {
    const auth = getAuth(secondary)
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    await signOut(auth)
    return user.uid
  } finally {
    await deleteApp(secondary)
  }
}
