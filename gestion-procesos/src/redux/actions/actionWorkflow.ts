import { create, patch, remove } from '../../services/firestoreService'
import { logHistory } from '../../services/history'
import type { AppThunk } from '../store/store'
import { getActor } from './actionHelpers'
import { setWorkflows, workflowError } from '../reducers/workflowReducers'

export { setWorkflows, workflowError }

const clean = (states: string[]) => [...new Set(states.map((s) => s.trim()).filter(Boolean))]

export const addWorkflow =
  (name: string, states: string[]): AppThunk<Promise<string>> =>
  async (_dispatch, getState) => {
    const actor = getActor(getState())
    const list = clean(states)
    if (!name.trim() || list.length < 2) throw new Error('Escribe un nombre y al menos dos estados distintos.')
    const id = await create('workflows', { name: name.trim(), states: list, createdBy: actor.uid })
    await logHistory(
      {
        entityType: 'workflow',
        entityId: id,
        entityTitle: name.trim(),
        action: 'create',
        summary: `Creó el flujo: ${list.join(' → ')}`,
      },
      actor,
    )
    return id
  }

export const editWorkflow =
  (id: string, name: string, states: string[]): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    const list = clean(states)
    if (!name.trim() || list.length < 2) throw new Error('Escribe un nombre y al menos dos estados distintos.')
    const orphan = state.process.items.filter((p) => p.workflowId === id && !list.includes(p.status))
    if (orphan.length)
      throw new Error(`No puedes quitar estados en uso: ${[...new Set(orphan.map((p) => p.status))].join(', ')}.`)
    await patch('workflows', id, { name: name.trim(), states: list })
    await logHistory(
      {
        entityType: 'workflow',
        entityId: id,
        entityTitle: name.trim(),
        action: 'update',
        summary: `Estados: ${list.join(' → ')}`,
      },
      actor,
    )
  }

export const deleteWorkflow =
  (id: string): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    const wf = state.workflow.items.find((w) => w.id === id)
    if (state.process.items.some((p) => p.workflowId === id))
      throw new Error('Hay procesos que usan este flujo. Muévelos a otro flujo antes de eliminarlo.')
    await remove('workflows', id)
    await logHistory(
      {
        entityType: 'workflow',
        entityId: id,
        entityTitle: wf?.name ?? '',
        action: 'delete',
        summary: 'Eliminó el flujo',
      },
      actor,
    )
  }
