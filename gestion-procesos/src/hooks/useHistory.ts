import { limit, orderBy, where, type QueryConstraint } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { HistoryEntry } from '../models'
import { subscribe } from '../services/firestoreService'
import { useAuth } from './useAuth'

interface Options {
  entityId?: string
  userId?: string
  max?: number
}

/** Historial de cambios: de una entidad, de un usuario o global (últimos `max`). */
export function useHistory({ entityId, userId, max = 200 }: Options = {}) {
  const { user } = useAuth()
  const uid = user?.uid
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const constraints: QueryConstraint[] = entityId
      ? [where('entityId', '==', entityId)]
      : userId
        ? [where('userId', '==', userId)]
        : [orderBy('createdAt', 'desc'), limit(max)]
    return subscribe<HistoryEntry>(
      'history',
      constraints,
      (list) => {
        setEntries([...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, max))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [uid, entityId, userId, max])

  return { entries, loading }
}
