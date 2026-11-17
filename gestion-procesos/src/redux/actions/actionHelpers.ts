import { PRIORITY_LABEL, ROLE_LABEL, TASK_STATUS_LABEL, type Priority, type Role, type TaskStatus } from '../../models'
import type { Actor } from '../../services/history'
import type { RootState } from '../store/store'

export const getActor = (state: RootState): Actor => {
  const { user, profile } = state.login
  if (!user) throw new Error('Sesión no iniciada')
  return { uid: user.uid, name: profile?.displayName || user.email || 'Usuario' }
}

export const userName = (state: RootState, uid: string): string => {
  if (!uid) return 'Sin asignar'
  const u = state.user.items.find((x) => x.uid === uid)
  return u?.displayName || u?.email || 'Usuario'
}

/** Traduce valores internos a texto legible para el historial. */
export const formatChange =
  (state: RootState) =>
  (key: PropertyKey, value: unknown): string => {
    if (key === 'priority') return PRIORITY_LABEL[value as Priority] ?? String(value)
    if (key === 'assigneeIds') return (value as string[]).map((u) => userName(state, u)).join(', ') || 'Sin asignar'
    if (key === 'assigneeId') return userName(state, String(value ?? ''))
    if (key === 'role') return ROLE_LABEL[value as Role] ?? String(value)
    if (key === 'status' && typeof value === 'string' && value in TASK_STATUS_LABEL)
      return TASK_STATUS_LABEL[value as TaskStatus]
    if (key === 'active') return value ? 'Activo' : 'Desactivado'
    if (key === 'kind') return value === 'solicitud' ? 'Solicitud' : 'Proceso'
    if (key === 'processId')
      return value ? String(state.process.items.find((p) => p.id === value)?.title ?? '—') : 'Sin proceso'
    return String(value ?? '') || '—'
  }
