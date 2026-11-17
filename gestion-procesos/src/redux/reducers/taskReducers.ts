import type { Task } from '../../models'
import { createCollectionSlice } from './collectionSlice'

export const taskSlice = createCollectionSlice<Task>('task')
export const { setItems: setTasks, setError: taskError } = taskSlice.actions
export const taskReducer = taskSlice.reducer
