import { createSelector } from '@reduxjs/toolkit'
import { computeAnalytics } from '../../services/analytics'
import { computeIndicators } from '../../services/indicators'
import { DEFAULT_WORKFLOW } from '../../services/workflow'
import type { RootState } from '../store/store'

export const selectProcesses = (s: RootState) => s.process.items
export const selectTasks = (s: RootState) => s.task.items
export const selectUsers = (s: RootState) => s.user.items
const selectCustomWorkflows = (s: RootState) => s.workflow.items

export const selectWorkflows = createSelector([selectCustomWorkflows], (custom) => [DEFAULT_WORKFLOW, ...custom])

export const selectUserNames = createSelector(
  [selectUsers],
  (users) => new Map(users.map((u) => [u.uid, u.displayName || u.email || 'Usuario'])),
)

/** Indicadores de procesos y tareas calculados a partir del flujo de cada proceso. */
export const selectIndicators = createSelector(
  [selectProcesses, selectTasks, selectWorkflows, selectUserNames],
  (processes, tasks, workflows, names) =>
    computeIndicators({ processes, tasks, workflows, users: [...names].map(([uid, name]) => ({ uid, name })) }),
)

/** Analítica: ritmo, antigüedad, plazos y cumplimiento (no repite los indicadores). */
export const selectAnalytics = createSelector(
  [selectProcesses, selectTasks, selectWorkflows, selectUserNames],
  (processes, tasks, workflows, names) =>
    computeAnalytics({ processes, tasks, workflows, users: [...names].map(([uid, name]) => ({ uid, name })) }),
)
