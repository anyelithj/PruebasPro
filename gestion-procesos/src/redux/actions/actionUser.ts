import type { Role, UserProfile } from '../../models'
import { DEFAULT_SETTINGS } from '../../models'
import { createAuthAccount } from '../../services/authAdmin'
import { remove, save } from '../../services/firestoreService'
import { diffFields, logHistory } from '../../services/history'
import type { AppThunk } from '../store/store'
import { formatChange, getActor } from './actionHelpers'
import { setUsers, userError } from '../reducers/userReducers'

export { setUsers, userError }

export interface NewUserInput {
  displayName: string
  email: string
  password: string
  role: Role
  position: string
}
export type EditUserInput = Pick<UserProfile, 'displayName' | 'role' | 'position' | 'active'>

const LABELS: Partial<Record<keyof EditUserInput, string>> = {
  displayName: 'Nombre',
  role: 'Rol',
  position: 'Cargo',
  active: 'Estado de la cuenta',
}

/** Solo administradores (lo exigen también las reglas de Firestore). */
export const createUser =
  (input: NewUserInput): AppThunk<Promise<string>> =>
  async (_dispatch, getState) => {
    const actor = getActor(getState())
    const uid = await createAuthAccount(input.email, input.password)
    const profile: UserProfile = {
      uid,
      email: input.email,
      displayName: input.displayName,
      photoURL: null,
      role: input.role,
      position: input.position,
      active: true,
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
    }
    await save('users', uid, profile)
    await logHistory(
      {
        entityType: 'user',
        entityId: uid,
        entityTitle: input.displayName,
        action: 'create',
        summary: `Creó la cuenta con rol ${formatChange(getState())('role', input.role)}`,
      },
      actor,
    )
    return uid
  }

export const editUser =
  (user: UserProfile, input: Partial<EditUserInput>): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    const changes = diffFields(user, input, LABELS, formatChange(state))
    await save('users', user.uid, input)
    if (changes.length)
      await logHistory(
        {
          entityType: 'user',
          entityId: user.uid,
          entityTitle: input.displayName ?? user.displayName ?? '',
          action: 'update',
          summary: changes.join(' · '),
        },
        actor,
      )
  }

/**
 * Elimina el perfil del usuario. La cuenta de Firebase Authentication no se puede borrar desde el navegador
 * (requiere el SDK Admin): si la persona vuelve a entrar se le crea un perfil nuevo como «miembro».
 * Para bloquear el acceso de forma permanente, usa «Desactivar».
 */
export const removeUser =
  (user: UserProfile): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const actor = getActor(getState())
    if (user.uid === actor.uid) throw new Error('No puedes eliminar tu propio usuario.')
    await remove('users', user.uid)
    await logHistory(
      {
        entityType: 'user',
        entityId: user.uid,
        entityTitle: user.displayName ?? '',
        action: 'delete',
        summary: 'Eliminó el perfil del usuario',
      },
      actor,
    )
  }
