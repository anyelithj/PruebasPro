import type { Priority, Process, ProcessKind, Task, TaskStatus } from '../models'
import { normalize } from './ai'
import { todayIso } from './dates'

export const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 }

export interface ProcessFilters {
  text: string
  status: string
  priority: Priority | ''
  kind: ProcessKind | ''
  category: string
  workflowId: string
  ownerId: string
  assigneeId: string
  dueFrom: string
  dueTo: string
  overdueOnly: boolean
  onlyActive: boolean
  sort: 'recent' | 'due' | 'priority' | 'title'
}

export const emptyProcessFilters: ProcessFilters = {
  text: '',
  status: '',
  priority: '',
  kind: '',
  category: '',
  workflowId: '',
  ownerId: '',
  assigneeId: '',
  dueFrom: '',
  dueTo: '',
  overdueOnly: false,
  onlyActive: false,
  sort: 'recent',
}

export function filterProcesses(
  list: Process[],
  f: ProcessFilters,
  isFinished: (p: Process) => boolean,
  today: string = todayIso(),
): Process[] {
  const q = normalize(f.text.trim())
  const result = list.filter((p) => {
    if (q && !normalize(`${p.title} ${p.description} ${p.category} ${p.aiSummary}`).includes(q)) return false
    if (f.status && p.status !== f.status) return false
    if (f.priority && p.priority !== f.priority) return false
    if (f.kind && p.kind !== f.kind) return false
    if (f.category && p.category !== f.category) return false
    if (f.workflowId && p.workflowId !== f.workflowId) return false
    if (f.ownerId && p.ownerId !== f.ownerId) return false
    if (f.assigneeId && !p.assigneeIds.includes(f.assigneeId)) return false
    if (f.dueFrom && (!p.dueDate || p.dueDate < f.dueFrom)) return false
    if (f.dueTo && (!p.dueDate || p.dueDate > f.dueTo)) return false
    if (f.onlyActive && isFinished(p)) return false
    if (f.overdueOnly && !(p.dueDate && p.dueDate < today && !isFinished(p))) return false
    return true
  })
  const sorters: Record<ProcessFilters['sort'], (a: Process, b: Process) => number> = {
    recent: (a, b) => b.createdAt - a.createdAt,
    due: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
    priority: (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
  }
  return [...result].sort(sorters[f.sort])
}

export interface TaskFilters {
  text: string
  status: TaskStatus | ''
  priority: Priority | ''
  assigneeId: string
  processId: string
  dueFrom: string
  dueTo: string
  overdueOnly: boolean
}

export const emptyTaskFilters: TaskFilters = {
  text: '',
  status: '',
  priority: '',
  assigneeId: '',
  processId: '',
  dueFrom: '',
  dueTo: '',
  overdueOnly: false,
}

export function filterTasks(list: Task[], f: TaskFilters, today: string = todayIso()): Task[] {
  const q = normalize(f.text.trim())
  return list.filter((t) => {
    if (q && !normalize(`${t.title} ${t.description}`).includes(q)) return false
    if (f.status && t.status !== f.status) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false
    if (f.processId && t.processId !== f.processId) return false
    if (f.dueFrom && (!t.dueDate || t.dueDate < f.dueFrom)) return false
    if (f.dueTo && (!t.dueDate || t.dueDate > f.dueTo)) return false
    if (f.overdueOnly && !(t.dueDate && t.dueDate < today && t.status !== 'done')) return false
    return true
  })
}
