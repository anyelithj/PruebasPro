// ═══════════════════════════════════════════════════════════════════════════════════════
// useDataSync.ts — SINCRONIZACIÓN en tiempo real: Firestore → Redux.
// Patrón: OBSERVER. Se abre UNA suscripción por colección (en DashboardRoutes) y cada cambio se copia al store;
// todos los demás hooks (useProcesses, useTasks…) solo LEEN del store. Así no hay suscripciones duplicadas.
// Flujo (Flux): Firestore → subscribe() → dispatch(setX) → store → useAppSelector → componente se redibuja.
// ═══════════════════════════════════════════════════════════════════════════════════════

// `where`/`orderBy`: filtros de consulta de Firestore.
import { orderBy, where } from 'firebase/firestore'
import { useEffect } from 'react'
import {
  withProcessDefaults, // completa campos que falten en documentos antiguos (compatibilidad hacia atrás)
  withProfileDefaults,
  withTaskDefaults,
  type AppNotification,
  type AutomationRule,
  type FileRecord,
  type Process,
  type Task,
  type Workflow,
} from '../models'
// Acciones (creadores de acciones de Redux) para guardar la lista de cada colección o su error.
import { automationError, setAutomations } from '../redux/actions/actionAutomation'
import { processError, setProcesses } from '../redux/actions/actionProcess'
import { setTasks, taskError } from '../redux/actions/actionTask'
import { setUsers, userError } from '../redux/actions/actionUser'
import { setWorkflows, workflowError } from '../redux/actions/actionWorkflow'
import { fileError, setFiles } from '../redux/reducers/fileReducers'
import { notificationError, setNotifications } from '../redux/reducers/notificationReducers'
import type { UserRecord } from '../redux/types/types'
// `subscribe`: la fachada de Firestore (services/firestoreService.ts).
import { subscribe } from '../services/firestoreService'
import { useAppDispatch, useAppSelector } from './useRedux'

/**
 * Observer: una sola suscripción por colección, montada una vez en el área privada.
 * Cada cambio de Firestore se refleja en el store de Redux y todos los componentes lo leen de ahí.
 */
export function useDataSync() {
  const dispatch = useAppDispatch()
  // uid del usuario autenticado: sin sesión no se suscribe a nada (las reglas de Firestore lo rechazarían).
  const uid = useAppSelector((s) => s.login.user?.uid)

  // El efecto se ejecuta cuando aparece/cambia la sesión y se limpia al cerrarla.
  useEffect(() => {
    // Sin sesión: no hace nada. `return` sin valor termina la función.
    if (!uid) return
    // Función genérica y pura que ordena del más nuevo al más antiguo. `[...list]` copia el arreglo antes de ordenar
    // (`sort` modifica el original y en Redux los datos son INMUTABLES).
    const byNewest = <T extends { createdAt: number }>(list: T[]) => [...list].sort((a, b) => b.createdAt - a.createdAt)
    // Una suscripción por colección; cada `subscribe` devuelve su función de cancelación.
    const unsubscribers = [
      subscribe<Process>(
        'processes',
        [],
        // `l.map(withProcessDefaults)`: aplica a cada documento la función que completa campos faltantes.
        (l) => dispatch(setProcesses(byNewest(l.map(withProcessDefaults)))),
        (e) => dispatch(processError(e.message)),
      ),
      subscribe<Task>(
        'tasks',
        [],
        (l) => dispatch(setTasks(byNewest(l.map(withTaskDefaults)))),
        (e) => dispatch(taskError(e.message)),
      ),
      subscribe<UserRecord>(
        'users',
        [],
        (l) => dispatch(setUsers(l.map((u) => ({ ...withProfileDefaults(u), id: u.id })))),
        (e) => dispatch(userError(e.message)),
      ),
      subscribe<Workflow>(
        'workflows',
        [],
        (l) => dispatch(setWorkflows(l)),
        (e) => dispatch(workflowError(e.message)),
      ),
      subscribe<AutomationRule>(
        'automations',
        [],
        (l) => dispatch(setAutomations(l)),
        (e) => dispatch(automationError(e.message)),
      ),
      subscribe<AppNotification>(
        'notifications',
        // Solo las notificaciones DE ESTA persona (las reglas de seguridad también lo exigen).
        [where('userId', '==', uid)],
        (l) => dispatch(setNotifications(byNewest(l))),
        (e) => dispatch(notificationError(e.message)),
      ),
      subscribe<FileRecord>(
        'files',
        [orderBy('createdAt', 'desc')],
        (l) => dispatch(setFiles(l)),
        (e) => dispatch(fileError(e.message)),
      ),
    ]
    // Limpieza: al cerrar sesión o desmontar, cancela TODAS las suscripciones (`forEach` llama a cada una).
    return () => unsubscribers.forEach((u) => u())
  }, [dispatch, uid])
}
