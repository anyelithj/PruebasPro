import type { Task, TaskStatus } from '../../models'
import { TASK_STATUS_LABEL } from '../../models'
import { runAutomations } from '../../services/automation'
import { create, patch, remove } from '../../services/firestoreService'
import { diffFields, logHistory } from '../../services/history'
import type { AppThunk } from '../store/store'
import { deleteFile } from './actionFile'
import { formatChange, getActor } from './actionHelpers'
import { sendNotification } from './actionNotification'
import { setTasks, taskError } from '../reducers/taskReducers'

export { setTasks, taskError }

export type TaskInput = Pick<
  Task,
  'title' | 'description' | 'processId' | 'priority' | 'status' | 'assigneeId' | 'dueDate'
>

const LABELS: Partial<Record<keyof Task, string>> = {
  title: 'Título',
  description: 'Descripción',
  processId: 'Proceso',
  priority: 'Prioridad',
  status: 'Estado',
  assigneeId: 'Responsable',
  dueDate: 'Fecha límite',
}

export const addTask =
  (input: TaskInput): AppThunk<Promise<string>> =>
  async (dispatch, getState) => {
    const actor = getActor(getState())
    const now = Date.now()
    const data = {
      ...input,
      completedAt: input.status === 'done' ? now : 0,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    }
    const id = await create('tasks', data)
    await logHistory(
      { entityType: 'task', entityId: id, entityTitle: input.title, action: 'create', summary: 'Creó la tarea' },
      actor,
    )
    await dispatch(
      sendNotification(input.assigneeId, `Te asignaron la tarea: ${input.title}`, `/app/tareas/${id}`, 'assignments'),
    )
    await runAutomations({ type: 'task_created', task: { ...data, id } })
    return id
  }

export const editTask =
  (task: Task, input: Partial<TaskInput>): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    const changes = diffFields(task, input, LABELS, formatChange(state))
    const now = Date.now()
    const statusChanged = input.status !== undefined && input.status !== task.status
    await patch('tasks', task.id, {
      ...input,
      updatedAt: now,
      ...(statusChanged ? { completedAt: input.status === 'done' ? now : 0 } : {}),
    })
    if (changes.length)
      await logHistory(
        {
          entityType: 'task',
          entityId: task.id,
          entityTitle: input.title ?? task.title,
          action: statusChanged && changes.length === 1 ? 'status' : 'update',
          summary: changes.join(' · '),
        },
        actor,
      )
    if (input.assigneeId && input.assigneeId !== task.assigneeId)
      await dispatch(
        sendNotification(
          input.assigneeId,
          `Te asignaron la tarea: ${task.title}`,
          `/app/tareas/${task.id}`,
          'assignments',
        ),
      )
    if (statusChanged)
      await runAutomations({
        type: 'task_status',
        task: { ...task, ...input, status: input.status as TaskStatus },
        to: input.status as TaskStatus,
      })
  }

export const moveTask =
  (task: Task, status: TaskStatus): AppThunk<Promise<void>> =>
  async (dispatch) => {
    if (task.status === status) return
    await dispatch(editTask(task, { status }))
  }

export const deleteTask =
  (task: Task): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    await Promise.all(
      state.file.items
        .filter((f) => f.entityType === 'task' && f.entityId === task.id)
        .map((f) => dispatch(deleteFile(f))),
    )
    await remove('tasks', task.id)
    await logHistory(
      {
        entityType: 'task',
        entityId: task.id,
        entityTitle: task.title,
        action: 'delete',
        summary: `Eliminó la tarea (estaba «${TASK_STATUS_LABEL[task.status]}»)`,
      },
      actor,
    )
  }
