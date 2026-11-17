// ═══════════════════════════════════════════════════════════════════════════════════════
// useProcesses.ts — CUSTOM HOOK del CRUD de procesos: expone los datos y las operaciones.
//   LEER  → `processes`, `getById`            (vienen del store; los llena useDataSync en tiempo real)
//   CREAR → `add`   EDITAR → `edit`   MOVER DE ESTADO → `move`   ELIMINAR → `remove`  (despachan thunks)
// Separación de responsabilidades: el componente no sabe de Redux ni de Firestore; solo usa este hook.
// ═══════════════════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react'
import type { Process } from '../models'
// Thunks del CRUD de procesos (escriben en Firestore y registran el historial).
import { addProcess, deleteProcess, editProcess, moveProcess, type ProcessInput } from '../redux/actions/actionProcess'
// Función pura del dominio: ¿el proceso ya terminó?
import { isProcessFinished } from '../services/workflow'
import { useAppDispatch, useAppSelector } from './useRedux'
import { useWorkflow } from './useWorkflow'

export function useProcesses() {
  const dispatch = useAppDispatch()
  // Lee del store el slice `process` (items, loading, error). Desestructuración de objeto.
  const { items, loading, error } = useAppSelector((s) => s.process)
  // Necesita los flujos para saber cuál es el estado final de cada proceso.
  const { getWorkflow } = useWorkflow()

  return {
    // Renombra `items` como `processes` (propiedad: valor).
    processes: items,
    loading,
    error,
    // Busca un proceso por id. `find` devuelve el primero que cumpla (o undefined).
    getById: useCallback((id?: string) => items.find((p) => p.id === id), [items]),
    // ¿Terminó? Usa el flujo del proceso.
    isFinished: useCallback((p: Process) => isProcessFinished(p, getWorkflow(p.workflowId)), [getWorkflow]),
    // CREATE: despacha el thunk; devuelve una Promesa con el id del proceso nuevo.
    add: useCallback((input: ProcessInput) => dispatch(addProcess(input)), [dispatch]),
    // UPDATE: `Partial<...>` permite enviar solo los campos que cambiaron.
    edit: useCallback((id: string, input: Partial<ProcessInput>) => dispatch(editProcess(id, input)), [dispatch]),
    // Cambio de estado dentro del flujo (dispara automatizaciones e historial).
    move: useCallback((process: Process, status: string) => dispatch(moveProcess(process, status)), [dispatch]),
    // DELETE.
    remove: useCallback((id: string) => dispatch(deleteProcess(id)), [dispatch]),
  }
}
