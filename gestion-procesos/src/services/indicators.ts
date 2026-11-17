import { TASK_STATUSES, type Priority, type Process, type Task, type TaskStatus, type Workflow } from '../models'
import { DAY_MS, todayIso } from './dates'
import { isProcessFinished, workflowProgress } from './workflow'

export interface ProcessProgress {
  processId: string
  title: string
  status: string
  workflowName: string
  /** Avance por la posición en el flujo (0-100). */
  workflowPct: number
  tasksTotal: number
  tasksDone: number
  /** Avance por tareas completadas (null si no tiene tareas). */
  tasksPct: number | null
  /** Promedio de ambos avances; si no hay tareas, solo el del flujo. */
  progress: number
  overdue: boolean
  finished: boolean
}

export interface Indicators {
  totalProcesses: number
  activeProcesses: number
  finishedProcesses: number
  overdueProcesses: number
  /** % de procesos finalizados antes o en su fecha límite (null si ninguno tiene fecha). */
  onTimeRate: number | null
  /** Días promedio entre creación y finalización (null si no hay finalizados). */
  avgCycleDays: number | null
  totalTasks: number
  openTasks: number
  doneTasks: number
  overdueTasks: number
  taskCompletionRate: number
  byWorkflow: {
    workflowId: string
    name: string
    total: number
    states: { state: string; count: number; isFinal: boolean }[]
  }[]
  byPriority: { priority: Priority; value: number }[]
  tasksByStatus: { status: TaskStatus; value: number }[]
  workload: { uid: string; name: string; open: number; done: number; overdue: number }[]
  trend: { label: string; created: number; finished: number }[]
  progress: ProcessProgress[]
}

interface Input {
  processes: Process[]
  tasks: Task[]
  workflows: Workflow[]
  users: { uid: string; name: string }[]
  now?: number
}

const finishedTime = (p: Process) => p.finishedAt || p.updatedAt

export function computeIndicators({ processes, tasks, workflows, users, now = Date.now() }: Input): Indicators {
  const today = todayIso(now)
  const wf = (id: string) => workflows.find((w) => w.id === id) ?? workflows[0]
  const finished = (p: Process) => isProcessFinished(p, wf(p.workflowId))

  const finishedList = processes.filter(finished)
  const active = processes.filter((p) => !finished(p))
  const overdueProcesses = active.filter((p) => p.dueDate && p.dueDate < today).length
  const withDue = finishedList.filter((p) => p.dueDate)
  const onTime = withDue.filter((p) => todayIso(finishedTime(p)) <= p.dueDate).length
  const cycle = finishedList.map((p) => (finishedTime(p) - p.createdAt) / DAY_MS)

  const openTasks = tasks.filter((t) => t.status !== 'done')
  const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate < today)
  const doneTasks = tasks.length - openTasks.length

  const tasksByProcess = new Map<string, Task[]>()
  tasks.forEach((t) => {
    if (t.processId) tasksByProcess.set(t.processId, [...(tasksByProcess.get(t.processId) ?? []), t])
  })

  const progress: ProcessProgress[] = processes
    .map((p) => {
      const w = wf(p.workflowId)
      const ts = tasksByProcess.get(p.id) ?? []
      const done = ts.filter((t) => t.status === 'done').length
      const wPct = workflowProgress(w, p.status)
      const tPct = ts.length ? Math.round((done / ts.length) * 100) : null
      const isFinished = finished(p)
      return {
        processId: p.id,
        title: p.title,
        status: p.status,
        workflowName: w.name,
        workflowPct: isFinished ? 100 : wPct,
        tasksTotal: ts.length,
        tasksDone: done,
        tasksPct: tPct,
        progress: isFinished ? 100 : tPct === null ? wPct : Math.round((wPct + tPct) / 2),
        overdue: !isFinished && !!p.dueDate && p.dueDate < today,
        finished: isFinished,
      }
    })
    .sort(
      (a, b) =>
        Number(a.finished) - Number(b.finished) || Number(b.overdue) - Number(a.overdue) || a.progress - b.progress,
    )

  const byWorkflow = workflows
    .map((w) => {
      const own = processes.filter((p) => p.workflowId === w.id)
      return {
        workflowId: w.id,
        name: w.name,
        total: own.length,
        states: w.states.map((state, i) => ({
          state,
          count: own.filter((p) => p.status === state).length,
          isFinal: i === w.states.length - 1,
        })),
      }
    })
    .filter((w) => w.total > 0)

  const workload = [...users.map((u) => ({ uid: u.uid, name: u.name })), { uid: '', name: 'Sin asignar' }]
    .map((u) => {
      const own = tasks.filter((t) => t.assigneeId === u.uid)
      return {
        ...u,
        open: own.filter((t) => t.status !== 'done').length,
        done: own.filter((t) => t.status === 'done').length,
        overdue: own.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length,
      }
    })
    .filter((u) => u.open + u.done > 0)
    .sort((a, b) => b.open - a.open)

  const base = new Date(now)
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (5 - i), 1)
    const inMonth = (ms: number) => {
      const x = new Date(ms)
      return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth()
    }
    return {
      label: d.toLocaleDateString('es', { month: 'short' }),
      created: processes.filter((p) => inMonth(p.createdAt)).length,
      finished: finishedList.filter((p) => inMonth(finishedTime(p))).length,
    }
  })

  return {
    totalProcesses: processes.length,
    activeProcesses: active.length,
    finishedProcesses: finishedList.length,
    overdueProcesses,
    onTimeRate: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
    avgCycleDays: cycle.length ? Math.round((cycle.reduce((a, b) => a + b, 0) / cycle.length) * 10) / 10 : null,
    totalTasks: tasks.length,
    openTasks: openTasks.length,
    doneTasks,
    overdueTasks: overdueTasks.length,
    taskCompletionRate: tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0,
    byWorkflow,
    byPriority: (['urgent', 'high', 'medium', 'low'] as Priority[]).map((priority) => ({
      priority,
      value: processes.filter((p) => p.priority === priority).length,
    })),
    tasksByStatus: TASK_STATUSES.map((status) => ({ status, value: tasks.filter((t) => t.status === status).length })),
    workload,
    trend,
    progress,
  }
}
