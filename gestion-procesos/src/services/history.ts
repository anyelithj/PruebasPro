import type { HistoryAction, HistoryEntity } from '../models'
import { create } from './firestoreService'

export interface Actor {
  uid: string
  name: string
}
export const SYSTEM_ACTOR: Actor = { uid: 'system', name: 'Automatización' }

interface EntryInput {
  entityType: HistoryEntity
  entityId: string
  entityTitle: string
  action: HistoryAction
  summary: string
}

/** Registra un cambio. Nunca debe romper la operación principal. */
export async function logHistory(entry: EntryInput, actor: Actor): Promise<void> {
  try {
    await create('history', { ...entry, userId: actor.uid, userName: actor.name, createdAt: Date.now() })
  } catch (error) {
    console.error('No se pudo registrar el historial', error)
  }
}

/** Compara dos versiones y devuelve frases legibles: «Prioridad: Media → Alta». */
export function diffFields<T extends object>(
  before: T,
  after: Partial<T>,
  labels: Partial<Record<keyof T, string>>,
  format: (key: keyof T, value: unknown) => string = (_k, v) =>
    Array.isArray(v) ? v.join(', ') : String(v ?? '') || '—',
): string[] {
  const changes: string[] = []
  for (const key of Object.keys(labels) as (keyof T)[]) {
    if (!(key in after)) continue
    const a = JSON.stringify(before[key])
    const b = JSON.stringify(after[key])
    if (a !== b) changes.push(`${labels[key]}: ${format(key, before[key])} → ${format(key, after[key])}`)
  }
  return changes
}
