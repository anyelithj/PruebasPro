import { withProfileDefaults, type AuthUser, type UserProfile } from '../models'
import { claimFirstAdmin, patch, read, save } from './firestoreService'

/**
 * Devuelve el perfil de Firestore de la persona autenticada y lo crea si no existe.
 *  - El PRIMER usuario de toda la aplicación queda como administrador (así se ven todos los botones desde el inicio).
 *  - Los siguientes nacen como «miembro»; un administrador puede cambiarles el rol.
 * Si algo falla (reglas sin publicar, base sin crear…) el error se propaga para mostrarlo en pantalla.
 */
export async function ensureProfile(user: AuthUser): Promise<UserProfile> {
  const existing = await read<UserProfile>('users', user.uid)
  if (existing) {
    // En el registro el nombre llega a Authentication un instante después de crearse el perfil: se completa aquí.
    if (!existing.displayName && user.displayName) await patch('users', user.uid, { displayName: user.displayName })
    return withProfileDefaults({ ...existing, displayName: existing.displayName || user.displayName })
  }

  const member = withProfileDefaults({ ...user, role: 'member' })
  try {
    // ¿Alguien ya reclamó el rol de administrador?
    if (!(await read('_meta', 'admin'))) {
      const admin: UserProfile = { ...member, role: 'admin' }
      await claimFirstAdmin(admin)
      return admin
    }
  } catch (error) {
    // Si otra persona se registró al mismo tiempo, el intento falla: se continúa como miembro.
    console.warn('No se pudo reclamar el rol de administrador; se crea como miembro.', error)
  }

  // Otra llamada simultánea (p. ej. el registro) pudo haber creado ya el perfil.
  const again = await read<UserProfile>('users', user.uid)
  if (again) return withProfileDefaults(again)
  await save('users', user.uid, member)
  return member
}
