import { useCallback, useMemo } from 'react'
import type { Task, TaskStatus } from '../models'
import { addTask, deleteTask, editTask, moveTask, type TaskInput } from '../redux/actions/actionTask'
import { useAppDispatch, useAppSelector } from './useRedux'

export type { TaskInput }

/** Con `processId` devuelve solo las tareas de ese proceso. */
export function useTasks(processId?: string) {
  const dispatch = useAppDispatch()
  const { items, loading, error } = useAppSelector((s) => s.task)
  const tasks = useMemo(() => (processId ? items.filter((t) => t.processId === processId) : items), [items, processId])

  return {
    tasks,
    loading,
    error,
    getById: useCallback((id?: string) => items.find((t) => t.id === id), [items]),
    add: useCallback((input: TaskInput) => dispatch(addTask(input)), [dispatch]),
    edit: useCallback((task: Task, input: Partial<TaskInput>) => dispatch(editTask(task, input)), [dispatch]),
    move: useCallback((task: Task, status: TaskStatus) => dispatch(moveTask(task, status)), [dispatch]),
    remove: useCallback((task: Task) => dispatch(deleteTask(task)), [dispatch]),
  }
}
