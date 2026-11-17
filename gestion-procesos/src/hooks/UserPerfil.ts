import { ROLE_LABEL } from '../models'
import { useAuth } from './useAuth'

/** Datos de presentación del usuario actual. */
export function useUserPerfil() {
  const { user, profile } = useAuth()
  const name = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Usuario'
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return {
    uid: user?.uid ?? '',
    name,
    initials,
    email: user?.email ?? '',
    photoURL: user?.photoURL ?? null,
    roleLabel: profile ? ROLE_LABEL[profile.role] : 'Sin rol',
  }
}
